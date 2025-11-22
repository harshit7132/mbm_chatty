import { generateToken } from "../lib/utils.js";
import User from "../models/user.model.js";
import OTP from "../models/otp.model.js";
import bcrypt from "bcryptjs";
import cloudinary from "../lib/cloudinary.js";
import { sendOTPEmail, sendWelcomeEmail } from "../lib/email.js";

export const signup = async (req, res) => {
  const { fullName, email, password, otp } = req.body;
  try {
    if (!fullName || !email) {
      return res.status(400).json({ message: "Full name and email are required" });
    }

    // If OTP is provided (passwordless signup), verify it
    if (otp && password === "otp-verified") {
      const otpDoc = await OTP.findOne({ email, otp, verified: true });
      if (!otpDoc || new Date() > otpDoc.expiresAt) {
        return res.status(400).json({ message: "Invalid or expired OTP" });
      }
      await OTP.deleteOne({ _id: otpDoc._id });
      // Use a random password for OTP-verified accounts
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash("otp-verified-" + Date.now(), salt);
      
      const user = await User.findOne({ email });
      if (user) return res.status(400).json({ message: "Email already exists" });

      const newUser = new User({
        fullName,
        email,
        password: hashedPassword,
      });

      generateToken(newUser._id, res);
      await newUser.save();

      // Send welcome email
      sendWelcomeEmail(email, fullName).catch(console.error);

      return res.status(201).json({
        _id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        profilePic: newUser.profilePic,
        points: newUser.points || 0,
        badges: newUser.badges || [],
        chatCount: newUser.chatCount || 0,
        isAdmin: newUser.isAdmin || false,
      });
    }

    // Regular password signup
    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const user = await User.findOne({ email });

    if (user) return res.status(400).json({ message: "Email already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
    });

    if (newUser) {
      // generate jwt token here
      generateToken(newUser._id, res);
      await newUser.save();

      // Send welcome email
      sendWelcomeEmail(email, fullName).catch(console.error);

      res.status(201).json({
        _id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        profilePic: newUser.profilePic,
        points: newUser.points || 0,
        badges: newUser.badges || [],
        chatCount: newUser.chatCount || 0,
        isAdmin: newUser.isAdmin || false,
      });
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    console.error("Error in signup controller:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ 
      message: "Internal Server Error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    generateToken(user._id, res);

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName || user.username || user.email?.split("@")[0] || "User",
      email: user.email,
      profilePic: user.profilePic || user.avatar || "",
      points: user.points || user.totalPoints || 0,
      badges: user.badges || (user.earlyUserBadge ? [user.earlyUserBadge] : []),
      chatCount: user.chatCount || user.totalChats || 0,
      isAdmin: user.isAdmin || false,
    });
  } catch (error) {
    console.log("Error in login controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const logout = (req, res) => {
  try {
    res.cookie("jwt", "", { maxAge: 0 });
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.log("Error in logout controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { profilePic } = req.body;
    const userId = req.user._id;

    if (!profilePic) {
      return res.status(400).json({ message: "Profile pic is required" });
    }

    const uploadResponse = await cloudinary.uploader.upload(profilePic);
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePic: uploadResponse.secure_url },
      { new: true }
    );

    res.status(200).json(updatedUser);
  } catch (error) {
    console.log("error in update profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const checkAuth = (req, res) => {
  try {
    res.status(200).json(req.user);
  } catch (error) {
    console.log("Error in checkAuth controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP via Brevo
export const sendOTP = async (req, res) => {
  const { email } = req.body;
  try {
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Normalize email (lowercase, trim)
    const normalizedEmail = email.toLowerCase().trim();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Generate OTP
    const otp = generateOTP();

    // Delete any existing OTPs for this email
    await OTP.deleteMany({ email: normalizedEmail });

    // Save new OTP
    const otpDoc = new OTP({
      email: normalizedEmail,
      otp: otp.toString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });
    await otpDoc.save();

    // Get user name if exists
    const user = await User.findOne({ email: normalizedEmail });
    const userName = user?.fullName || "User";

    // Send OTP email via Brevo
    await sendOTPEmail(normalizedEmail, otp, userName);

    res.status(200).json({
      message: "OTP sent successfully to your email",
      expiresIn: 600, // 10 minutes in seconds
    });
  } catch (error) {
    console.log("Error in sendOTP controller:", error.message);
    res.status(500).json({ message: "Failed to send OTP. Please try again." });
  }
};

// Verify OTP
export const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;
  try {
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    // Normalize email (lowercase, trim)
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedOTP = otp.toString().trim();

    // Find OTP document
    const otpDoc = await OTP.findOne({ 
      email: normalizedEmail, 
      otp: normalizedOTP, 
      verified: false 
    });

    if (!otpDoc) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Check if OTP is expired
    if (new Date() > otpDoc.expiresAt) {
      await OTP.deleteOne({ _id: otpDoc._id });
      return res.status(400).json({ message: "OTP has expired" });
    }

    // Check attempts
    if (otpDoc.attempts >= 5) {
      await OTP.deleteOne({ _id: otpDoc._id });
      return res.status(400).json({ message: "Too many attempts. Please request a new OTP." });
    }

    // Mark as verified
    otpDoc.verified = true;
    otpDoc.attempts += 1;
    await otpDoc.save();

    res.status(200).json({
      message: "OTP verified successfully",
      verified: true,
    });
  } catch (error) {
    console.log("Error in verifyOTP controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Login with OTP
export const loginWithOTP = async (req, res) => {
  const { email, otp } = req.body;
  try {
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    // Normalize email (lowercase, trim)
    const normalizedEmail = email.toLowerCase().trim();

    // Find OTP (verified or not - we'll verify it now)
    let otpDoc = await OTP.findOne({ 
      email: normalizedEmail, 
      otp: otp.toString().trim() 
    });

    if (!otpDoc) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Check if OTP is expired
    if (new Date() > otpDoc.expiresAt) {
      await OTP.deleteOne({ _id: otpDoc._id });
      return res.status(400).json({ message: "OTP has expired" });
    }

    // Check attempts
    if (otpDoc.attempts >= 5) {
      await OTP.deleteOne({ _id: otpDoc._id });
      return res.status(400).json({ message: "Too many attempts. Please request a new OTP." });
    }

    // Verify the OTP if not already verified
    if (!otpDoc.verified) {
      otpDoc.verified = true;
      otpDoc.attempts += 1;
      await otpDoc.save();
    }

    // Find or create user
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      // Create new user if doesn't exist (passwordless signup)
      user = new User({
        fullName: normalizedEmail.split("@")[0], // Use email prefix as name
        email: normalizedEmail,
        password: await bcrypt.hash("otp-verified-" + Date.now(), 10), // Random password
      });
      await user.save();

      // Send welcome email
      sendWelcomeEmail(normalizedEmail, user.fullName).catch(console.error);
    }

    // Delete used OTP
    await OTP.deleteOne({ _id: otpDoc._id });

    // Generate token
    generateToken(user._id, res);

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName || user.username || user.email?.split("@")[0] || "User",
      email: user.email,
      profilePic: user.profilePic || user.avatar || "",
      points: user.points || user.totalPoints || 0,
      badges: user.badges || (user.earlyUserBadge ? [user.earlyUserBadge] : []),
      chatCount: user.chatCount || user.totalChats || 0,
      isAdmin: user.isAdmin || false,
    });
  } catch (error) {
    console.log("Error in loginWithOTP controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Update signup to support OTP
export const signupWithOTP = async (req, res) => {
  const { fullName, email, otp } = req.body;
  try {
    if (!fullName || !email) {
      return res.status(400).json({ message: "Full name and email are required" });
    }

    // If OTP is provided, verify it
    if (otp) {
      const otpDoc = await OTP.findOne({ email, otp, verified: true });
      if (!otpDoc || new Date() > otpDoc.expiresAt) {
        return res.status(400).json({ message: "Invalid or expired OTP" });
      }
      await OTP.deleteOne({ _id: otpDoc._id });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Create user with OTP-verified password
    const hashedPassword = await bcrypt.hash("otp-verified-" + Date.now(), 10);
    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
    });

    generateToken(newUser._id, res);
    await newUser.save();

    // Send welcome email
    sendWelcomeEmail(email, fullName).catch(console.error);

    res.status(201).json({
      _id: newUser._id,
      fullName: newUser.fullName,
      email: newUser.email,
      profilePic: newUser.profilePic,
      points: newUser.points || 0,
      badges: newUser.badges || [],
      chatCount: newUser.chatCount || 0,
      isAdmin: newUser.isAdmin || false,
    });
  } catch (error) {
    console.log("Error in signupWithOTP controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

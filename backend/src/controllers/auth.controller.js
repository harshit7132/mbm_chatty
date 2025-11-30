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

    // Check for referral code
    const referralCode = req.body.referralCode || req.query.ref;
    
    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
    });

    // Don't auto-generate referral code - user will create their own via /api/engagement/referral/create

    // Apply referral if provided
      if (referralCode) {
        const referrer = await User.findOne({ referralCode });
        if (referrer && referrer._id.toString() !== newUser._id.toString()) {
          newUser.referredBy = referrer._id;
          
          // Reward referrer (50 points)
          const referrerReward = 50;
          referrer.points = (referrer.points || 0) + referrerReward;
          referrer.totalPoints = (referrer.totalPoints || 0) + referrerReward;
          referrer.referralPoints = (referrer.referralPoints || 0) + referrerReward;
          if (!referrer.referrals) {
            referrer.referrals = [];
          }
          referrer.referrals.push(newUser._id);
          referrer.pointsHistory.push({
            type: "earned",
            amount: referrerReward,
            description: `Referral reward: ${email}`,
            timestamp: new Date(),
          });
          await referrer.save();

          // Reward new user (25 points)
          const newUserReward = 25;
          newUser.points = (newUser.points || 0) + newUserReward;
          newUser.totalPoints = (newUser.totalPoints || 0) + newUserReward;
          newUser.pointsHistory = [{
            type: "earned",
            amount: newUserReward,
            description: `Signup with referral code`,
            timestamp: new Date(),
          }];
        }
      }

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
        canClaimDaily: true, // New users can claim daily reward
        loginStreak: 1,
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

    // Check for referral code
    const referralCode = req.body.referralCode || req.query.ref;
    
    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
    });

    // Don't auto-generate referral code - user will create their own via /api/engagement/referral/create

    // Apply referral if provided
    if (referralCode) {
      const referrer = await User.findOne({ referralCode });
      if (referrer && referrer._id.toString() !== newUser._id.toString()) {
        newUser.referredBy = referrer._id;
        
        // Reward referrer (50 points)
        const referrerReward = 50;
        referrer.points = (referrer.points || 0) + referrerReward;
        referrer.totalPoints = (referrer.totalPoints || 0) + referrerReward;
        referrer.referralPoints = (referrer.referralPoints || 0) + referrerReward;
        if (!referrer.referrals) {
          referrer.referrals = [];
        }
        referrer.referrals.push(newUser._id);
        referrer.pointsHistory.push({
          type: "earned",
          amount: referrerReward,
          description: `Referral reward: ${email}`,
          timestamp: new Date(),
        });
        await referrer.save();

        // Reward new user (25 points)
        const newUserReward = 25;
        newUser.points = (newUser.points || 0) + newUserReward;
        newUser.totalPoints = (newUser.totalPoints || 0) + newUserReward;
        newUser.pointsHistory = [{
          type: "earned",
          amount: newUserReward,
          description: `Signup with referral code`,
          timestamp: new Date(),
        }];
      }
    }

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
        canClaimDaily: true, // New users can claim daily reward
        loginStreak: 1,
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

    // No daily login requirement - activity tracking handles streaks automatically
    // Just update total logins for statistics
    user.totalLogins = (user.totalLogins || 0) + 1;

    generateToken(user._id, res);

    // Activity tracking is now handled automatically by useActivityTracker hook
    // No need to track login as activity - user just needs to spend time on site
    // The activity tracking system will handle streaks automatically
    await user.save();

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName || user.username || user.email?.split("@")[0] || "User",
      email: user.email,
      profilePic: user.profilePic || user.avatar || "",
      points: user.points || user.totalPoints || 0,
      badges: user.badges || (user.earlyUserBadge ? [user.earlyUserBadge] : []),
      chatCount: user.chatCount || user.totalChats || 0,
      isAdmin: user.isAdmin || false,
      consecutiveDaysActive: user.consecutiveDaysActive || 0, // Activity-based streak
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
      // Check for referral code
      const referralCode = req.body.referralCode || req.query.ref;
      
      user = new User({
        fullName: normalizedEmail.split("@")[0], // Use email prefix as name
        email: normalizedEmail,
        password: await bcrypt.hash("otp-verified-" + Date.now(), 10), // Random password
      });

      // Don't auto-generate referral code - user will create their own

      // Apply referral if provided
      if (referralCode) {
        const referrer = await User.findOne({ referralCode });
        if (referrer && referrer._id.toString() !== user._id.toString()) {
          user.referredBy = referrer._id;
          
          // Reward referrer (50 points)
          const referrerReward = 50;
          referrer.points = (referrer.points || 0) + referrerReward;
          referrer.totalPoints = (referrer.totalPoints || 0) + referrerReward;
          referrer.referralPoints = (referrer.referralPoints || 0) + referrerReward;
          if (!referrer.referrals) {
            referrer.referrals = [];
          }
          referrer.referrals.push(user._id);
          referrer.pointsHistory.push({
            type: "earned",
            amount: referrerReward,
            description: `Referral reward: ${normalizedEmail}`,
            timestamp: new Date(),
          });
          await referrer.save();

          // Reward new user (25 points)
          const newUserReward = 25;
          user.points = (user.points || 0) + newUserReward;
          user.totalPoints = (user.totalPoints || 0) + newUserReward;
          user.pointsHistory = [{
            type: "earned",
            amount: newUserReward,
            description: `Signup with referral code`,
            timestamp: new Date(),
          }];
        }
      }

      await user.save();

      // Send welcome email
      sendWelcomeEmail(normalizedEmail, user.fullName).catch(console.error);
    } else {
      // Existing user login - check daily login
      const todayForOTP = new Date();
      todayForOTP.setHours(0, 0, 0, 0);
      const lastLogin = user.lastLoginDate ? new Date(user.lastLoginDate) : null;
      if (lastLogin) {
        lastLogin.setHours(0, 0, 0, 0);
      }

      // No daily login requirement - activity tracking handles streaks automatically
      // Just update total logins for statistics
      user.totalLogins = (user.totalLogins || 0) + 1;

      // Track daily activity (login counts as activity)
      if (!user.dailyActivity) {
        user.dailyActivity = [];
      }

      const todayActivityOTP = user.dailyActivity.find(activity => {
        const activityDate = new Date(activity.date);
        activityDate.setHours(0, 0, 0, 0);
        return activityDate.getTime() === todayForOTP.getTime();
      });

      const wasActiveBeforeOTP = todayActivityOTP?.isActive || false;

      if (todayActivityOTP) {
        todayActivityOTP.loginTime = new Date();
        todayActivityOTP.isActive = true;
        if (todayActivityOTP.activeMinutes < 5) {
          todayActivityOTP.activeMinutes = 5;
        }
      } else {
        user.dailyActivity.push({
          date: todayForOTP,
          loginTime: new Date(),
          activeMinutes: 5,
          isActive: true,
        });
      }

      // Update consecutiveDaysActive if user became active today
      if (!wasActiveBeforeOTP) {
        // Check yesterday's activity
        const yesterday = new Date(todayForOTP);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        const yesterdayActivity = user.dailyActivity.find(a => {
          const aDate = new Date(a.date).toISOString().split('T')[0];
          return aDate === yesterdayStr && a.isActive;
        });
        
        if (yesterdayActivity) {
          user.consecutiveDaysActive = (user.consecutiveDaysActive || 0) + 1;
        } else {
          user.consecutiveDaysActive = 1; // Reset streak
          user.lastStreakRewardMilestone = 0; // Reset milestone tracking
        }
      }

      // Check for 5-day streak milestone reward (5, 10, 15, 20, etc.)
      const currentStreak = user.consecutiveDaysActive || 0;
      const lastMilestone = user.lastStreakRewardMilestone || 0;
      
      if (currentStreak > 0 && currentStreak % 5 === 0 && currentStreak > lastMilestone) {
        // User reached a new 5-day milestone (5, 10, 15, 20, etc.)
        const rewardPoints = 3;
        user.points = (user.points || 0) + rewardPoints;
        user.totalPoints = (user.totalPoints || 0) + rewardPoints;
        user.lastStreakRewardMilestone = currentStreak;
        
        // Add to points history
        if (!user.pointsHistory) {
          user.pointsHistory = [];
        }
        user.pointsHistory.push({
          type: "earned",
          amount: rewardPoints,
          description: `${currentStreak}-day activity streak reward`,
          timestamp: new Date(),
        });
      }

      await user.save();
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
      consecutiveDaysActive: user.consecutiveDaysActive || 0, // Activity-based streak
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

import express from "express";
import {
  checkAuth,
  login,
  logout,
  signup,
  updateProfile,
  sendOTP,
  verifyOTP,
  loginWithOTP,
  signupWithOTP,
} from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import User from "../models/user.model.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/signup-otp", signupWithOTP);
router.post("/login", login);
router.post("/login-otp", loginWithOTP);
router.post("/logout", logout);

// OTP routes
router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTP);

router.put("/update-profile", protectRoute, updateProfile);

router.get("/check", protectRoute, checkAuth);

// Get online users from MongoDB
router.get("/online-users", protectRoute, async (req, res) => {
  try {
    // Get all users who are online (isOnline: true and lastSeen within last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const onlineUsers = await User.find({
      isOnline: true,
      lastSeen: { $gte: fiveMinutesAgo }
    }).select("_id");
    
    const onlineUserIds = onlineUsers.map(user => user._id.toString());
    
    res.status(200).json({ onlineUsers: onlineUserIds });
  } catch (error) {
    console.log("Error in getOnlineUsers:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// User search route - Returns all users (for finding new friends)
router.get("/search-all", protectRoute, async (req, res) => {
  try {
    const { q } = req.query;
    const loggedInUserId = req.user._id;
    
    if (!q || q.trim() === "") {
      return res.status(200).json([]);
    }

    // Search all users except the logged-in user
    const searchRegex = new RegExp(q, "i");
    const users = await User.find({
      _id: { $ne: loggedInUserId },
      $or: [
        { fullName: searchRegex },
        { username: searchRegex },
        { email: searchRegex },
      ],
    })
      .select("-password")
      .limit(20);

    // Get logged-in user's friends list to show friend status
    const loggedInUser = await User.findById(loggedInUserId).select("friends");
    const friendIds = loggedInUser?.friends?.map(f => f.toString()) || [];

    // Normalize user data for frontend
    const normalizedUsers = users.map((user) => ({
      _id: user._id,
      fullName: user.fullName || user.username || user.email?.split("@")[0] || "User",
      email: user.email,
      profilePic: user.profilePic || user.avatar || "",
      points: user.points || user.totalPoints || 0,
      badges: user.badges || (user.earlyUserBadge ? [user.earlyUserBadge] : []),
      chatCount: user.chatCount || user.totalChats || 0,
      isAdmin: user.isAdmin || false,
      isFriend: friendIds.includes(user._id.toString()), // Add friend status
    }));

    res.status(200).json(normalizedUsers);
  } catch (error) {
    console.log("Error in search-all controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// User search route - Only returns friends (for sidebar)
router.get("/search", protectRoute, async (req, res) => {
  try {
    const { q } = req.query;
    const loggedInUserId = req.user._id;
    
    // Get the logged-in user to access their friends list
    const loggedInUser = await User.findById(loggedInUserId).select("friends");
    
    if (!loggedInUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Only search within friends
    const friendIds = loggedInUser.friends || [];
    
    if (friendIds.length === 0) {
      return res.status(200).json([]);
    }
    
    if (!q || q.trim() === "") {
      // Return all friends when no search query
      const users = await User.find({ _id: { $in: friendIds } })
        .select("-password")
        .limit(20);
      // Normalize user data for frontend
      const normalizedUsers = users.map((user) => ({
        _id: user._id,
        fullName: user.fullName || user.username || user.email?.split("@")[0] || "User",
        email: user.email,
        profilePic: user.profilePic || user.avatar || "",
        points: user.points || user.totalPoints || 0,
        badges: user.badges || (user.earlyUserBadge ? [user.earlyUserBadge] : []),
        chatCount: user.chatCount || user.totalChats || 0,
        isAdmin: user.isAdmin || false,
      }));
      return res.status(200).json(normalizedUsers);
    }

    // Search only within friends
    const searchRegex = new RegExp(q, "i");
    const users = await User.find({
      _id: { $in: friendIds },
      $or: [
        { fullName: searchRegex },
        { username: searchRegex },
        { email: searchRegex },
      ],
    })
      .select("-password")
      .limit(20);

    // Normalize user data for frontend
    const normalizedUsers = users.map((user) => ({
      _id: user._id,
      fullName: user.fullName || user.username || user.email?.split("@")[0] || "User",
      email: user.email,
      profilePic: user.profilePic || user.avatar || "",
      points: user.points || user.totalPoints || 0,
      badges: user.badges || (user.earlyUserBadge ? [user.earlyUserBadge] : []),
      chatCount: user.chatCount || user.totalChats || 0,
      isAdmin: user.isAdmin || false,
    }));

    res.status(200).json(normalizedUsers);
  } catch (error) {
    console.log("Error in search controller:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;

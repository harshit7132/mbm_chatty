import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import User from "../models/user.model.js";
import Message from "../models/message.model.js";

const router = express.Router();

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

// Get dashboard stats
router.get("/dashboard", protectRoute, isAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalMessages = await Message.countDocuments();
    
    res.status(200).json({
      totalUsers,
      totalMessages,
      activeUsers: totalUsers, // Placeholder
    });
  } catch (error) {
    console.log("Error in getDashboardStats:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get all users
router.get("/users", protectRoute, isAdmin, async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (error) {
    console.log("Error in getAllUsers:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Delete user
router.delete("/users/:userId", protectRoute, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    await User.findByIdAndDelete(userId);
    res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.log("Error in deleteUser:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Make user admin
router.post("/users/:userId/make-admin", protectRoute, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    await User.findByIdAndUpdate(userId, { isAdmin: true });
    res.status(200).json({ message: "User made admin successfully" });
  } catch (error) {
    console.log("Error in makeAdmin:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;


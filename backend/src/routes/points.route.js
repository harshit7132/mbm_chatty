import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import User from "../models/user.model.js";

const router = express.Router();

// Get user's points
router.get("/my-points", protectRoute, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("points totalPoints pointsHistory");
    // Use points or totalPoints as fallback
    const userPoints = user?.points ?? user?.totalPoints ?? 0;
    res.status(200).json({
      points: userPoints,
      history: user?.pointsHistory || [],
    });
  } catch (error) {
    console.log("Error in getMyPoints:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Award time-based points
router.post("/award-time", protectRoute, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Award points for time spent (example: 10 points per hour)
    const pointsToAward = 10;
    user.points = (user.points || 0) + pointsToAward;
    user.pointsHistory = user.pointsHistory || [];
    user.pointsHistory.push({
      type: "time-based",
      amount: pointsToAward,
      timestamp: new Date(),
    });
    await user.save();

    res.status(200).json({ message: "Points awarded", points: user.points });
  } catch (error) {
    console.log("Error in awardTimePoints:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Spend points
router.post("/spend", protectRoute, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentPoints = user.points || 0;
    if (currentPoints < amount) {
      return res.status(400).json({ message: "Insufficient points" });
    }

    user.points = currentPoints - amount;
    user.pointsSpent = (user.pointsSpent || 0) + amount; // Update pointsSpent for leaderboard
    user.pointsHistory = user.pointsHistory || [];
    user.pointsHistory.push({
      type: "spent",
      amount: -amount,
      description: `Spent ${amount} points`,
      timestamp: new Date(),
    });
    await user.save();

    res.status(200).json({ points: user.points, message: "Points spent successfully" });
  } catch (error) {
    console.log("Error in spendPoints:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;


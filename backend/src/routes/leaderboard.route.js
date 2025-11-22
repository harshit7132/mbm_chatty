import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import User from "../models/user.model.js";

const router = express.Router();

// Get leaderboard by type
router.get("/:type", protectRoute, async (req, res) => {
  try {
    const { type } = req.params;
    let leaderboard = [];

    switch (type) {
      case "badges":
        leaderboard = await User.find({
          $or: [
            { badges: { $exists: true, $ne: [] } },
            { earlyUserBadge: { $exists: true, $ne: null } }
          ]
        })
          .select("fullName username email profilePic avatar badges earlyUserBadge")
          .limit(100);
        leaderboard = leaderboard.map((user) => {
          const badgeCount = (user.badges?.length || 0) + (user.earlyUserBadge ? 1 : 0);
          return {
            _id: user._id,
            fullName: user.fullName || user.username || user.email?.split("@")[0] || "User",
            email: user.email,
            profilePic: user.profilePic || user.avatar || "",
            badges: user.badges || (user.earlyUserBadge ? [user.earlyUserBadge] : []),
            score: badgeCount,
          };
        }).sort((a, b) => b.score - a.score);
        break;

      case "chats":
        leaderboard = await User.find()
          .select("fullName username email profilePic avatar chatCount totalChats")
          .limit(100);
        leaderboard = leaderboard.map((user) => {
          const chatCount = user.chatCount || user.totalChats || 0;
          return {
            _id: user._id,
            fullName: user.fullName || user.username || user.email?.split("@")[0] || "User",
            email: user.email,
            profilePic: user.profilePic || user.avatar || "",
            score: chatCount,
          };
        }).sort((a, b) => b.score - a.score);
        break;

      case "points-earned":
        leaderboard = await User.find()
          .select("fullName username email profilePic avatar points totalPoints")
          .limit(100);
        leaderboard = leaderboard.map((user) => {
          const points = user.points || user.totalPoints || 0;
          return {
            _id: user._id,
            fullName: user.fullName || user.username || user.email?.split("@")[0] || "User",
            email: user.email,
            profilePic: user.profilePic || user.avatar || "",
            score: points,
          };
        }).sort((a, b) => b.score - a.score);
        break;

      case "points-spent":
        leaderboard = await User.find({
          $or: [
            { "pointsHistory.type": "spent" },
            { pointsSpent: { $exists: true, $gt: 0 } }
          ]
        })
          .select("fullName username email profilePic avatar pointsHistory pointsSpent")
          .limit(100);
        leaderboard = leaderboard
          .map((user) => {
            let spent = user.pointsSpent || 0;
            if (user.pointsHistory && user.pointsHistory.length > 0) {
              const historySpent = user.pointsHistory
                .filter((h) => h.type === "spent")
                .reduce((sum, h) => sum + Math.abs(h.amount || 0), 0);
              spent = Math.max(spent, historySpent);
            }
            return {
              _id: user._id,
              fullName: user.fullName || user.username || user.email?.split("@")[0] || "User",
              email: user.email,
              profilePic: user.profilePic || user.avatar || "",
              score: spent,
            };
          })
          .sort((a, b) => b.score - a.score);
        break;

      default:
        return res.status(400).json({ message: "Invalid leaderboard type" });
    }

    res.status(200).json(leaderboard);
  } catch (error) {
    console.log("Error in getLeaderboard:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;


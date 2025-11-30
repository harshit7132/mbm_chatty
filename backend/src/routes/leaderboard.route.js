import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import User from "../models/user.model.js";
import UserChallenge from "../models/userChallenge.model.js";

const router = express.Router();

// Get leaderboard by type
router.get("/:type", protectRoute, async (req, res) => {
  try {
    const { type } = req.params;
    let leaderboard = [];

    switch (type) {
      case "badges":
        // Get all users and calculate their badge count
        leaderboard = await User.find({})
          .select("fullName username email profilePic avatar badges earlyUserBadge")
          .limit(50);
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
          .limit(50);
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
          .limit(50);
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
        // Get all users who have spent points (from pointsSpent field or pointsHistory)
        leaderboard = await User.find({
          $or: [
            { "pointsHistory.type": { $in: ["spent", "challenge_attempt"] } },
            { pointsSpent: { $exists: true, $gt: 0 } }
          ]
        })
          .select("fullName username email profilePic avatar pointsHistory pointsSpent")
          .limit(50);
        
        leaderboard = leaderboard
          .map((user) => {
            // Start with pointsSpent field (most accurate, updated in real-time)
            let spent = user.pointsSpent || 0;
            
            // Also calculate from pointsHistory to catch any discrepancies
            if (user.pointsHistory && user.pointsHistory.length > 0) {
              // Calculate from all spending types: "spent" and "challenge_attempt"
              const historySpent = user.pointsHistory
                .filter((h) => h.type === "spent" || h.type === "challenge_attempt")
                .reduce((sum, h) => {
                  // Use absolute value since amounts can be negative
                  const amount = Math.abs(h.amount || 0);
                  return sum + amount;
                }, 0);
              
              // Use the maximum of pointsSpent and calculated history (ensures accuracy)
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
          .filter((user) => user.score > 0) // Only include users who have spent points
          .sort((a, b) => b.score - a.score);
        break;

      case "challenges-completed":
        // Use MongoDB aggregation pipeline to efficiently count completed challenges per user
        // and join with User collection in a single query
        const completedChallengesAgg = await UserChallenge.aggregate([
          {
            // Match only completed challenges
            $match: {
              completed: true
            }
          },
          {
            // Group by userId and count completed challenges
            $group: {
              _id: "$userId",
              completedCount: { $sum: 1 }
            }
          },
          {
            // Sort by completed count (descending)
            $sort: { completedCount: -1 }
          },
          {
            // Limit to top 50 users
            $limit: 50
          },
          {
            // Lookup user details from User collection
            $lookup: {
              from: "users",
              localField: "_id",
              foreignField: "_id",
              as: "userDetails"
            }
          },
          {
            // Unwind the userDetails array (should be single element)
            $unwind: {
              path: "$userDetails",
              preserveNullAndEmptyArrays: false // Only include users that exist
            }
          },
          {
            // Project the final structure
            $project: {
              _id: "$userDetails._id",
              fullName: {
                $ifNull: [
                  "$userDetails.fullName",
                  {
                    $ifNull: [
                      "$userDetails.username",
                      {
                        $ifNull: [
                          { $arrayElemAt: [{ $split: ["$userDetails.email", "@"] }, 0] },
                          "User"
                        ]
                      }
                    ]
                  }
                ]
              },
              email: "$userDetails.email",
              profilePic: {
                $ifNull: [
                  "$userDetails.profilePic",
                  "$userDetails.avatar"
                ]
              },
              score: "$completedCount"
            }
          }
        ]);

        leaderboard = completedChallengesAgg;
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
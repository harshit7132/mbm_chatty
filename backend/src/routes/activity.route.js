import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import User from "../models/user.model.js";

const router = express.Router();

// Track user activity (called when user is active for 5+ minutes)
router.post("/track", protectRoute, async (req, res) => {
  try {
    const userId = req.user._id;
    const { minutes = 5 } = req.body; // Default 5 minutes

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!user.dailyActivity) {
      user.dailyActivity = [];
    }

    // Find or create today's activity
    let todayActivity = user.dailyActivity.find(activity => {
      const activityDate = new Date(activity.date);
      activityDate.setHours(0, 0, 0, 0);
      return activityDate.getTime() === today.getTime();
    });

    if (todayActivity) {
      // Update existing activity - accumulate minutes
      const previousMinutes = todayActivity.activeMinutes || 0;
      todayActivity.activeMinutes = previousMinutes + minutes; // Add to existing minutes
      const wasActive = todayActivity.isActive;
      todayActivity.isActive = todayActivity.activeMinutes >= 5; // Active if 5+ minutes total
      
      // Update consecutiveDaysActive if user became active today (crossed 5-minute threshold)
      if (!wasActive && todayActivity.isActive) {
        // Check yesterday's activity
        const yesterday = new Date(today);
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
    } else {
      // Create new activity entry
      todayActivity = {
        date: today,
        loginTime: new Date(),
        activeMinutes: minutes,
        isActive: minutes >= 5,
      };
      user.dailyActivity.push(todayActivity);
      
      // Update consecutiveDaysActive if user is active today (5+ minutes)
      if (todayActivity.isActive) {
        // Check yesterday's activity
        const yesterday = new Date(today);
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
    }

    // Check for 5-day streak milestone reward (5, 10, 15, 20, etc.)
    const currentStreak = user.consecutiveDaysActive || 0;
    const lastMilestone = user.lastStreakRewardMilestone || 0;
    let receivedReward = false;
    
    if (currentStreak > 0 && currentStreak % 5 === 0 && currentStreak > lastMilestone) {
      // User reached a new 5-day milestone (5, 10, 15, 20, etc.)
      const rewardPoints = 3;
      user.points = (user.points || 0) + rewardPoints;
      user.totalPoints = (user.totalPoints || 0) + rewardPoints;
      user.lastStreakRewardMilestone = currentStreak;
      receivedReward = true;
      
      // Add to points history
      user.pointsHistory.push({
        type: "earned",
        amount: rewardPoints,
        description: `${currentStreak}-day activity streak reward`,
        timestamp: new Date(),
      });
    }

    await user.save();

    // Emit socket event for real-time points update if reward was given
    if (receivedReward) {
      if (req.app.get("io")) {
        req.app.get("io").to(userId.toString()).emit("points-updated", { 
          points: user.points,
          streak: currentStreak,
          streakReward: 3,
        });
      }
    }

    res.status(200).json({
      message: "Activity tracked",
      activeMinutes: todayActivity.activeMinutes,
      isActive: todayActivity.isActive,
      consecutiveDaysActive: currentStreak,
      streakReward: receivedReward ? 3 : 0,
      nextMilestone: Math.ceil((currentStreak + 1) / 5) * 5, // Next 5-day milestone
    });
  } catch (error) {
    console.error("Error tracking activity:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get user's activity stats
router.get("/stats", protectRoute, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).select("dailyActivity loginStreak lastLoginDate");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get today's activity
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayActivity = user.dailyActivity?.find(activity => {
      const activityDate = new Date(activity.date);
      activityDate.setHours(0, 0, 0, 0);
      return activityDate.getTime() === today.getTime();
    });

    // Count active days in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const recentActivity = user.dailyActivity?.filter(activity => {
      const activityDate = new Date(activity.date);
      return activityDate >= thirtyDaysAgo && activity.isActive;
    }) || [];

    res.status(200).json({
      loginStreak: user.loginStreak || 0,
      lastLoginDate: user.lastLoginDate || null,
      todayActivity: todayActivity ? {
        activeMinutes: todayActivity.activeMinutes || 0,
        isActive: todayActivity.isActive || false,
      } : null,
      activeDaysLast30Days: recentActivity.length,
      totalActiveDays: user.dailyActivity?.filter(a => a.isActive).length || 0,
    });
  } catch (error) {
    console.error("Error fetching activity stats:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;


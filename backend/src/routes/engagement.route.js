import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import User from "../models/user.model.js";
import crypto from "crypto";

const router = express.Router();

// Daily login reward
router.post("/daily-login", protectRoute, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastLogin = user.lastLoginDate ? new Date(user.lastLoginDate) : null;
    if (lastLogin) {
      lastLogin.setHours(0, 0, 0, 0);
    }

    // Check if already claimed today
    if (lastLogin && lastLogin.getTime() === today.getTime()) {
      return res.status(400).json({ 
        message: "Daily login reward already claimed today",
        alreadyClaimed: true,
        loginStreak: user.loginStreak || 0,
      });
    }

    // Calculate streak
    let newStreak = 1;
    if (lastLogin) {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (lastLogin.getTime() === yesterday.getTime()) {
        // Consecutive day - increment streak
        newStreak = (user.loginStreak || 0) + 1;
      } else {
        // Streak broken - reset to 1
        newStreak = 1;
      }
    }

    // Calculate daily reward based on streak
    // Base: 10 points, +5 for each day of streak (max 50 points)
    const baseReward = 10;
    const streakBonus = Math.min((newStreak - 1) * 5, 40);
    const dailyReward = baseReward + streakBonus;

    // Update user
    user.loginStreak = newStreak;
    user.lastLoginDate = new Date();
    user.totalLogins = (user.totalLogins || 0) + 1;
    user.points = (user.points || 0) + dailyReward;
    user.totalPoints = (user.totalPoints || 0) + dailyReward;
    
    user.pointsHistory.push({
      type: "earned",
      amount: dailyReward,
      description: `Daily login reward (${newStreak} day streak)`,
      timestamp: new Date(),
    });

    // Track daily activity (claiming daily reward counts as activity)
    // Reuse 'today' variable already declared above (line 18)
    if (!user.dailyActivity) {
      user.dailyActivity = [];
    }

    // Check if today's activity already exists
    const todayActivity = user.dailyActivity.find(activity => {
      const activityDate = new Date(activity.date);
      activityDate.setHours(0, 0, 0, 0);
      return activityDate.getTime() === today.getTime();
    });

    if (todayActivity) {
      // Update existing activity
      todayActivity.loginTime = new Date();
      todayActivity.isActive = true;
      if (todayActivity.activeMinutes < 5) {
        todayActivity.activeMinutes = 5;
      }
    } else {
      // Create new activity entry
      user.dailyActivity.push({
        date: today,
        loginTime: new Date(),
        activeMinutes: 5,
        isActive: true,
      });
    }

    await user.save();

    // Emit socket event for real-time points update
    if (req.app.get("io")) {
      req.app.get("io").to(userId.toString()).emit("points-updated", { 
        points: user.points,
        streak: newStreak,
      });
    }

    res.status(200).json({
      message: "Daily login reward claimed",
      reward: dailyReward,
      streak: newStreak,
      points: user.points,
      nextReward: baseReward + Math.min(newStreak * 5, 40),
    });
  } catch (error) {
    console.error("Error claiming daily login reward:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get user engagement stats
router.get("/stats", protectRoute, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "loginStreak lastLoginDate totalLogins referralCode referrals referralPoints achievements activityMultiplier multiplierExpiresAt"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if daily login can be claimed
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastLogin = user.lastLoginDate ? new Date(user.lastLoginDate) : null;
    if (lastLogin) {
      lastLogin.setHours(0, 0, 0, 0);
    }
    const canClaimDaily = !lastLogin || lastLogin.getTime() !== today.getTime();

    res.status(200).json({
      loginStreak: user.loginStreak || 0,
      totalLogins: user.totalLogins || 0,
      canClaimDaily,
      referralCode: user.referralCode || null,
      totalReferrals: user.referrals?.length || 0,
      referralPoints: user.referralPoints || 0,
      achievements: user.achievements || [],
      activityMultiplier: user.activityMultiplier || 1.0,
      multiplierExpiresAt: user.multiplierExpiresAt || null,
    });
  } catch (error) {
    console.error("Error fetching engagement stats:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Create or update referral code (user can set their own)
router.post("/referral/create", protectRoute, async (req, res) => {
  try {
    const { referralCode } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!referralCode || referralCode.trim().length === 0) {
      return res.status(400).json({ message: "Referral code is required" });
    }

    // Validate referral code format (3-20 alphanumeric characters, case insensitive)
    const codeRegex = /^[A-Z0-9]{3,20}$/i;
    if (!codeRegex.test(referralCode.trim())) {
      return res.status(400).json({ 
        message: "Referral code must be 3-20 alphanumeric characters (letters and numbers only)" 
      });
    }

    const normalizedCode = referralCode.trim().toUpperCase();

    // Check if code is already taken by another user
    const existingUser = await User.findOne({ 
      referralCode: normalizedCode,
      _id: { $ne: user._id } // Exclude current user
    });

    if (existingUser) {
      return res.status(400).json({ message: "This referral code is already taken. Please choose another one." });
    }

    // Update user's referral code
    user.referralCode = normalizedCode;
    await user.save();

    res.status(200).json({
      message: "Referral code created successfully",
      referralCode: user.referralCode,
      referralUrl: `${process.env.FRONTEND_URL || "http://localhost:5173"}/signup?ref=${user.referralCode}`,
    });
  } catch (error) {
    console.error("Error creating referral code:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get user's referral code
router.get("/referral", protectRoute, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("referralCode referrals referralPoints");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      referralCode: user.referralCode || null,
      referralUrl: user.referralCode 
        ? `${process.env.FRONTEND_URL || "http://localhost:5173"}/signup?ref=${user.referralCode}`
        : null,
      totalReferrals: user.referrals?.length || 0,
      referralPoints: user.referralPoints || 0,
    });
  } catch (error) {
    console.error("Error fetching referral code:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Apply referral code (during signup)
router.post("/referral/apply", async (req, res) => {
  try {
    const { referralCode, userId } = req.body;

    if (!referralCode || !userId) {
      return res.status(400).json({ message: "Referral code and user ID are required" });
    }

    const referrer = await User.findOne({ referralCode });
    if (!referrer) {
      return res.status(404).json({ message: "Invalid referral code" });
    }

    const newUser = await User.findById(userId);
    if (!newUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user was already referred
    if (newUser.referredBy) {
      return res.status(400).json({ message: "User already has a referrer" });
    }

    // Check if referring themselves
    if (referrer._id.toString() === userId) {
      return res.status(400).json({ message: "Cannot refer yourself" });
    }

    // Apply referral
    newUser.referredBy = referrer._id;
    
    // Add to referrer's referrals list
    if (!referrer.referrals) {
      referrer.referrals = [];
    }
    referrer.referrals.push(newUser._id);

    // Reward referrer (50 points)
    const referrerReward = 50;
    referrer.points = (referrer.points || 0) + referrerReward;
    referrer.totalPoints = (referrer.totalPoints || 0) + referrerReward;
    referrer.referralPoints = (referrer.referralPoints || 0) + referrerReward;
    referrer.pointsHistory.push({
      type: "earned",
      amount: referrerReward,
      description: `Referral reward: ${newUser.email}`,
      timestamp: new Date(),
    });

    // Reward new user (25 points)
    const newUserReward = 25;
    newUser.points = (newUser.points || 0) + newUserReward;
    newUser.totalPoints = (newUser.totalPoints || 0) + newUserReward;
    newUser.pointsHistory.push({
      type: "earned",
      amount: newUserReward,
      description: `Signup with referral code`,
      timestamp: new Date(),
    });

    await referrer.save();
    await newUser.save();

    // Emit socket events
    if (req.app.get("io")) {
      req.app.get("io").to(referrer._id.toString()).emit("points-updated", { 
        points: referrer.points,
      });
      req.app.get("io").to(newUser._id.toString()).emit("points-updated", { 
        points: newUser.points,
      });
    }

    res.status(200).json({
      message: "Referral code applied successfully",
      referrerReward,
      newUserReward,
    });
  } catch (error) {
    console.error("Error applying referral code:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Activate activity multiplier (bonus points for 1 hour)
router.post("/multiplier/activate", protectRoute, async (req, res) => {
  try {
    const { multiplier = 1.5, durationHours = 1 } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Validate multiplier (1.0 to 3.0)
    const validMultiplier = Math.max(1.0, Math.min(3.0, multiplier));
    const validDuration = Math.max(0.5, Math.min(24, durationHours));

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + validDuration);

    user.activityMultiplier = validMultiplier;
    user.multiplierExpiresAt = expiresAt;

    await user.save();

    res.status(200).json({
      message: "Activity multiplier activated",
      multiplier: validMultiplier,
      expiresAt,
      durationHours: validDuration,
    });
  } catch (error) {
    console.error("Error activating multiplier:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;


import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import User from "../models/user.model.js";

const router = express.Router();

// Get user's privacy settings
router.get("/settings", protectRoute, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("privacySettings");
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Return default settings if not set
    const privacySettings = user.privacySettings || {
      profileVisibility: "public",
      onlineStatusVisibility: "everyone",
      lastSeenVisibility: "everyone",
      friendRequestPrivacy: "everyone",
      showInSearch: true,
      showInLeaderboard: true,
      showPoints: true,
      readReceipts: true,
    };

    res.status(200).json({ privacySettings });
  } catch (error) {
    console.error("Error fetching privacy settings:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Update privacy settings
router.put("/settings", protectRoute, async (req, res) => {
  try {
    const {
      profileVisibility,
      onlineStatusVisibility,
      lastSeenVisibility,
      friendRequestPrivacy,
      showInSearch,
      showInLeaderboard,
      showPoints,
      readReceipts,
    } = req.body;

    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Initialize privacySettings if it doesn't exist
    if (!user.privacySettings) {
      user.privacySettings = {};
    }

    // Update only provided fields
    if (profileVisibility !== undefined) {
      if (!["public", "friends", "private"].includes(profileVisibility)) {
        return res.status(400).json({ message: "Invalid profileVisibility value" });
      }
      user.privacySettings.profileVisibility = profileVisibility;
    }

    if (onlineStatusVisibility !== undefined) {
      if (!["everyone", "friends", "nobody"].includes(onlineStatusVisibility)) {
        return res.status(400).json({ message: "Invalid onlineStatusVisibility value" });
      }
      user.privacySettings.onlineStatusVisibility = onlineStatusVisibility;
    }

    if (lastSeenVisibility !== undefined) {
      if (!["everyone", "friends", "nobody"].includes(lastSeenVisibility)) {
        return res.status(400).json({ message: "Invalid lastSeenVisibility value" });
      }
      user.privacySettings.lastSeenVisibility = lastSeenVisibility;
    }

    if (friendRequestPrivacy !== undefined) {
      if (!["everyone", "friends_of_friends", "nobody"].includes(friendRequestPrivacy)) {
        return res.status(400).json({ message: "Invalid friendRequestPrivacy value" });
      }
      user.privacySettings.friendRequestPrivacy = friendRequestPrivacy;
    }

    if (showInSearch !== undefined) {
      user.privacySettings.showInSearch = Boolean(showInSearch);
    }

    if (showInLeaderboard !== undefined) {
      user.privacySettings.showInLeaderboard = Boolean(showInLeaderboard);
    }

    if (showPoints !== undefined) {
      user.privacySettings.showPoints = Boolean(showPoints);
    }

    if (readReceipts !== undefined) {
      user.privacySettings.readReceipts = Boolean(readReceipts);
    }

    await user.save();

    res.status(200).json({
      message: "Privacy settings updated successfully",
      privacySettings: user.privacySettings,
    });
  } catch (error) {
    console.error("Error updating privacy settings:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Block a user
router.post("/block/:userId", protectRoute, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    if (userId === currentUserId.toString()) {
      return res.status(400).json({ message: "Cannot block yourself" });
    }

    const user = await User.findById(currentUserId);
    const userToBlock = await User.findById(userId);

    if (!user || !userToBlock) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if already blocked
    if (user.blockedUsers && user.blockedUsers.includes(userId)) {
      return res.status(400).json({ message: "User is already blocked" });
    }

    // Add to blocked list
    if (!user.blockedUsers) {
      user.blockedUsers = [];
    }
    user.blockedUsers.push(userId);

    // Remove from friends if they are friends
    if (user.friends && user.friends.includes(userId)) {
      user.friends = user.friends.filter(
        (id) => id.toString() !== userId
      );
    }

    // Remove from friend requests
    if (user.friendRequests) {
      user.friendRequests = user.friendRequests.filter(
        (req) => req.from.toString() !== userId
      );
    }

    await user.save();

    res.status(200).json({ message: "User blocked successfully" });
  } catch (error) {
    console.error("Error blocking user:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Unblock a user
router.post("/unblock/:userId", protectRoute, async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;

    const user = await User.findById(currentUserId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.blockedUsers || !user.blockedUsers.includes(userId)) {
      return res.status(400).json({ message: "User is not blocked" });
    }

    // Remove from blocked list
    user.blockedUsers = user.blockedUsers.filter(
      (id) => id.toString() !== userId
    );

    await user.save();

    res.status(200).json({ message: "User unblocked successfully" });
  } catch (error) {
    console.error("Error unblocking user:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get blocked users list
router.get("/blocked", protectRoute, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("blockedUsers")
      .populate("blockedUsers", "fullName username email profilePic avatar");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const blockedUsers = (user.blockedUsers || []).map((blockedUser) => ({
      _id: blockedUser._id,
      fullName: blockedUser.fullName || blockedUser.username || blockedUser.email?.split("@")[0] || "User",
      email: blockedUser.email,
      profilePic: blockedUser.profilePic || blockedUser.avatar || "",
    }));

    res.status(200).json({ blockedUsers });
  } catch (error) {
    console.error("Error fetching blocked users:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;


import Challenge from "../models/challenge.model.js";
import User from "../models/user.model.js";

// Refresh daily challenges
const refreshDailyChallenges = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    
    // Check if user has enough points
    if (user.points < 4) {
      return res.status(400).json({
        success: false,
        message: "Not enough points. You need 4 points to refresh challenges."
      });
    }
    
    // Deduct points
    user.points -= 4;
    await user.save();
    
    // Reset daily challenges
    await Challenge.updateMany(
      { user: userId, type: "daily", completed: false },
      { $set: { current: 0 } }
    );
    
    // Get updated challenges
    const challenges = await Challenge.find({ user: userId });
    
    // Emit socket event for real-time update
    if (req.app.get("io")) {
      req.app.get("io").to(userId.toString()).emit("challenge-updated", challenges);
    }
    
    res.status(200).json({
      success: true,
      message: "Daily challenges refreshed!",
      challenges
    });
  } catch (error) {
    console.error("Error refreshing daily challenges:", error);
    res.status(500).json({
      success: false,
      message: "Failed to refresh daily challenges"
    });
  }
};

export {
  refreshDailyChallenges
};

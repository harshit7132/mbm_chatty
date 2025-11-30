import UserChallenge from "../models/userChallenge.model.js";
import User from "../models/user.model.js";

/**
 * Reverse challenge rewards when user deletes messages that affect challenge progress
 * @param {String} userId - User ID
 * @param {Number} deletedCount - Number of messages deleted
 * @returns {Object} - Object containing affected challenges and total points revoked
 */
export const reverseChallengeRewards = async (userId, deletedCount = 1) => {
  try {
    console.log(`Checking challenge reversals for user ${userId} after deleting ${deletedCount} messages`);
    
    // Get all challenges for this user
    const challenges = await UserChallenge.find({
      $or: [
        { userId: userId },
        { userId: userId.toString() }
      ]
    });

    const affectedChallenges = [];
    let totalPointsRevoked = 0;
    const revokedBadges = [];

    for (const challenge of challenges) {
      const title = (challenge.title || "").toLowerCase();
      const description = (challenge.description || "").toLowerCase();
      
      // Check if this challenge is related to messages
      const isMessageChallenge = title.includes("message") || title.includes("send") || 
                                  title.includes("text") || title.includes("chat") ||
                                  description.includes("message") || description.includes("send") ||
                                  description.includes("chat");

      if (!isMessageChallenge) continue;

      // Calculate new progress after deletion
      const newCurrent = Math.max(0, (challenge.current || 0) - deletedCount);
      
      // For lifetime challenges with stages, check each stage
      if (challenge.type === "lifetime" && challenge.stages && challenge.stages.length > 0) {
        // Find which stage the user was at
        let currentStageIndex = challenge.stage - 1; // stage is 1-indexed
        let stagePointsRevoked = 0;
        let stageBadgeRevoked = null;
        
        // Check if deletion would affect any completed stages
        // Only reverse if completed within last 5 minutes
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const wasCompletedRecently = challenge.completedAt && new Date(challenge.completedAt) >= fiveMinutesAgo;
        
        for (let i = currentStageIndex; i >= 0; i--) {
          const stage = challenge.stages[i];
          if (newCurrent < stage.target && challenge.current >= stage.target) {
            // Only reverse if challenge was completed within last 5 minutes
            if (wasCompletedRecently) {
              // This stage would become incomplete
              stagePointsRevoked += stage.reward?.points || 0;
              if (stage.reward?.badge) {
                stageBadgeRevoked = stage.reward.badge;
              }
              
              // Update stage tracking
              if (i === currentStageIndex) {
                challenge.stage = Math.max(1, i); // Don't go below stage 1
              }
            } else {
              // Challenge completed more than 5 minutes ago - just update progress, don't reverse
              console.log(`⚠️ Challenge "${challenge.title}" completed more than 5 minutes ago, not reversing rewards`);
            }
          }
        }
        
        if (stagePointsRevoked > 0 || stageBadgeRevoked) {
          totalPointsRevoked += stagePointsRevoked;
          
          // Remove points from user (save to MongoDB)
          if (stagePointsRevoked > 0) {
            await User.findByIdAndUpdate(userId, {
              $inc: { 
                points: -stagePointsRevoked,
                totalPoints: -stagePointsRevoked 
              },
              $push: {
                pointsHistory: {
                  type: "challenge",
                  amount: -stagePointsRevoked,
                  description: `Challenge reward revoked: ${challenge.title} (message deletion)`,
                  timestamp: new Date(),
                },
              },
            });
            console.log(`💾 Updated user points in MongoDB: -${stagePointsRevoked} points for user ${userId}`);
          }
          
          // Remove badge if it was awarded
          if (stageBadgeRevoked) {
            revokedBadges.push(stageBadgeRevoked);
            await User.findByIdAndUpdate(userId, {
              $pull: { badges: stageBadgeRevoked },
            });
          }
          
          // Update challenge progress
          challenge.current = newCurrent;
          if (newCurrent < challenge.target) {
            challenge.completed = false;
            challenge.completedAt = null;
          }
          
          // Save to MongoDB
          await challenge.save();
          console.log(`💾 Saved lifetime challenge "${challenge.title}" to MongoDB: current=${newCurrent}, stage=${challenge.stage}`);
          
          affectedChallenges.push({
            _id: challenge._id,
            title: challenge.title,
            pointsRevoked: stagePointsRevoked,
            badgeRevoked: stageBadgeRevoked,
          });
          
          console.log(`✅ Reversed lifetime challenge "${challenge.title}" stage: revoked ${stagePointsRevoked} points`);
        } else if (challenge.current > 0) {
          // Update progress even if no stage reversal
          challenge.current = newCurrent;
          await challenge.save();
        }
      } 
      // For regular challenges (daily or simple lifetime)
      else if (challenge.completed && newCurrent < challenge.target) {
        // Only reverse if completed within last 5 minutes
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const wasCompletedRecently = challenge.completedAt && new Date(challenge.completedAt) >= fiveMinutesAgo;
        
        if (!wasCompletedRecently) {
          console.log(`⚠️ Challenge "${challenge.title}" completed more than 5 minutes ago, not reversing rewards`);
          // Just update progress, don't reverse
          challenge.current = newCurrent;
          challenge.completed = false;
          challenge.completedAt = null;
          await challenge.save();
          continue;
        }
        
        console.log(`⚠️ Challenge "${challenge.title}" would become incomplete after deletion (completed recently)`);
        
        // Reverse the reward (only if completed within 5 minutes)
        if (challenge.reward?.points) {
          totalPointsRevoked += challenge.reward.points;
          
        // Remove points from user (save to MongoDB)
        await User.findByIdAndUpdate(userId, {
          $inc: { 
            points: -challenge.reward.points,
            totalPoints: -challenge.reward.points 
          },
          $push: {
            pointsHistory: {
              type: "challenge",
              amount: -challenge.reward.points,
              description: `Challenge reward revoked: ${challenge.title} (message deletion)`,
              timestamp: new Date(),
            },
          },
        });
        console.log(`💾 Updated user points in MongoDB: -${challenge.reward.points} points for user ${userId}`);
        }

        // Remove badge if it was awarded
        if (challenge.reward?.badge) {
          revokedBadges.push(challenge.reward.badge);
          await User.findByIdAndUpdate(userId, {
            $pull: { badges: challenge.reward.badge },
          });
        }

        // Reset challenge progress
        challenge.completed = false;
        challenge.completedAt = null;
        challenge.current = newCurrent;
        
        // Save to MongoDB
        await challenge.save();
        console.log(`💾 Saved challenge "${challenge.title}" to MongoDB: current=${newCurrent}, completed=false`);
        
        affectedChallenges.push({
          _id: challenge._id,
          title: challenge.title,
          pointsRevoked: challenge.reward?.points || 0,
          badgeRevoked: challenge.reward?.badge || null,
        });

        console.log(`✅ Reversed challenge "${challenge.title}": revoked ${challenge.reward?.points || 0} points`);
      } else if (challenge.current > 0) {
        // Update progress even if not completed (save to MongoDB)
        challenge.current = newCurrent;
        await challenge.save();
        console.log(`💾 Updated challenge "${challenge.title}" progress in MongoDB: ${newCurrent}/${challenge.target}`);
      }
    }

    return {
      affectedChallenges,
      totalPointsRevoked,
      revokedBadges,
      hasReversals: affectedChallenges.length > 0
    };
  } catch (error) {
    console.error("Error reversing challenge rewards:", error);
    return {
      affectedChallenges: [],
      totalPointsRevoked: 0,
      revokedBadges: [],
      hasReversals: false
    };
  }
};

/**
 * Update challenge progress when user performs an action
 * @param {String} userId - User ID
 * @param {String} actionType - Type of action: 'message', 'chat', 'time', etc.
 * @param {Number} increment - Amount to increment (default: 1)
 */
export const updateChallengeProgress = async (userId, actionType = "message", increment = 1) => {
  try {
    console.log(`Updating challenge progress for user ${userId}, action: ${actionType}, increment: ${increment}`);
    
    // Get all active challenges for this user
    // Since challenges are shared, we need to find challenges that match the user's userId OR are global
    // For now, let's update challenges where userId matches (if they exist) or update all if shared
    const challenges = await UserChallenge.find({
      $or: [
        { userId: userId },
        { userId: { $exists: false } } // Also handle challenges without userId (shared)
      ]
    });

    const updatedChallenges = [];

    for (const challenge of challenges) {
      // Skip if already completed
      if (challenge.completed) continue;

      // Check if challenge matches the action type based on title/description
      const title = challenge.title?.toLowerCase() || "";
      const description = challenge.description?.toLowerCase() || "";
      
      let shouldUpdate = false;

      // Match challenges based on action type and challenge description
      if (actionType === "message") {
        // Match challenges about messages
        if (title.includes("message") || title.includes("send") || 
            description.includes("message") || description.includes("send")) {
          shouldUpdate = true;
        }
      } else if (actionType === "chat") {
        // Match challenges about chats
        if (title.includes("chat") || description.includes("chat")) {
          shouldUpdate = true;
        }
      }

      // Also update if challenge category matches
      if (challenge.category === actionType || challenge.category === "messages" && actionType === "message") {
        shouldUpdate = true;
      }

      if (shouldUpdate) {
        // Increment current progress
        const newCurrent = Math.min((challenge.current || 0) + increment, challenge.target);
        challenge.current = newCurrent;

        // Check if challenge is completed
        if (newCurrent >= challenge.target && !challenge.completed) {
          challenge.completed = true;
          challenge.completedAt = new Date();

          // Award points if reward exists
          if (challenge.reward?.points) {
            await User.findByIdAndUpdate(userId, {
              $inc: { points: challenge.reward.points, totalPoints: challenge.reward.points },
              $push: {
                pointsHistory: {
                  type: "challenge",
                  amount: challenge.reward.points,
                  description: `Completed challenge: ${challenge.title}`,
                  timestamp: new Date(),
                },
              },
            });

            // Award badge if exists
            if (challenge.reward?.badge) {
              await User.findByIdAndUpdate(userId, {
                $addToSet: { badges: challenge.reward.badge },
              });
            }
          }
        }

        await challenge.save();
        updatedChallenges.push(challenge);
        console.log(`Updated challenge ${challenge.title}: ${challenge.current}/${challenge.target}`);
      }
    }

    return updatedChallenges;
  } catch (error) {
    console.error("Error updating challenge progress:", error);
    return [];
  }
};

/**
 * Update challenge progress for a specific user (user-specific progress on shared challenges)
 * Challenges are shared but each user has their own progress tracked separately
 * @param {String} userId - User ID whose progress should be updated
 * @param {String} actionType - Type of action: 'message', 'chat', etc.
 * @param {Number} increment - Amount to increment
 */
export const updateUserChallengeProgress = async (userId, actionType = "message", increment = 1) => {
  try {
    console.log(`Updating challenge progress for user ${userId}, action: ${actionType}, increment: ${increment}`);
    
    // Get this user's challenges (user-specific progress)
    const challenges = await UserChallenge.find({
      $or: [
        { userId: userId },
        { userId: userId.toString() }
      ]
    });

    const updatedChallenges = [];

    for (const challenge of challenges) {
      // Skip if already completed
      if (challenge.completed) continue;

      const title = (challenge.title || "").toLowerCase();
      const description = (challenge.description || "").toLowerCase();
      
      let shouldUpdate = false;

      // Match challenges based on action type and challenge content
      if (actionType === "message") {
        // Match challenges about messages - check title and description
        // Match: "message", "send", "text", "chat" (since sending messages is also chatting)
        if (title.includes("message") || title.includes("send") || title.includes("text") ||
            title.includes("chat") || description.includes("message") || 
            description.includes("send") || description.includes("chat")) {
          shouldUpdate = true;
        }
      } else if (actionType === "chat") {
        // Match challenges about chats
        if (title.includes("chat") || description.includes("chat") ||
            title.includes("message") || description.includes("message")) {
          shouldUpdate = true;
        }
      }

      if (shouldUpdate) {
        // Increment current progress (don't exceed target)
        const newCurrent = Math.min((challenge.current || 0) + increment, challenge.target);
        challenge.current = newCurrent;

        // Check if challenge is completed
        if (newCurrent >= challenge.target && !challenge.completed) {
          challenge.completed = true;
          challenge.completedAt = new Date();
          console.log(`🎉 Challenge completed for user ${userId}: ${challenge.title}`);
          
          // Award points if reward exists
          if (challenge.reward?.points) {
            await User.findByIdAndUpdate(userId, {
              $inc: { points: challenge.reward.points, totalPoints: challenge.reward.points },
              $push: {
                pointsHistory: {
                  type: "challenge",
                  amount: challenge.reward.points,
                  description: `Completed challenge: ${challenge.title}`,
                  timestamp: new Date(),
                },
              },
            });

            // Award badge if exists
            if (challenge.reward?.badge) {
              await User.findByIdAndUpdate(userId, {
                $addToSet: { badges: challenge.reward.badge },
              });
            }
          }
        }

        await challenge.save();
        updatedChallenges.push(challenge);
        console.log(`Updated challenge "${challenge.title}" for user ${userId}: ${challenge.current}/${challenge.target}`);
      }
    }

    console.log(`✅ Updated ${updatedChallenges.length} challenges for user ${userId}`);
    return updatedChallenges;
  } catch (error) {
    console.error("Error updating user challenge progress:", error);
    console.error("Error stack:", error.stack);
    return [];
  }
};


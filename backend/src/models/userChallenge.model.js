import mongoose from "mongoose";

const userChallengeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    challengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Challenge",
      required: false, // Optional for backward compatibility with old challenges
    },
    type: {
      type: String,
      enum: ["daily", "lifetime"],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    target: {
      type: Number,
      required: true,
    },
    current: {
      type: Number,
      default: 0,
    },
    reward: {
      points: {
        type: Number,
        default: 0,
      },
      badge: {
        type: String,
        default: null,
      },
    },
    stage: {
      type: Number,
      default: 1,
    },
    maxStages: {
      type: Number,
      default: 1,
    },
    stages: [
      {
        target: Number,
        reward: {
          points: Number,
          badge: String,
        },
      },
    ],
    completed: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    // Store challenge attempts for analytics
    attempts: [{
      attemptDate: {
        type: Date,
        default: Date.now,
      },
      correct: {
        type: Boolean,
        default: false,
      },
      answer: mongoose.Schema.Types.Mixed, // Store the answer submitted
      paid: {
        type: Boolean,
        default: false,
      },
      // AI verification data
      verifiedWithAI: {
        type: Boolean,
        default: false,
      },
      aiResponse: {
        type: String,
        default: null,
      },
      aiFeedback: {
        type: String,
        default: null,
      },
      // For quiz challenges
      correctCount: {
        type: Number,
        default: null,
      },
      totalQuestions: {
        type: Number,
        default: null,
      },
    }],
    // Store category from challenge template
    category: {
      type: String,
      default: "custom",
    },
  },
  { timestamps: true }
);

// Index for efficient queries
userChallengeSchema.index({ userId: 1, type: 1 });
userChallengeSchema.index({ userId: 1, challengeId: 1 });
// Index for completed challenges leaderboard query
userChallengeSchema.index({ completed: 1 });

// Use "challenges" as collection name to match existing MongoDB data
const UserChallenge = mongoose.model("UserChallenge", userChallengeSchema, "challenges");

export default UserChallenge;


import mongoose from "mongoose";

const groupChallengeSchema = new mongoose.Schema(
  {
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    challengeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Challenge",
      required: false, // Optional for backward compatibility
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
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    // Store challenge attempts for analytics
    attempts: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      attemptDate: {
        type: Date,
        default: Date.now,
      },
      correct: {
        type: Boolean,
        default: false,
      },
      answer: mongoose.Schema.Types.Mixed,
      paid: {
        type: Boolean,
        default: false,
      },
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
      correctCount: {
        type: Number,
        default: null,
      },
      totalQuestions: {
        type: Number,
        default: null,
      },
    }],
    category: {
      type: String,
      default: "custom",
    },
  },
  { timestamps: true }
);

// Index for efficient queries
groupChallengeSchema.index({ groupId: 1, type: 1 });
groupChallengeSchema.index({ groupId: 1, challengeId: 1 });
groupChallengeSchema.index({ completed: 1 });

const GroupChallenge = mongoose.model("GroupChallenge", groupChallengeSchema);

export default GroupChallenge;


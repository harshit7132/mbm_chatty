import mongoose from "mongoose";

const challengeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    type: {
      type: String,
      enum: ["daily", "lifetime"],
      required: true,
    },
    points: {
      type: Number,
      required: true,
      default: 0,
    },
    target: {
      type: Number,
      required: true,
      default: 1,
    },
    category: {
      type: String,
      enum: ["chat", "messages", "time", "streak", "custom", "trivia", "puzzle", "quiz", "coding"],
      default: "custom",
    },
    // Challenge type specific data
    challengeData: {
      // For trivia: { question, options: [], correctAnswer: number, explanation: "" }
      // For puzzle/riddle: { question, answer: "", hint: "" }
      // For quiz: { questions: [{ question, options: [], correctAnswer: number }], timeLimit: number }
      // For coding: { problem: "", starterCode: "", testCases: [], solution: "" }
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // For timed challenges
    timeLimit: {
      type: Number, // in seconds
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

const Challenge = mongoose.model("Challenge", challengeSchema);

export default Challenge;


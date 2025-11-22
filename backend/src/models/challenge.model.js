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
      enum: ["chat", "messages", "time", "streak", "custom"],
      default: "custom",
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


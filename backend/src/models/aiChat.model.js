import mongoose from "mongoose";

const aiChatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// Index for faster queries
aiChatSchema.index({ userId: 1, createdAt: -1 });

const AIChat = mongoose.model("AIChat", aiChatSchema);

export default AIChat;


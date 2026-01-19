import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Not required for group messages
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: false, // Not required for private messages
    },
    text: {
      type: String,
    },
    originalText: {
      type: String, // Store original message text
    },
    originalLang: {
      type: String, // 'en' or 'hi' - language of original message
      enum: ['en', 'hi', null],
      default: null,
    },
    image: {
      type: String,
    },
    images: {
      type: [String],
      default: [],
    },
    sticker: {
      type: String,
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    reactions: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        emoji: String,
      },
    ],
    // Call-related fields
    callType: {
      type: String,
      enum: ["video", "voice", null],
      default: null,
    },
    callDuration: {
      type: Number, // Duration in seconds
      default: null,
    },
    callStatus: {
      type: String,
      enum: ["started", "ended", "missed", null],
      default: null,
    },
    forwardedFromName: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;

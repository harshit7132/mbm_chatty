import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import User from "../models/user.model.js";
import Message from "../models/message.model.js";

const router = express.Router();

// Get or create chat
router.post("/get-or-create", protectRoute, async (req, res) => {
  try {
    const { userId } = req.body;
    const myId = req.user._id;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Check if chat already exists (has messages)
    const existingMessages = await Message.findOne({
      $or: [
        { senderId: myId, receiverId: userId },
        { senderId: userId, receiverId: myId },
      ],
    });

    if (existingMessages) {
      const otherUser = await User.findById(userId).select("-password");
      return res.status(200).json({
        _id: `chat_${myId}_${userId}`,
        participants: [myId, userId],
        otherUser,
      });
    }

    // Create new chat
    const otherUser = await User.findById(userId).select("-password");
    res.status(200).json({
      _id: `chat_${myId}_${userId}`,
      participants: [myId, userId],
      otherUser,
    });
  } catch (error) {
    console.log("Error in getOrCreateChat:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get my chats
router.get("/my-chats", protectRoute, async (req, res) => {
  try {
    const myId = req.user._id;

    // Get all unique users I've chatted with
    const messages = await Message.find({
      $or: [{ senderId: myId }, { receiverId: myId }],
    })
      .select("senderId receiverId")
      .sort({ createdAt: -1 });

    const userIds = new Set();
    messages.forEach((msg) => {
      if (msg.senderId.toString() !== myId.toString()) {
        userIds.add(msg.senderId.toString());
      }
      if (msg.receiverId.toString() !== myId.toString()) {
        userIds.add(msg.receiverId.toString());
      }
    });

    const users = await User.find({ _id: { $in: Array.from(userIds) } }).select("-password");

    const chats = users.map((user) => ({
      _id: `chat_${myId}_${user._id}`,
      participants: [myId, user._id],
      otherUser: user,
    }));

    res.status(200).json(chats);
  } catch (error) {
    console.log("Error in getMyChats:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get messages for a chat
router.get("/:chatId/messages", protectRoute, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { after } = req.query; // For syncing new messages
    const myId = req.user._id;

    // Extract userId from chatId (format: chat_myId_otherUserId)
    const parts = chatId.split("_");
    if (parts.length !== 3 || parts[0] !== "chat") {
      return res.status(400).json({ message: "Invalid chat ID" });
    }

    const otherUserId = parts[1] === myId.toString() ? parts[2] : parts[1];

    // Build query
    const query = {
      $or: [
        { senderId: myId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: myId },
      ],
    };

    // If 'after' parameter is provided, only get messages after that timestamp
    if (after) {
      try {
        const afterDate = new Date(after);
        query.createdAt = { $gt: afterDate };
      } catch (e) {
        // Invalid date, ignore the after parameter
      }
    }

    const messages = await Message.find(query)
      .populate("senderId", "fullName username email profilePic avatar")
      .populate("receiverId", "fullName username email profilePic avatar")
      .populate("replyTo")
      .sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Forward message
router.post("/forward", protectRoute, async (req, res) => {
  try {
    const { messageId, chatIds } = req.body;
    const myId = req.user._id;

    if (!messageId || !chatIds || !Array.isArray(chatIds)) {
      return res.status(400).json({ message: "Message ID and chat IDs are required" });
    }

    const originalMessage = await Message.findById(messageId);
    if (!originalMessage) {
      return res.status(404).json({ message: "Message not found" });
    }

    // Forward to each chat
    for (const chatId of chatIds) {
      const parts = chatId.split("_");
      if (parts.length === 3 && parts[0] === "chat") {
        const receiverId = parts[1] === myId.toString() ? parts[2] : parts[1];
        const forwardedMessage = new Message({
          senderId: myId,
          receiverId,
          text: originalMessage.text,
          image: originalMessage.image,
          forwardedFrom: originalMessage._id,
        });
        await forwardedMessage.save();
      }
    }

    res.status(200).json({ message: "Message forwarded successfully" });
  } catch (error) {
    console.log("Error in forwardMessage:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;


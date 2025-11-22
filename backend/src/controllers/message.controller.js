import User from "../models/user.model.js";
import Message from "../models/message.model.js";

import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    
    // Get the logged-in user to access their friends list
    const loggedInUser = await User.findById(loggedInUserId).select("friends");
    
    if (!loggedInUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Only return users who are in the logged-in user's friends list
    // If user has no friends, return empty array
    const friendIds = loggedInUser.friends || [];
    
    if (friendIds.length === 0) {
      return res.status(200).json([]);
    }

    // Find only users who are friends with the logged-in user
    const filteredUsers = await User.find({ 
      _id: { $in: friendIds } 
    }).select("-password");

    // Normalize user data for frontend compatibility
    const normalizedUsers = filteredUsers.map((user) => ({
      _id: user._id,
      fullName: user.fullName || user.username || user.email?.split("@")[0] || "User",
      email: user.email,
      profilePic: user.profilePic || user.avatar || "",
      points: user.points || user.totalPoints || 0,
      badges: user.badges || (user.earlyUserBadge ? [user.earlyUserBadge] : []),
      chatCount: user.chatCount || user.totalChats || 0,
      isAdmin: user.isAdmin || false,
    }));

    res.status(200).json(normalizedUsers);
  } catch (error) {
    console.error("Error in getUsersForSidebar: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    })
      .populate("senderId", "fullName username email profilePic avatar")
      .populate("receiverId", "fullName username email profilePic avatar")
      .populate("replyTo")
      .sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    let imageUrl;
    if (image) {
      // Upload base64 image to cloudinary
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
    });

    await newMessage.save();

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.log("Error in sendMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

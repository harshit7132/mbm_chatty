import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import { getReceiverSocketId, io } from "../lib/socket.js";

const router = express.Router();

// Sync friends based on chat history (for existing users)
router.post("/sync-friends", protectRoute, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find all users this user has chatted with
    const messages = await Message.find({
      $or: [
        { senderId: userId },
        { receiverId: userId },
      ],
    }).select("senderId receiverId");

    const chatPartners = new Set();
    messages.forEach((msg) => {
      if (msg.senderId.toString() !== userId.toString()) {
        chatPartners.add(msg.senderId.toString());
      }
      if (msg.receiverId && msg.receiverId.toString() !== userId.toString()) {
        chatPartners.add(msg.receiverId.toString());
      }
    });

    // Add all chat partners as friends
    if (!user.friends) user.friends = [];
    const currentFriends = user.friends.map(f => f.toString());
    
    let addedCount = 0;
    for (const partnerId of chatPartners) {
      if (!currentFriends.includes(partnerId)) {
        user.friends.push(partnerId);
        addedCount++;
      }
    }

    await user.save();

    // Also update the other users' friends lists
    for (const partnerId of chatPartners) {
      const partner = await User.findById(partnerId);
      if (partner) {
        if (!partner.friends) partner.friends = [];
        const partnerFriends = partner.friends.map(f => f.toString());
        if (!partnerFriends.includes(userId.toString())) {
          partner.friends.push(userId);
          await partner.save();
        }
      }
    }

    res.status(200).json({ 
      message: "Friends synced successfully",
      friendsAdded: addedCount,
      totalFriends: user.friends.length 
    });
  } catch (error) {
    console.log("Error in syncFriends:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get my friends
router.get("/my-friends", protectRoute, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate("friends", "fullName username email profilePic avatar")
      .select("friends");
    
    res.status(200).json({ friends: user?.friends || [] });
  } catch (error) {
    console.log("Error in getMyFriends:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Send friend request
router.post("/send-request/:userId", protectRoute, async (req, res) => {
  try {
    const fromUserId = req.user._id;
    const toUserId = req.params.userId;

    if (fromUserId.toString() === toUserId) {
      return res.status(400).json({ message: "Cannot send friend request to yourself" });
    }

    const fromUser = await User.findById(fromUserId);
    const toUser = await User.findById(toUserId);

    if (!toUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if already friends
    const isAlreadyFriend = fromUser.friends?.some(
      f => f.toString() === toUserId
    );
    if (isAlreadyFriend) {
      return res.status(400).json({ message: "Already friends" });
    }

    // Check if request already sent
    const requestExists = fromUser.sentFriendRequests?.some(
      r => r.toString() === toUserId
    );
    if (requestExists) {
      return res.status(400).json({ message: "Friend request already sent" });
    }

    // Check if there's a pending request from them
    const pendingRequest = toUser.friendRequests?.find(
      r => r.from.toString() === fromUserId.toString() && r.status === "pending"
    );
    if (pendingRequest) {
      return res.status(400).json({ message: "Friend request already pending" });
    }

    // Add to sent requests
    if (!fromUser.sentFriendRequests) fromUser.sentFriendRequests = [];
    fromUser.sentFriendRequests.push(toUserId);
    
    console.log("💾 Saving friend request - From User:", fromUserId, "To User:", toUserId);
    console.log("   From user sentFriendRequests before save:", fromUser.sentFriendRequests);
    
    try {
      await fromUser.save();
      console.log("✅ From user saved successfully");
    } catch (saveError) {
      console.error("❌ Error saving fromUser:", saveError);
      throw saveError;
    }

    // Add to received requests
    if (!toUser.friendRequests) toUser.friendRequests = [];
    toUser.friendRequests.push({
      from: fromUserId,
      status: "pending",
    });
    
    console.log("   To user friendRequests before save:", toUser.friendRequests);
    
    try {
      await toUser.save();
      console.log("✅ To user saved successfully");
      
      // Verify the save worked by fetching the user again
      const verifyUser = await User.findById(toUserId).select("friendRequests");
      console.log("🔍 Verification - To user friendRequests after save:", verifyUser.friendRequests);
    } catch (saveError) {
      console.error("❌ Error saving toUser:", saveError);
      throw saveError;
    }

    // Emit Socket.IO event to notify the receiver
    const receiverSocketId = getReceiverSocketId(toUserId.toString());
    if (receiverSocketId) {
      // Populate sender info for the notification
      const populatedFromUser = await User.findById(fromUserId)
        .select("fullName username email profilePic avatar");
      
      io.to(receiverSocketId).emit("new-friend-request", {
        from: populatedFromUser,
        status: "pending",
      });
      console.log("✅ Emitted new-friend-request to user:", toUserId, "socketId:", receiverSocketId);
    } else {
      console.log("⚠️ User not online, friend request saved but not notified:", toUserId);
    }

    // Final verification - fetch both users to confirm data was saved
    const finalFromUser = await User.findById(fromUserId).select("sentFriendRequests");
    const finalToUser = await User.findById(toUserId).select("friendRequests");
    
    console.log("🔍 Final verification:");
    console.log("   From user sentFriendRequests:", finalFromUser.sentFriendRequests);
    console.log("   To user friendRequests count:", finalToUser.friendRequests?.length || 0);
    console.log("   To user friendRequests:", JSON.stringify(finalToUser.friendRequests, null, 2));

    res.status(200).json({ 
      message: "Friend request sent successfully",
      saved: true,
      fromUserSentRequests: finalFromUser.sentFriendRequests?.length || 0,
      toUserReceivedRequests: finalToUser.friendRequests?.length || 0
    });
  } catch (error) {
    console.error("❌ Error in sendFriendRequest:", error);
    console.error("   Error message:", error.message);
    console.error("   Error stack:", error.stack);
    res.status(500).json({ 
      message: "Internal Server Error",
      error: error.message 
    });
  }
});

// Accept friend request
router.post("/accept-request/:userId", protectRoute, async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const fromUserId = req.params.userId;

    const currentUser = await User.findById(currentUserId);
    const fromUser = await User.findById(fromUserId);

    if (!fromUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find and update the friend request
    const request = currentUser.friendRequests?.find(
      r => r.from.toString() === fromUserId && r.status === "pending"
    );

    if (!request) {
      return res.status(400).json({ message: "Friend request not found" });
    }

    // Update request status
    request.status = "accepted";

    // Add to friends list (both ways)
    if (!currentUser.friends) currentUser.friends = [];
    if (!currentUser.friends.some(f => f.toString() === fromUserId)) {
      currentUser.friends.push(fromUserId);
    }

    if (!fromUser.friends) fromUser.friends = [];
    if (!fromUser.friends.some(f => f.toString() === currentUserId)) {
      fromUser.friends.push(currentUserId);
    }

    // Remove from sent requests
    if (fromUser.sentFriendRequests) {
      fromUser.sentFriendRequests = fromUser.sentFriendRequests.filter(
        r => r.toString() !== currentUserId
      );
    }

    await currentUser.save();
    await fromUser.save();

    res.status(200).json({ message: "Friend request accepted" });
  } catch (error) {
    console.log("Error in acceptFriendRequest:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Reject friend request
router.post("/reject-request/:userId", protectRoute, async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const fromUserId = req.params.userId;

    const currentUser = await User.findById(currentUserId);
    const fromUser = await User.findById(fromUserId);

    if (!fromUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find and update the friend request
    const request = currentUser.friendRequests?.find(
      r => r.from.toString() === fromUserId && r.status === "pending"
    );

    if (request) {
      request.status = "rejected";
    }

    // Remove from sent requests
    if (fromUser.sentFriendRequests) {
      fromUser.sentFriendRequests = fromUser.sentFriendRequests.filter(
        r => r.toString() !== currentUserId
      );
      await fromUser.save();
    }

    await currentUser.save();

    res.status(200).json({ message: "Friend request rejected" });
  } catch (error) {
    console.log("Error in rejectFriendRequest:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get pending friend requests
router.get("/requests", protectRoute, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate({
        path: "friendRequests.from",
        select: "fullName username email profilePic avatar",
        strictPopulate: false // Don't throw error if from is null or invalid
      })
      .select("friendRequests");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Filter pending requests and handle null/undefined from references
    const pendingRequests = (user.friendRequests || []).filter(r => {
      // Only include requests with valid from reference and pending status
      return r && r.status === "pending" && r.from;
    });

    // Convert to plain objects to avoid serialization issues
    const response = pendingRequests.map(r => {
      try {
        return r.toObject ? r.toObject() : r;
      } catch (err) {
        console.error("Error converting friend request to object:", err);
        return null;
      }
    }).filter(r => r !== null);

    res.status(200).json({ requests: response });
  } catch (error) {
    console.error("❌ [ERROR] Error in getFriendRequests:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    res.status(500).json({ 
      message: "Internal Server Error",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
  }
});

export default router;


import { Server } from "socket.io";
import http from "http";
import express from "express";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import Group from "../models/group.model.js";
import cloudinary from "./cloudinary.js";
import { updateUserChallengeProgress } from "./challengeProgress.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "https://localhost:5173"],
    credentials: true,
  },
});

export function getReceiverSocketId(userId) {
  if (!userId) {
    console.warn("⚠️ getReceiverSocketId called with null/undefined userId");
    return null;
  }
  
  // Normalize userId to string for consistent lookup
  const normalizedUserId = String(userId).trim();
  
  // First, try direct lookup
  let socketId = userSocketMap[normalizedUserId];
  
  if (socketId) {
    console.log("✅ Found socket by direct lookup:", normalizedUserId, "→", socketId);
    return socketId;
  }
  
  // If not found, try to find by checking all entries (case-insensitive, format variations)
  console.log("🔍 Socket not found by direct lookup, searching all entries...");
  console.log("   Looking for:", normalizedUserId);
  console.log("   Available keys:", Object.keys(userSocketMap));
  
  for (const [mapUserId, mapSocketId] of Object.entries(userSocketMap)) {
    const normalizedMapUserId = String(mapUserId).trim();
    
    // Try exact match
    if (normalizedMapUserId === normalizedUserId) {
      console.log("✅ Found socket by exact match:", mapUserId, "→", mapSocketId);
      // Update the map with normalized key for future lookups
      userSocketMap[normalizedUserId] = mapSocketId;
      return mapSocketId;
    }
    
    // Try case-insensitive match
    if (normalizedMapUserId.toLowerCase() === normalizedUserId.toLowerCase()) {
      console.log("✅ Found socket by case-insensitive match:", mapUserId, "→", mapSocketId);
      userSocketMap[normalizedUserId] = mapSocketId;
      return mapSocketId;
    }
    
    // Try partial match (in case of ObjectId wrapper issues)
    if (normalizedMapUserId.includes(normalizedUserId) || normalizedUserId.includes(normalizedMapUserId)) {
      console.log("✅ Found socket by partial match:", mapUserId, "→", mapSocketId);
      userSocketMap[normalizedUserId] = mapSocketId;
      return mapSocketId;
    }
  }
  
  console.log("❌ Socket not found for userId:", normalizedUserId);
  return null;
}

// used to store online users
const userSocketMap = {}; // {userId: socketId}

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  // Store userId for this socket connection
  let userId = socket.handshake.query.userId;
  if (userId) {
    // Normalize userId to string for consistent lookup
    const normalizedUserId = String(userId).trim();
    userSocketMap[normalizedUserId] = socket.id;
    userId = normalizedUserId; // Update local variable
    console.log("✅ User connected - userId:", normalizedUserId, "socketId:", socket.id);
    console.log("📊 Current userSocketMap keys:", Object.keys(userSocketMap));
    
    // Update user online status in MongoDB
    User.findByIdAndUpdate(normalizedUserId, {
      isOnline: true,
      lastSeen: new Date()
    }, { new: true }).catch(err => {
      console.error("Error updating user online status:", err);
    });
  }

  // Emit join event
  socket.on("join", async ({ userId: joinUserId }) => {
    if (joinUserId) {
      // Normalize userId to string for consistent lookup
      const normalizedUserId = String(joinUserId).trim();
      userId = normalizedUserId; // Update userId for this socket
      
      // Store in map with normalized key
      userSocketMap[normalizedUserId] = socket.id;
      
      // Also store with any variations to ensure lookup works
      // Remove any ObjectId wrapper if present
      const cleanUserId = normalizedUserId.replace(/^ObjectId\(|\)$/g, '').trim();
      if (cleanUserId !== normalizedUserId) {
        userSocketMap[cleanUserId] = socket.id;
      }
      
      console.log("✅ User joined - userId:", normalizedUserId, "socketId:", socket.id);
      console.log("📊 Updated userSocketMap keys:", Object.keys(userSocketMap));
      console.log("📊 Full userSocketMap:", JSON.stringify(userSocketMap, null, 2));
      
      // Update user online status in MongoDB
      try {
        await User.findByIdAndUpdate(normalizedUserId, {
          isOnline: true,
          lastSeen: new Date()
        });
        console.log("✅ Updated user online status in MongoDB for:", normalizedUserId);
      } catch (err) {
        console.error("❌ Error updating user online status:", err);
      }
      
      // Get all online users from MongoDB (for cross-device sync)
      try {
        const onlineUsersFromDB = await User.find({ isOnline: true }).select("_id");
        const onlineUserIds = onlineUsersFromDB.map(u => u._id.toString());
        console.log("📊 Online users from MongoDB:", onlineUserIds.length);
        
        // Merge with in-memory map (socket connections)
        const allOnlineUsers = [...new Set([...Object.keys(userSocketMap), ...onlineUserIds])];
        io.emit("getOnlineUsers", allOnlineUsers);
      } catch (err) {
        console.error("❌ Error fetching online users from MongoDB:", err);
        // Fallback to in-memory map only
        io.emit("getOnlineUsers", Object.keys(userSocketMap));
      }
      
      io.emit("user-online", normalizedUserId);
    } else {
      console.error("❌ Join event received without userId");
    }
  });

  // io.emit() is used to send events to all the connected clients
  console.log("📊 Emitting getOnlineUsers with:", Object.keys(userSocketMap));
  io.emit("getOnlineUsers", Object.keys(userSocketMap));
  
  // Log socket map state periodically for debugging
  setInterval(() => {
    if (Object.keys(userSocketMap).length > 0) {
      console.log("📊 [DEBUG] Current userSocketMap:", userSocketMap);
      console.log("📊 [DEBUG] Socket map keys:", Object.keys(userSocketMap));
    }
  }, 30000); // Every 30 seconds

  // Handle send-message event
  socket.on("send-message", async (data) => {
    try {
      const currentUserId = userId || socket.handshake.query.userId;
      if (!currentUserId) {
        console.error("No userId for send-message event");
        socket.emit("message-error", { error: "User not authenticated" });
        return;
      }

      console.log("Received send-message event from user:", currentUserId, "Data:", data);
      const { chatId, text, image, sticker, replyTo, groupId } = data;
      
      if (!chatId) {
        console.error("No chatId provided");
        socket.emit("message-error", { error: "Chat ID is required" });
        return;
      }

      // Check if this is a group message
      if (groupId || chatId.startsWith("group_")) {
        const actualGroupId = groupId || chatId.replace("group_", "");
        const group = await Group.findById(actualGroupId);

        if (!group) {
          socket.emit("message-error", { error: "Group not found" });
          return;
        }

        // Check if user is a member
        if (!group.members.includes(currentUserId)) {
          socket.emit("message-error", { error: "You are not a member of this group" });
          return;
        }

        // Check if only admins can send messages
        if (group.onlyAdminsCanSendMessages) {
          const isAdmin = group.admins.includes(currentUserId) || 
                        group.createdBy.toString() === currentUserId.toString();
          if (!isAdmin) {
            socket.emit("message-error", { error: "Only admins can send messages in this group" });
            return;
          }
        }

        let imageUrl = image;
        if (image && image.startsWith("data:image")) {
          const uploadResponse = await cloudinary.uploader.upload(image);
          imageUrl = uploadResponse.secure_url;
        }

        const newMessage = new Message({
          senderId: currentUserId,
          groupId: actualGroupId,
          text: text || "",
          image: imageUrl || sticker || "",
          replyTo: replyTo || null,
        });

        await newMessage.save();

        // Populate sender info
        const populatedMessage = await Message.findById(newMessage._id)
          .populate("senderId", "fullName username email profilePic avatar")
          .populate("replyTo");

        // Add chatId to message for frontend
        const messageWithChatId = {
          ...populatedMessage.toObject(),
          chatId: chatId,
          groupId: actualGroupId,
        };

        // Emit to all group members
        group.members.forEach((memberId) => {
          const memberSocketId = getReceiverSocketId(memberId.toString());
          if (memberSocketId) {
            io.to(memberSocketId).emit("new-message", messageWithChatId);
          }
        });

        // Update challenge progress for this specific user (user-specific progress)
        try {
          const updatedChallenges = await updateUserChallengeProgress(currentUserId, "message", 1);
          if (updatedChallenges.length > 0) {
            // Emit updated challenges to this specific user for real-time updates
            const userSocketId = getReceiverSocketId(currentUserId.toString());
            if (userSocketId) {
              const challengeUpdates = updatedChallenges.map(c => {
                const challengeObj = c.toObject ? c.toObject() : c;
                return {
                  _id: challengeObj._id,
                  title: challengeObj.title,
                  description: challengeObj.description,
                  type: challengeObj.type,
                  current: challengeObj.current,
                  target: challengeObj.target,
                  completed: challengeObj.completed,
                  completedAt: challengeObj.completedAt,
                  reward: challengeObj.reward,
                  stages: challengeObj.stages,
                  stage: challengeObj.stage,
                  maxStages: challengeObj.maxStages,
                  expiresAt: challengeObj.expiresAt,
                  userId: challengeObj.userId
                };
              });
              
              io.to(userSocketId).emit("challenge-updated", challengeUpdates);
              console.log(`✅ Updated ${updatedChallenges.length} challenges for user ${currentUserId} and emitted real-time update`);
            } else {
              console.log(`⚠️ User ${currentUserId} not connected, challenge progress saved but not emitted`);
            }
          }
        } catch (challengeError) {
          console.error("Error updating challenge progress:", challengeError);
        }

        return;
      }
      
      // Private message handling (existing code)
      // Extract receiverId from chatId (format: chat_userId1_userId2)
      const chatParts = chatId.split("_");
      if (chatParts.length !== 3 || chatParts[0] !== "chat") {
        console.error("Invalid chatId format:", chatId);
        socket.emit("message-error", { error: "Invalid chat ID format" });
        return;
      }

      // Determine sender and receiver from chatId
      // chatId format: chat_myId_otherUserId or chat_otherUserId_myId
      const userId1 = chatParts[1];
      const userId2 = chatParts[2];
      
      let senderId, receiverId;
      // Compare as strings to handle ObjectId vs string
      if (userId1.toString() === currentUserId.toString()) {
        senderId = userId1;
        receiverId = userId2;
      } else if (userId2.toString() === currentUserId.toString()) {
        senderId = userId2;
        receiverId = userId1;
      } else {
        console.error("User not part of this chat:", currentUserId, chatId);
        socket.emit("message-error", { error: "You are not part of this chat" });
        return; // Security check - user not part of this chat
      }

      console.log("Sending message from", senderId, "to", receiverId);

      let imageUrl = image;
      if (image && image.startsWith("data:image")) {
        // Upload base64 image to cloudinary
        const uploadResponse = await cloudinary.uploader.upload(image);
        imageUrl = uploadResponse.secure_url;
      }

      const newMessage = new Message({
        senderId,
        receiverId,
        text: text || "",
        image: imageUrl || sticker || "",
        replyTo: replyTo || null,
        callType: data.callType || null,
        callDuration: data.callDuration || null,
        callStatus: data.callStatus || null,
      });

      await newMessage.save();

      // Populate sender info
      const populatedMessage = await Message.findById(newMessage._id)
        .populate("senderId", "fullName username email profilePic avatar")
        .populate("receiverId", "fullName username email profilePic avatar");

      // Add chatId to message for frontend
      const messageWithChatId = {
        ...populatedMessage.toObject(),
        chatId: chatId,
      };

      // Emit to receiver
      const receiverSocketId = getReceiverSocketId(receiverId.toString());
      if (receiverSocketId) {
        console.log("📤 Emitting new-message to receiver:", receiverId, "socketId:", receiverSocketId);
        io.to(receiverSocketId).emit("new-message", messageWithChatId);
        console.log("✅ Message emitted to receiver successfully");
      } else {
        console.log("⚠️ Receiver not online, message saved to MongoDB:", receiverId);
        console.log("📊 Available sockets:", Object.keys(userSocketMap));
      }

      // Emit back to sender for confirmation (always emit to sender)
      // Only emit once - prefer socket.emit if senderSocketId matches current socket
      const senderSocketId = getReceiverSocketId(senderId.toString());
      if (senderSocketId && senderSocketId === socket.id) {
        // Sender is the current socket, emit directly (more efficient)
        console.log("📤 Emitting new-message to sender (current socket):", socket.id);
        socket.emit("new-message", messageWithChatId);
        console.log("✅ Message confirmation emitted to sender");
      } else if (senderSocketId) {
        // Sender has a different socket connection, emit via room
        console.log("📤 Emitting new-message to sender for confirmation:", senderId, "socketId:", senderSocketId);
        io.to(senderSocketId).emit("new-message", messageWithChatId);
        console.log("✅ Message confirmation emitted to sender");
      } else {
        // Fallback: emit directly to the socket that sent the message
        console.log("📤 Emitting new-message directly to sender socket (fallback):", socket.id);
        socket.emit("new-message", messageWithChatId);
      }

      // Update chat counts
      await User.findByIdAndUpdate(senderId, { $inc: { chatCount: 1, totalChats: 1 } });
      
      // Update challenge progress for this specific user (user-specific progress)
      try {
        console.log(`🔄 [SOCKET] Updating challenge progress for user ${senderId} after sending message`);
        const updatedChallenges = await updateUserChallengeProgress(senderId, "message", 1);
        console.log(`🔄 [SOCKET] Updated ${updatedChallenges.length} challenges for user ${senderId}`);
        
        if (updatedChallenges.length > 0) {
          // Emit updated challenges to this specific user for real-time updates
          const senderSocketId = getReceiverSocketId(senderId.toString());
          console.log(`🔍 [SOCKET] Looking for socket for user ${senderId}, found: ${senderSocketId}`);
          
          if (senderSocketId) {
            const challengeUpdates = updatedChallenges.map(c => {
              const challengeObj = c.toObject ? c.toObject() : c;
              return {
                _id: challengeObj._id,
                title: challengeObj.title,
                description: challengeObj.description,
                type: challengeObj.type,
                current: challengeObj.current,
                target: challengeObj.target,
                completed: challengeObj.completed,
                completedAt: challengeObj.completedAt,
                reward: challengeObj.reward,
                stages: challengeObj.stages,
                stage: challengeObj.stage,
                maxStages: challengeObj.maxStages,
                expiresAt: challengeObj.expiresAt,
                userId: challengeObj.userId
              };
            });
            
            console.log(`📤 [SOCKET] Emitting challenge-updated to socket ${senderSocketId} with ${challengeUpdates.length} challenges`);
            console.log(`📤 [SOCKET] Challenge data:`, challengeUpdates.map(c => ({ title: c.title, current: c.current, target: c.target })));
            
            io.to(senderSocketId).emit("challenge-updated", challengeUpdates);
            console.log(`✅ [SOCKET] Emitted challenge-updated event to user ${senderId}`);
          } else {
            console.log(`⚠️ [SOCKET] User ${senderId} not connected, challenge progress saved but not emitted`);
            console.log(`⚠️ [SOCKET] Available sockets:`, Object.keys(userSocketMap));
          }
        } else {
          console.log(`⚠️ [SOCKET] No challenges were updated for user ${senderId}`);
        }
      } catch (challengeError) {
        console.error("❌ [SOCKET] Error updating challenge progress:", challengeError);
        console.error("❌ [SOCKET] Error stack:", challengeError.stack);
        // Don't fail message sending if challenge update fails
      }
      
      // Add each other as friends if not already friends
      const sender = await User.findById(senderId);
      const receiver = await User.findById(receiverId);
      
      if (sender && receiver) {
        // Convert to ObjectId for comparison
        const receiverIdObj = typeof receiverId === 'string' ? receiverId : receiverId.toString();
        const senderIdObj = typeof senderId === 'string' ? senderId : senderId.toString();
        
        // Add receiver to sender's friends if not already there
        if (!sender.friends) sender.friends = [];
        const isReceiverInFriends = sender.friends.some(f => 
          f.toString() === receiverIdObj || f._id?.toString() === receiverIdObj
        );
        if (!isReceiverInFriends) {
          sender.friends.push(receiverId);
          await sender.save();
        }
        
        // Add sender to receiver's friends if not already there
        if (!receiver.friends) receiver.friends = [];
        const isSenderInFriends = receiver.friends.some(f => 
          f.toString() === senderIdObj || f._id?.toString() === senderIdObj
        );
        if (!isSenderInFriends) {
          receiver.friends.push(senderId);
          await receiver.save();
        }
      }
    } catch (error) {
      console.error("Error in send-message handler:", error);
      socket.emit("message-error", { error: "Failed to send message" });
    }
  });

  // Handle update-message event
  socket.on("update-message", async (data) => {
    try {
      const currentUserId = userId || socket.handshake.query.userId;
      if (!currentUserId) {
        console.error("No userId for update-message event");
        return;
      }

      const { messageId, text } = data;
      const message = await Message.findById(messageId);

      if (!message || message.senderId.toString() !== currentUserId.toString()) {
        console.error("User not authorized to edit this message");
        return; // Only sender can edit
      }

      message.text = text;
      message.isEdited = true;
      await message.save();

      const populatedMessage = await Message.findById(messageId)
        .populate("senderId", "fullName username email profilePic avatar")
        .populate("receiverId", "fullName username email profilePic avatar");

      const chatId = `chat_${message.senderId._id || message.senderId}_${message.receiverId._id || message.receiverId}`;
      const messageWithChatId = {
        ...populatedMessage.toObject(),
        chatId: chatId,
      };

      // Emit to both users
      const receiverSocketId = getReceiverSocketId((message.receiverId._id || message.receiverId).toString());
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("message-updated", messageWithChatId);
      }
      socket.emit("message-updated", messageWithChatId);
    } catch (error) {
      console.error("Error in update-message handler:", error);
    }
  });

      // Handle delete-message event
      socket.on("delete-message", async (data) => {
        console.log(`🗑️ [BACKEND] ========== DELETE MESSAGE EVENT RECEIVED ==========`);
        console.log(`🗑️ [BACKEND] Data:`, JSON.stringify(data, null, 2));
        try {
          console.log(`🗑️ [BACKEND] Delete-message event received:`, data);
          const currentUserId = userId || socket.handshake.query.userId;
          if (!currentUserId) {
            console.error("❌ [BACKEND] No userId for delete-message event");
            return;
          }
          console.log(`✅ [BACKEND] Current user ID: ${currentUserId}`);

          const { messageId, confirmed } = data;
          console.log(`🔍 [BACKEND] Looking for message: ${messageId}, confirmed: ${confirmed}`);
          
          // Check if this is an optimistic/temporary message ID
          if (messageId && messageId.toString().startsWith("temp_")) {
            console.log(`⏭️ [BACKEND] Skipping optimistic message deletion: ${messageId}`);
            socket.emit("message-error", { 
              error: "Cannot delete optimistic message", 
              details: "This message hasn't been saved to the server yet" 
            });
            return;
          }
          
          const message = await Message.findById(messageId);

          if (!message) {
            console.error("❌ [BACKEND] Message not found:", messageId);
            return;
          }
          console.log(`✅ [BACKEND] Message found: sender=${message.senderId}, receiver=${message.receiverId}`);

          let chatId;
          let isGroupMessage = false;
          let group = null;

          // Check if this is a group message
          if (message.groupId) {
            isGroupMessage = true;
            group = await Group.findById(message.groupId);
            if (!group) {
              console.error("Group not found for message:", messageId);
              return;
            }
            chatId = `group_${message.groupId}`;
          } else {
            // Private message
            const senderIdStr = message.senderId.toString();
            const receiverIdStr = message.receiverId.toString();
            chatId = `chat_${senderIdStr}_${receiverIdStr}`;
          }

          // Check if user is authorized to delete
          // For group messages: sender or admin can delete
          // For private messages: only sender can delete
          if (isGroupMessage) {
            const isSender = message.senderId.toString() === currentUserId.toString();
            const isAdmin = group.admins.includes(currentUserId) || 
                          group.createdBy.toString() === currentUserId.toString();
            
            if (!isSender && !isAdmin) {
              console.error("User not authorized to delete this group message");
              return;
            }
          } else {
            // Private message - only sender can delete
            if (message.senderId.toString() !== currentUserId.toString()) {
              console.error("User not authorized to delete this message");
              return;
            }
          }

          // Check if deleting this message affects challenge progress (only for sender)
          // Do this BEFORE deleting to show warning if needed
          let challengeReversal = null;
          let thresholdWarning = null;
          
          console.log(`🔍 [BACKEND] Checking if user is sender...`);
          console.log(`   Message sender: ${message.senderId.toString()}`);
          console.log(`   Current user: ${currentUserId.toString()}`);
          const isSender = message.senderId.toString() === currentUserId.toString();
          console.log(`   Match: ${isSender}`);
          
          if (isSender) {
            console.log(`✅ [BACKEND] User is sender, checking challenges...`);
            // First, check what would happen (simulate deletion)
            // We need to check challenges BEFORE actually deleting
            const UserChallenge = (await import("../models/userChallenge.model.js")).default;
            console.log(`📊 [BACKEND] Querying challenges for user: ${currentUserId}`);
            const challenges = await UserChallenge.find({
              $or: [
                { userId: currentUserId },
                { userId: currentUserId.toString() }
              ]
            });
            console.log(`📊 [BACKEND] Found ${challenges.length} challenges from MongoDB`);
            
            if (challenges.length > 0) {
              console.log(`📋 [BACKEND] Challenge details:`, challenges.map(c => ({
                id: c._id,
                title: c.title,
                current: c.current,
                target: c.target,
                completed: c.completed,
                completedAt: c.completedAt,
                type: c.type
              })));
            }

            const affectedChallenges = [];
            let totalPointsRevoked = 0;
            const revokedBadges = [];
            const warningChallenges = [];

            for (const challenge of challenges) {
              const title = (challenge.title || "").toLowerCase();
              const description = (challenge.description || "").toLowerCase();
              
              const isMessageChallenge = title.includes("message") || title.includes("send") || 
                                        title.includes("text") || title.includes("chat") ||
                                        description.includes("message") || description.includes("send") ||
                                        description.includes("chat");

              if (!isMessageChallenge) {
                console.log(`⏭️ [BACKEND] Skipping challenge "${challenge.title}" - not message-related`);
                continue;
              }

              console.log(`🔍 [BACKEND] Checking challenge "${challenge.title}": current=${challenge.current}, target=${challenge.target}, completed=${challenge.completed}`);
              const newCurrent = Math.max(0, (challenge.current || 0) - 1);
              console.log(`🔍 [BACKEND] After deletion: newCurrent=${newCurrent}`);
              
              // Check if challenge would become incomplete (only if completed within 5 minutes)
              const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
              const wasCompletedRecently = challenge.completedAt && new Date(challenge.completedAt) >= fiveMinutesAgo;
              
              console.log(`🔍 [BACKEND] Challenge "${challenge.title}": completed=${challenge.completed}, completedAt=${challenge.completedAt}, wasCompletedRecently=${wasCompletedRecently}`);
              
              if (challenge.completed && newCurrent < challenge.target && wasCompletedRecently) {
                console.log(`⚠️ [BACKEND] Challenge "${challenge.title}" would be reversed!`);
                if (challenge.reward?.points) {
                  totalPointsRevoked += challenge.reward.points;
                }
                if (challenge.reward?.badge) {
                  revokedBadges.push(challenge.reward.badge);
                }
                affectedChallenges.push({
                  _id: challenge._id,
                  title: challenge.title,
                  pointsRevoked: challenge.reward?.points || 0,
                  badgeRevoked: challenge.reward?.badge || null,
                });
                console.log(`✅ [BACKEND] Added to affectedChallenges: ${challenge.title}, points=${challenge.reward?.points || 0}`);
              } else if (challenge.completed && newCurrent < challenge.target) {
                console.log(`⏭️ [BACKEND] Challenge "${challenge.title}" completed but not recently (${challenge.completedAt}), skipping reversal`);
              }
              
              // Check for threshold warning: if user is close to a challenge threshold
              // Show warning if deletion would move user away from target when they're close
              // Example: target is 10, user has 9 (1 away), deletes 1 → has 8 (2 away) → warn
              // Example: target is 10, user has 8 (2 away), deletes 1 → has 7 (3 away) → warn
              
              // Only check if challenge is not completed
              if (challenge.completed) {
                continue; // Already completed, skip warning
              }
              
              // Check if user is close to target (within 2 messages) and deletion would move them away
              // If current is within 2 messages of target, and deletion would decrease current
              const distanceFromTarget = challenge.target - challenge.current;
              const newDistanceFromTarget = challenge.target - newCurrent;
              
              console.log(`🔍 [BACKEND] Challenge "${challenge.title}": current=${challenge.current}, target=${challenge.target}, distance=${distanceFromTarget}, newDistance=${newDistanceFromTarget}`);
              
              // Warn if user is within 2 messages of target and deletion would move them further away
              if (distanceFromTarget <= 2 && distanceFromTarget > 0 && newDistanceFromTarget > distanceFromTarget) {
                console.log(`⚠️ [BACKEND] Threshold warning: User is ${distanceFromTarget} away, deletion would make it ${newDistanceFromTarget} away`);
                warningChallenges.push({
                  _id: challenge._id,
                  title: challenge.title,
                  target: challenge.target,
                  current: challenge.current,
                  newCurrent: newCurrent,
                  points: challenge.reward?.points || 0,
                });
              }
            }

            console.log(`📊 [BACKEND] Summary: ${affectedChallenges.length} reversals, ${warningChallenges.length} warnings`);
            
            if (affectedChallenges.length > 0) {
              challengeReversal = {
                affectedChallenges,
                totalPointsRevoked,
                revokedBadges,
                hasReversals: true
              };
              console.log(`✅ [BACKEND] Challenge reversal detected:`, challengeReversal);
            }
            
            if (warningChallenges.length > 0) {
              thresholdWarning = {
                challenges: warningChallenges,
                hasWarnings: true
              };
              console.log(`✅ [BACKEND] Threshold warning detected:`, thresholdWarning);
            }
          } else {
            console.log(`⏭️ [BACKEND] User is not the sender, skipping challenge checks`);
          }
          
          // If threshold warning exists and user hasn't confirmed, show warning first
          if (thresholdWarning && thresholdWarning.hasWarnings && !confirmed) {
            console.log(`⚠️ [BACKEND] Warning user about approaching challenge thresholds`);
            console.log(`⚠️ [BACKEND] Threshold warning data:`, JSON.stringify(thresholdWarning, null, 2));
            const senderSocketId = getReceiverSocketId(currentUserId.toString());
            if (senderSocketId) {
              io.to(senderSocketId).emit("delete-threshold-warning", {
                messageId,
                warningData: thresholdWarning
              });
              console.log(`✅ [BACKEND] Emitted delete-threshold-warning to socket ${senderSocketId}`);
            } else {
              socket.emit("delete-threshold-warning", {
                messageId,
                warningData: thresholdWarning
              });
              console.log(`✅ [BACKEND] Emitted delete-threshold-warning to current socket ${socket.id}`);
            }
            return; // Don't delete yet, wait for confirmation
          }

          // If reversals would occur and user hasn't confirmed, send warning
          if (challengeReversal && challengeReversal.hasReversals && !confirmed) {
            console.log(`⚠️ [BACKEND] Warning user about challenge reversals before deletion`);
            console.log(`⚠️ [BACKEND] Reversal data:`, JSON.stringify(challengeReversal, null, 2));
            const senderSocketId = getReceiverSocketId(currentUserId.toString());
            if (senderSocketId) {
              io.to(senderSocketId).emit("delete-warning", {
                messageId,
                reversalData: challengeReversal
              });
              console.log(`✅ [BACKEND] Emitted delete-warning to socket ${senderSocketId}`);
            } else {
              socket.emit("delete-warning", {
                messageId,
                reversalData: challengeReversal
              });
              console.log(`✅ [BACKEND] Emitted delete-warning to current socket ${socket.id}`);
            }
            return; // Don't delete yet, wait for confirmation
          }
          
          // Debug: Log if no warnings/reversals
          if (!thresholdWarning && !challengeReversal) {
            console.log(`ℹ️ [BACKEND] No warnings or reversals for message deletion`);
            console.log(`ℹ️ [BACKEND] thresholdWarning:`, thresholdWarning);
            console.log(`ℹ️ [BACKEND] challengeReversal:`, challengeReversal);
          }

          // User confirmed or no reversals - proceed with deletion
          // Now actually reverse the rewards if confirmed
          if (challengeReversal && challengeReversal.hasReversals && confirmed) {
            const { reverseChallengeRewards } = await import("./challengeProgress.js");
            const reversalResult = await reverseChallengeRewards(currentUserId, 1);
            
            // Get updated challenges from MongoDB after reversal
            const UserChallenge = (await import("../models/userChallenge.model.js")).default;
            const updatedChallenges = await UserChallenge.find({
              $or: [
                { userId: currentUserId },
                { userId: currentUserId.toString() }
              ]
            });
            
            // Emit updated challenges in real-time
            const challengeUpdates = updatedChallenges
              .filter(c => {
                const title = (c.title || "").toLowerCase();
                const description = (c.description || "").toLowerCase();
                return title.includes("message") || title.includes("send") || 
                       title.includes("text") || title.includes("chat") ||
                       description.includes("message") || description.includes("send") ||
                       description.includes("chat");
              })
              .map(c => {
                const challengeObj = c.toObject ? c.toObject() : c;
                return {
                  _id: challengeObj._id,
                  title: challengeObj.title,
                  description: challengeObj.description,
                  type: challengeObj.type,
                  current: challengeObj.current,
                  target: challengeObj.target,
                  completed: challengeObj.completed,
                  completedAt: challengeObj.completedAt,
                  reward: challengeObj.reward,
                  stages: challengeObj.stages,
                  stage: challengeObj.stage,
                  maxStages: challengeObj.maxStages,
                  expiresAt: challengeObj.expiresAt,
                  userId: challengeObj.userId
                };
              });
            
            const senderSocketId = getReceiverSocketId(currentUserId.toString());
            if (senderSocketId) {
              io.to(senderSocketId).emit("challenge-updated", challengeUpdates);
              console.log(`✅ Emitted updated challenges after reversal to user ${currentUserId}`);
            }
            
            // Emit challenge reversal event to the user
            socket.emit("challenge-reversed", {
              totalPointsRevoked: challengeReversal.totalPointsRevoked,
              affectedChallenges: challengeReversal.affectedChallenges,
              revokedBadges: challengeReversal.revokedBadges,
            });
            
            // Emit points update to refresh user data (from MongoDB)
            const updatedUser = await User.findById(currentUserId);
            if (updatedUser) {
              socket.emit("points-updated", {
                points: updatedUser.points || updatedUser.totalPoints || 0,
                totalPoints: updatedUser.totalPoints || updatedUser.points || 0
              });
              console.log(`✅ Emitted points update: ${updatedUser.points || updatedUser.totalPoints || 0}`);
            }
          }

          console.log(`🗑️ [BACKEND] ========== PROCEEDING WITH DELETION ==========`);
          console.log(`🗑️ [BACKEND] Message ID: ${messageId}`);
          console.log(`🗑️ [BACKEND] User ID: ${currentUserId}`);
          console.log(`🗑️ [BACKEND] Has threshold warning: ${!!thresholdWarning}`);
          console.log(`🗑️ [BACKEND] Has challenge reversal: ${!!challengeReversal}`);
          console.log(`🗑️ [BACKEND] Confirmed: ${confirmed}`);
          
          await Message.findByIdAndDelete(messageId);
          console.log(`✅ [BACKEND] Message deleted: ${messageId} by user: ${currentUserId}`);

          // Emit to recipients
          if (isGroupMessage) {
            // Emit to all group members
            group.members.forEach((memberId) => {
              const memberSocketId = getReceiverSocketId(memberId.toString());
              if (memberSocketId) {
                io.to(memberSocketId).emit("message-deleted", { _id: messageId, chatId: chatId });
              }
            });
          } else {
            // Private message - emit to both users
            const receiverIdStr = message.receiverId.toString();
            const receiverSocketId = getReceiverSocketId(receiverIdStr);
            if (receiverSocketId) {
              io.to(receiverSocketId).emit("message-deleted", { _id: messageId, chatId: chatId });
              console.log("Emitted message-deleted to receiver:", receiverIdStr);
            }
            socket.emit("message-deleted", { _id: messageId, chatId: chatId });
            console.log("Emitted message-deleted to sender:", currentUserId);
          }
        } catch (error) {
          console.error("❌ [BACKEND] Error in delete-message handler:", error);
          console.error("❌ [BACKEND] Error stack:", error.stack);
          socket.emit("message-error", { error: "Failed to delete message", details: error.message });
        }
      });

  // Handle react-message event
  socket.on("react-message", async (data) => {
    try {
      const currentUserId = userId || socket.handshake.query.userId;
      if (!currentUserId) {
        console.error("No userId for react-message event");
        return;
      }

      const { messageId, emoji } = data;
      const message = await Message.findById(messageId);

      if (!message) return;

      if (!message.reactions) {
        message.reactions = [];
      }

      const existingReaction = message.reactions.find(
        (r) => r.userId.toString() === currentUserId.toString() && r.emoji === emoji
      );

      if (existingReaction) {
        // Remove reaction
        message.reactions = message.reactions.filter(
          (r) => !(r.userId.toString() === currentUserId.toString() && r.emoji === emoji)
        );
      } else {
        // Add reaction
        message.reactions.push({ userId: currentUserId, emoji });
      }

      await message.save();

      const populatedMessage = await Message.findById(messageId)
        .populate("senderId", "fullName username email profilePic avatar")
        .populate("receiverId", "fullName username email profilePic avatar");

      const chatId = `chat_${message.senderId._id || message.senderId}_${message.receiverId._id || message.receiverId}`;
      const messageWithChatId = {
        ...populatedMessage.toObject(),
        chatId: chatId,
      };

      // Emit to both users
      const receiverSocketId = getReceiverSocketId((message.receiverId._id || message.receiverId).toString());
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("message-reacted", messageWithChatId);
      }
      socket.emit("message-reacted", messageWithChatId);
    } catch (error) {
      console.error("Error in react-message handler:", error);
    }
  });

  // Handle typing indicator
  socket.on("typing", (data) => {
    try {
      // Get current userId for this socket (may have been updated via join event)
      const currentUserId = userId || socket.handshake.query.userId;
      if (!currentUserId) {
        console.error("No userId for typing event");
        return;
      }

      const { chatId } = data;
      if (!chatId) {
        console.error("No chatId in typing event");
        return;
      }

      const chatParts = chatId.split("_");
      if (chatParts.length !== 3 || chatParts[0] !== "chat") {
        console.error("Invalid chatId format in typing event:", chatId);
        return;
      }

      // Determine receiver from chatId
      const userId1 = chatParts[1];
      const userId2 = chatParts[2];
      
      let receiverId;
      // Compare as strings to handle ObjectId vs string
      if (userId1.toString() === currentUserId.toString()) {
        receiverId = userId2;
      } else if (userId2.toString() === currentUserId.toString()) {
        receiverId = userId1;
      } else {
        console.error("User not part of this chat for typing:", currentUserId, chatId);
        return;
      }

      const receiverSocketId = getReceiverSocketId(receiverId.toString());
      console.log("Typing indicator - from:", currentUserId, "to:", receiverId, "socketId:", receiverSocketId);

      if (receiverSocketId) {
        io.to(receiverSocketId).emit("typing", { chatId, userId: currentUserId.toString() });
        console.log("Emitted typing to receiver socket:", receiverSocketId, "userId:", currentUserId.toString());
      } else {
        console.log("Receiver not online:", receiverId);
      }
    } catch (error) {
      console.error("Error in typing handler:", error);
    }
  });

  // Handle call-user event (initiate call)
  socket.on("call-user", (data) => {
    try {
      const currentUserId = userId || socket.handshake.query.userId;
      if (!currentUserId) {
        console.error("No userId for call-user event");
        return;
      }

      const { targetUserId, type, chatId, fromUserId } = data;
      const currentUserIdStr = String(currentUserId).trim();
      const targetUserIdStr = String(targetUserId).trim();
      
      console.log("📞 Call initiated:");
      console.log("   From:", currentUserIdStr);
      console.log("   To:", targetUserIdStr);
      console.log("   Type:", type);
      console.log("📊 Current userSocketMap:", JSON.stringify(userSocketMap, null, 2));
      console.log("📊 userSocketMap keys:", Object.keys(userSocketMap));
      console.log("📊 Looking for targetUserId:", targetUserIdStr);
      console.log("📊 Target userId type:", typeof targetUserIdStr);
      console.log("📊 Target userId length:", targetUserIdStr.length);
      
      // Check if target user exists in map with different formats
      for (const [key, value] of Object.entries(userSocketMap)) {
        console.log(`   Map entry: "${key}" (type: ${typeof key}, length: ${key.length}) → ${value}`);
        if (String(key).trim() === targetUserIdStr.trim()) {
          console.log(`   ✅ EXACT MATCH FOUND: "${key}" === "${targetUserIdStr}"`);
        }
      }

      // Prepare call data first
      const callData = {
        ...data,
        fromUserId: currentUserId.toString(),
        targetUserId: targetUserIdStr,
        callId: `call_${currentUserId}_${targetUserIdStr}_${Date.now()}`,
        type: type || "video",
        chatId: chatId,
      };
      
      // Try to find receiver socket ID
      let receiverSocketId = getReceiverSocketId(targetUserIdStr);
      
      // If still not found, try more aggressive search with multiple formats
      if (!receiverSocketId) {
        console.log("⚠️ Socket not found with getReceiverSocketId, trying manual search...");
        console.log("   Searching for:", targetUserIdStr);
        console.log("   Available keys:", Object.keys(userSocketMap));
        console.log("   Full userSocketMap:", JSON.stringify(userSocketMap, null, 2));
        
        // Try all possible format variations
        const searchVariations = [
          targetUserIdStr,
          targetUserIdStr.toLowerCase(),
          targetUserIdStr.toUpperCase(),
          targetUserIdStr.replace(/^ObjectId\(|\)$/g, '').trim(),
        ];
        
        for (const searchTerm of searchVariations) {
          for (const [mapUserId, mapSocketId] of Object.entries(userSocketMap)) {
            const normalizedMapUserId = String(mapUserId).trim();
            const normalizedSearchTerm = String(searchTerm).trim();
            
            // Try exact match
            if (normalizedMapUserId === normalizedSearchTerm) {
              receiverSocketId = mapSocketId;
              console.log("✅ Found socket by exact match:", mapUserId, "→", mapSocketId, "using search term:", searchTerm);
              break;
            }
            
            // Try case-insensitive match
            if (normalizedMapUserId.toLowerCase() === normalizedSearchTerm.toLowerCase()) {
              receiverSocketId = mapSocketId;
              console.log("✅ Found socket by case-insensitive match:", mapUserId, "→", mapSocketId, "using search term:", searchTerm);
              break;
            }
            
            // Try partial match (in case of ObjectId wrapper issues)
            if (normalizedMapUserId.includes(normalizedSearchTerm) || 
                normalizedSearchTerm.includes(normalizedMapUserId)) {
              receiverSocketId = mapSocketId;
              console.log("✅ Found socket by partial match:", mapUserId, "→", mapSocketId, "using search term:", searchTerm);
              break;
            }
          }
          if (receiverSocketId) break;
        }
        
        // If still not found, wait a bit and retry (socket might be connecting)
        if (!receiverSocketId) {
          console.log("⏳ Socket not found, waiting 500ms and retrying...");
          setTimeout(() => {
            const retrySocketId = getReceiverSocketId(targetUserIdStr);
            if (retrySocketId) {
              console.log("✅ Found socket on retry:", retrySocketId);
              io.to(retrySocketId).emit("incoming-call", callData);
              socket.emit("call-sent", { targetUserId: targetUserIdStr, success: true });
            } else {
              console.log("❌ Socket still not found after retry, broadcasting...");
              io.emit("incoming-call", callData);
              socket.emit("call-error", { message: "User might not be online. Call broadcasted." });
            }
          }, 500);
          return; // Exit early, will handle in setTimeout
        }
      } else {
        console.log("✅ Found socket via getReceiverSocketId:", receiverSocketId);
      }
      
      console.log("📞 Preparing to emit incoming-call:");
      console.log("   From:", currentUserId.toString());
      console.log("   To:", targetUserIdStr);
      console.log("   Socket ID:", receiverSocketId);
      console.log("   Call data:", callData);
      console.log("   Available sockets:", Object.keys(userSocketMap));
      console.log("   Socket map details:", userSocketMap);
      
      if (receiverSocketId) {
        // Emit to specific receiver
        io.to(receiverSocketId).emit("incoming-call", callData);
        console.log("✅ Incoming-call event emitted to receiver socket:", receiverSocketId);
        
        // Also confirm to sender that call was sent
        socket.emit("call-sent", { targetUserId: targetUserIdStr, success: true });
      } else {
        console.log("⚠️ Receiver socket not found in userSocketMap");
        console.log("   Looking for:", targetUserIdStr);
        console.log("   Available userIds:", Object.keys(userSocketMap));
        
        // Try one more time with different format
        const altReceiverSocketId = getReceiverSocketId(targetUserIdStr);
        if (altReceiverSocketId) {
          console.log("✅ Found receiver on retry:", altReceiverSocketId);
          io.to(altReceiverSocketId).emit("incoming-call", callData);
          socket.emit("call-sent", { targetUserId: targetUserIdStr, success: true });
        } else {
          console.log("❌ Receiver truly not found, trying broadcast...");
          // Try broadcasting to all connected sockets - receiver might be connecting
          io.emit("incoming-call", callData);
          console.log("📢 Broadcasted incoming-call to all connected clients");
          socket.emit("call-error", { message: "User might not be online. Call broadcasted to all clients." });
        }
      }
    } catch (error) {
      console.error("Error in call-user handler:", error);
    }
  });

  // Handle call-accept event (accept/reject call)
  socket.on("call-accept", (data) => {
    try {
      const currentUserId = userId || socket.handshake.query.userId;
      if (!currentUserId) {
        console.error("No userId for call-accept event");
        return;
      }

      const { targetUserId, answer, callId } = data;
      console.log("Call accepted/rejected:", { from: currentUserId, to: targetUserId, answer });

      const receiverSocketId = getReceiverSocketId(targetUserId.toString());
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("call-answered", {
          answer,
          callId,
          fromUserId: currentUserId,
        });
        console.log("Emitted call-answered to caller:", receiverSocketId);
      } else {
        console.log("Caller not online:", targetUserId);
      }
    } catch (error) {
      console.error("Error in call-accept handler:", error);
    }
  });

  // Handle call-end event
  socket.on("call-end", (data) => {
    try {
      const currentUserId = userId || socket.handshake.query.userId;
      if (!currentUserId) {
        console.error("No userId for call-end event");
        return;
      }

      const { targetUserId } = data;
      console.log("Call ended:", { from: currentUserId, to: targetUserId });

      const receiverSocketId = getReceiverSocketId(targetUserId.toString());
      if (receiverSocketId) {
        console.log("Sending call-ended event to:", receiverSocketId, "for user:", targetUserId);
        io.to(receiverSocketId).emit("call-ended", {
          fromUserId: currentUserId,
        });
      } else {
        console.log("Target user not online or socket not found:", targetUserId);
      }
    } catch (error) {
      console.error("Error in call-end handler:", error);
    }
  });

  // Handle call-offer event (WebRTC offer)
  socket.on("call-offer", (data) => {
    try {
      const currentUserId = userId || socket.handshake.query.userId;
      if (!currentUserId) {
        console.error("No userId for call-offer event");
        return;
      }

      const { targetUserId, offer, callType } = data;
      console.log("Call offer sent:", { from: currentUserId, to: targetUserId });

      const receiverSocketId = getReceiverSocketId(targetUserId.toString());
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("offer", {
          offer,
          fromUserId: currentUserId,
          callType,
        });
      }
    } catch (error) {
      console.error("Error in call-offer handler:", error);
    }
  });

  // Handle call-answer event (WebRTC answer)
  socket.on("call-answer", (data) => {
    try {
      const currentUserId = userId || socket.handshake.query.userId;
      if (!currentUserId) {
        console.error("No userId for call-answer event");
        return;
      }

      const { targetUserId, answer } = data;
      console.log("Call answer sent:", { from: currentUserId, to: targetUserId });

      const receiverSocketId = getReceiverSocketId(targetUserId.toString());
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("answer", {
          answer,
          fromUserId: currentUserId,
        });
      }
    } catch (error) {
      console.error("Error in call-answer handler:", error);
    }
  });

  // Handle ice-candidate event (WebRTC ICE candidate)
  socket.on("ice-candidate", (data) => {
    try {
      const currentUserId = userId || socket.handshake.query.userId;
      if (!currentUserId) {
        console.error("No userId for ice-candidate event");
        return;
      }

      const { targetUserId, candidate } = data;
      const receiverSocketId = getReceiverSocketId(targetUserId.toString());
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("ice-candidate", {
          candidate,
          fromUserId: currentUserId,
        });
      }
    } catch (error) {
      console.error("Error in ice-candidate handler:", error);
    }
  });

  socket.on("disconnect", async () => {
    console.log("A user disconnected", socket.id);
    const currentUserId = userId || socket.handshake.query.userId;
    if (currentUserId) {
      // Normalize userId to string for consistent removal
      const normalizedUserId = String(currentUserId).trim();
      
      // Remove from socket map
      if (userSocketMap[normalizedUserId]) {
        delete userSocketMap[normalizedUserId];
        console.log("✅ User removed from socket map:", normalizedUserId);
      } else {
        // Try to find and remove by checking all entries
        for (const [mapUserId, mapSocketId] of Object.entries(userSocketMap)) {
          if (String(mapUserId).trim() === normalizedUserId || mapSocketId === socket.id) {
            delete userSocketMap[mapUserId];
            console.log("✅ User removed from socket map (found by search):", mapUserId);
            break;
          }
        }
      }
      
      console.log("📊 Remaining userSocketMap keys:", Object.keys(userSocketMap));
      
      // Update user offline status in MongoDB
      try {
        await User.findByIdAndUpdate(normalizedUserId, {
          isOnline: false,
          lastSeen: new Date()
        });
        console.log("✅ Updated user offline status in MongoDB for:", normalizedUserId);
      } catch (err) {
        console.error("❌ Error updating user offline status:", err);
      }
      
      io.emit("getOnlineUsers", Object.keys(userSocketMap));
      io.emit("user-offline", normalizedUserId);
    }
  });
});

export { io, app, server };


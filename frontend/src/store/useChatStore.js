import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  userRanks: {},
  selectedUser: null,
  selectedChat: null,
  groups: [],
  isUsersLoading: false,
  isMessagesLoading: false,
  isGroupsLoading: false,
  typingUsers: [],
  replyingTo: null,
  editingMessage: null,

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/auth/search");
      set({ users: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch users");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  searchUsers: async (query) => {
    try {
      // Use search-all to find all users (not just friends)
      const res = await axiosInstance.get(`/auth/search-all?q=${query}`);
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to search users");
      return [];
    }
  },

  getOrCreateChat: async (userId) => {
    try {
      const res = await axiosInstance.post("/chat/get-or-create", { userId });
      set({ selectedChat: res.data });
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to get/create chat");
      return null;
    }
  },

  setSelectedGroupChat: async (groupId) => {
    try {
      // Set group as selected chat
      const chatData = {
        _id: `group_${groupId}`,
        type: "group",
        groupId: groupId,
      };
      set({ selectedChat: chatData });
      get().getGroupMessages(groupId);
      return chatData;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to open group chat");
      return null;
    }
  },

  getGroupMessages: async (groupId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/group/${groupId}/messages`);
      set({ messages: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch group messages");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  getMyChats: async () => {
    try {
      const res = await axiosInstance.get("/chat/my-chats");
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch chats");
      return [];
    }
  },

  getMessages: async (chatId) => {
    set({ isMessagesLoading: true });
    try {
      // Check if this is a group chat
      if (chatId && chatId.startsWith("group_")) {
        const groupId = chatId.replace("group_", "");
        const res = await axiosInstance.get(`/group/${groupId}/messages`);
        set({ messages: res.data });
      } else {
        const res = await axiosInstance.get(`/chat/${chatId}/messages`);
        set({ messages: res.data });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch messages");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  // Sync messages from MongoDB (fallback if socket fails)
  syncMessages: async () => {
    const { selectedChat } = get();
    if (!selectedChat || !selectedChat._id) {
      return;
    }
    
    try {
      const chatId = selectedChat._id;
      const currentMessages = get().messages;
      
      // Get the timestamp of the last message, or use a time 1 minute ago if no messages
      let lastMessageTime;
      if (currentMessages.length > 0) {
        const lastMsg = currentMessages[currentMessages.length - 1];
        lastMessageTime = lastMsg.createdAt ? new Date(lastMsg.createdAt) : new Date(Date.now() - 60000);
      } else {
        lastMessageTime = new Date(Date.now() - 60000); // 1 minute ago
      }
      
      console.log("🔄 Syncing messages from MongoDB, after:", lastMessageTime.toISOString());
      
      // Fetch messages newer than the last message we have
      let newMessages = [];
      if (chatId && chatId.startsWith("group_")) {
        const groupId = chatId.replace("group_", "");
        const res = await axiosInstance.get(`/group/${groupId}/messages?after=${lastMessageTime.toISOString()}`);
        newMessages = res.data || [];
      } else {
        const res = await axiosInstance.get(`/chat/${chatId}/messages?after=${lastMessageTime.toISOString()}`);
        newMessages = res.data || [];
      }
      
      if (newMessages.length > 0) {
        console.log(`✅ Synced ${newMessages.length} new messages from MongoDB`);
        // Merge new messages, avoiding duplicates by ID and optimistic messages
        const existingIds = new Set(
          currentMessages
            .map(m => m._id?.toString())
            .filter(id => id) // Remove undefined/null
        );
        
        // Also check for optimistic messages that might match
        const uniqueNewMessages = newMessages.filter(m => {
          const msgId = m._id?.toString();
          if (!msgId) return false;
          
          // Skip if already exists by ID
          if (existingIds.has(msgId)) {
            return false;
          }
          
          // Check if this matches an optimistic message (to replace it instead of adding)
          const matchesOptimistic = currentMessages.some(msg => {
            if (!msg.isOptimistic) return false;
            
            const textMatch = (!msg.text && !m.text) || 
                             (msg.text && m.text && msg.text.trim() === m.text.trim());
            const senderMatch = (msg.senderId?._id?.toString() || msg.senderId?.toString()) === 
                               (m.senderId?._id?.toString() || m.senderId?.toString());
            const timeDiff = Math.abs(
              new Date(msg.createdAt || 0).getTime() - 
              new Date(m.createdAt || 0).getTime()
            );
            
            return textMatch && senderMatch && timeDiff < 30000;
          });
          
          // If it matches an optimistic message, we'll replace it, so don't add as new
          if (matchesOptimistic) {
            // Replace the optimistic message
            const optimisticMsg = currentMessages.find(msg => {
              if (!msg.isOptimistic) return false;
              const textMatch = (!msg.text && !m.text) || 
                               (msg.text && m.text && msg.text.trim() === m.text.trim());
              const senderMatch = (msg.senderId?._id?.toString() || msg.senderId?.toString()) === 
                                 (m.senderId?._id?.toString() || m.senderId?.toString());
              const timeDiff = Math.abs(
                new Date(msg.createdAt || 0).getTime() - 
                new Date(m.createdAt || 0).getTime()
              );
              return textMatch && senderMatch && timeDiff < 30000;
            });
            
            if (optimisticMsg) {
              const optimisticIndex = currentMessages.indexOf(optimisticMsg);
              const updatedMessages = [...currentMessages];
              updatedMessages[optimisticIndex] = m;
              set({ messages: updatedMessages });
            }
            return false; // Don't add as new message
          }
          
          return true; // New unique message
        });
        
        if (uniqueNewMessages.length > 0) {
          set({ messages: [...currentMessages, ...uniqueNewMessages] });
        }
      }
    } catch (error) {
      console.error("❌ Error syncing messages:", error);
    }
  },

  sendMessage: async (messageData) => {
    const { selectedChat, authUser } = get();
    if (!selectedChat) {
      toast.error("Please select a chat to send message");
      return;
    }
    
    try {
      const socket = useAuthStore.getState().socket;
      const authUser = useAuthStore.getState().authUser;
      
      if (!socket || !socket.connected) {
        toast.error("Not connected to server. Please refresh the page.");
        return;
      }

      // Add groupId if it's a group chat
      const messagePayload = {
        chatId: selectedChat._id,
        ...messageData,
      };
      
      if (selectedChat.groupId || selectedChat._id?.startsWith("group_")) {
        messagePayload.groupId = selectedChat.groupId || selectedChat._id.replace("group_", "");
      }

      // Create optimistic message (temporary ID)
      const tempMessageId = `temp_${Date.now()}_${Math.random()}`;
      const optimisticMessage = {
        _id: tempMessageId,
        chatId: selectedChat._id,
        senderId: authUser ? { _id: authUser._id, ...authUser } : null,
        receiverId: selectedChat.otherUser || null,
        text: messageData.text || "",
        image: messageData.image || "",
        sticker: messageData.sticker || "",
        createdAt: new Date(),
        isOptimistic: true, // Flag to identify optimistic messages
      };

      // Add optimistic message immediately
      set({
        messages: [...get().messages, optimisticMessage],
      });

      // Emit to server
      socket.emit("send-message", messagePayload);
      
      console.log("📤 Sent message via socket:", messagePayload);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error(error.response?.data?.message || "Failed to send message");
      
      // Remove optimistic message on error
      const currentMessages = get().messages;
      set({
        messages: currentMessages.filter(msg => !msg.isOptimistic),
      });
    }
  },

  editMessage: async (messageId, text) => {
    try {
      const socket = useAuthStore.getState().socket;
      socket.emit("update-message", { messageId, text });
      set({ editingMessage: null });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to edit message");
    }
  },

  deleteMessage: async (messageId, confirmed = false) => {
    try {
      // Check if this is an optimistic message (temporary ID)
      if (messageId && messageId.toString().startsWith("temp_")) {
        console.log("🗑️ Deleting optimistic message locally:", messageId);
        // Just remove from local state, don't send to backend
        set({
          messages: get().messages.filter((msg) => msg._id !== messageId),
        });
        return;
      }

      const socket = useAuthStore.getState().socket;
      if (!socket || !socket.connected) {
        toast.error("Not connected to server. Please refresh the page.");
        return;
      }
      console.log("🗑️ Sending delete-message event:", { messageId, confirmed });
      socket.emit("delete-message", { messageId, confirmed });
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error(error.response?.data?.message || "Failed to delete message");
    }
  },
  
  // Store pending deletion for confirmation
  pendingDeletion: null,
  setPendingDeletion: (data) => {
    console.log("🔧 [STORE] setPendingDeletion called with:", data);
    set({ pendingDeletion: data });
    console.log("🔧 [STORE] pendingDeletion after set:", get().pendingDeletion);
  },
  clearPendingDeletion: () => {
    console.log("🔧 [STORE] clearPendingDeletion called");
    set({ pendingDeletion: null });
  },
  
  // Store threshold warning
  thresholdWarning: null,
  setThresholdWarning: (data) => {
    console.log("🔧 [STORE] setThresholdWarning called with:", data);
    set({ thresholdWarning: data });
    console.log("🔧 [STORE] thresholdWarning after set:", get().thresholdWarning);
  },
  clearThresholdWarning: () => {
    console.log("🔧 [STORE] clearThresholdWarning called");
    set({ thresholdWarning: null });
  },

  reactToMessage: async (messageId, emoji) => {
    try {
      const socket = useAuthStore.getState().socket;
      socket.emit("react-message", { messageId, emoji });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to react to message");
    }
  },

  forwardMessage: async (messageId, chatIds) => {
    try {
      await axiosInstance.post("/chat/forward", { messageId, chatIds });
      toast.success("Message forwarded");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to forward message");
    }
  },

  sendTypingIndicator: () => {
    const { selectedChat } = get();
    if (!selectedChat) return;
    
    const socket = useAuthStore.getState().socket;
    if (!socket || !socket.connected) return;
    
    socket.emit("typing", { chatId: selectedChat._id });
  },

  subscribeToMessages: () => {
    const { selectedChat } = get();
    if (!selectedChat) {
      console.log("⚠️ Cannot subscribe: No selected chat");
      return;
    }

    const socket = useAuthStore.getState().socket;
    if (!socket) {
      console.error("❌ Socket not available");
      return;
    }
    
    if (!socket.connected) {
      console.error("❌ Socket not connected, waiting for connection...");
      // Wait for socket to connect, then retry
      socket.once("connect", () => {
        console.log("✅ Socket connected, retrying subscribeToMessages");
        get().subscribeToMessages();
      });
      return;
    }

    console.log("✅ Subscribing to messages for chat:", selectedChat._id);

    // Clear typing users when switching chats
    set({ typingUsers: [] });

    // Remove existing listeners to prevent duplicates
    // NOTE: Don't remove delete-warning and delete-threshold-warning here - they're set up globally
    socket.off("new-message");
    socket.off("message-updated");
    socket.off("message-deleted");
    socket.off("message-reacted");
    socket.off("typing");
    socket.off("points-updated");

    socket.on("new-message", (newMessage) => {
      console.log("📥 Received new-message event:", newMessage);
      
      // Get current selectedChat from store (not closure)
      const currentSelectedChat = get().selectedChat;
      if (!currentSelectedChat) {
        console.log("⚠️ No selected chat, ignoring message");
        return;
      }

      // Check if message belongs to current chat
      const messageChatId = newMessage.chatId || 
        (newMessage.groupId 
          ? `group_${newMessage.groupId}`
          : (newMessage.senderId?._id && newMessage.receiverId?._id 
            ? `chat_${newMessage.senderId._id}_${newMessage.receiverId._id}`
            : null));
      
      console.log("🔍 Message chatId:", messageChatId, "Current chat:", currentSelectedChat._id);
      
      // More flexible matching - check multiple conditions
      const isMatchingChat = 
        messageChatId === currentSelectedChat._id ||
        messageChatId === currentSelectedChat._id?.toString() ||
        (currentSelectedChat.otherUser && 
         (newMessage.senderId?._id?.toString() === currentSelectedChat.otherUser._id?.toString() || 
          newMessage.receiverId?._id?.toString() === currentSelectedChat.otherUser._id?.toString())) ||
        (newMessage.groupId && currentSelectedChat.groupId === newMessage.groupId) ||
        (newMessage.groupId && currentSelectedChat._id?.includes(newMessage.groupId));
      
      if (isMatchingChat) {
        // Check if message already exists (by ID) - normalize IDs for comparison
        const currentMessages = get().messages;
        const messageId = newMessage._id?.toString();
        
        // Check for duplicate by ID (normalize both sides)
        const existsById = messageId && currentMessages.some(msg => {
          const msgId = msg._id?.toString();
          return msgId && msgId === messageId;
        });
        
        if (existsById) {
          console.log("⚠️ Message already exists by ID, skipping:", messageId);
          return;
        }
        
        // Check for optimistic message with same content and sender
        // Match by: EXACT text content, sender ID, and time (within 10 seconds)
        // Find ALL optimistic messages that could match, then pick the best one
        const allOptimisticMessages = currentMessages.filter(msg => msg.isOptimistic);
        
        // Find the best matching optimistic message
        let bestMatch = null;
        let bestMatchScore = -1;
        
        for (const msg of allOptimisticMessages) {
          if (!msg.isOptimistic) continue;
          
          // Match sender (handle both object and string formats)
          const msgSenderId = msg.senderId?._id?.toString() || msg.senderId?.toString();
          const newMsgSenderId = newMessage.senderId?._id?.toString() || newMessage.senderId?.toString();
          const senderMatch = msgSenderId && newMsgSenderId && msgSenderId === newMsgSenderId;
          
          if (!senderMatch) continue; // Must match sender
          
          // Match time (within 10 seconds - stricter for better matching)
          const timeDiff = Math.abs(
            new Date(msg.createdAt || 0).getTime() - 
            new Date(newMessage.createdAt || 0).getTime()
          );
          const timeMatch = timeDiff < 10000; // 10 seconds
          
          if (!timeMatch) continue; // Must be within time window
          
          // Calculate match score based on content similarity
          let matchScore = 0;
          
          // Exact text match (highest priority)
          if (msg.text && newMessage.text && msg.text.trim() === newMessage.text.trim()) {
            matchScore += 100;
          } else if (!msg.text && !newMessage.text) {
            matchScore += 50; // Both empty
          } else {
            continue; // Text doesn't match, skip this optimistic message
          }
          
          // Image match
          if (msg.image && newMessage.image && msg.image === newMessage.image) {
            matchScore += 50;
          } else if (!msg.image && !newMessage.image) {
            matchScore += 25; // Both empty
          } else if ((msg.image && !newMessage.image) || (!msg.image && newMessage.image)) {
            continue; // One has image, other doesn't - not a match
          }
          
          // Sticker match
          if (msg.sticker && newMessage.sticker && msg.sticker === newMessage.sticker) {
            matchScore += 50;
          } else if (!msg.sticker && !newMessage.sticker) {
            matchScore += 25; // Both empty
          } else if ((msg.sticker && !newMessage.sticker) || (!msg.sticker && newMessage.sticker)) {
            continue; // One has sticker, other doesn't - not a match
          }
          
          // Prefer more recent optimistic messages (higher score for closer time)
          matchScore += Math.max(0, 10 - (timeDiff / 1000)); // Up to 10 points for recency
          
          // Prefer optimistic messages that are closer to the end of the array (more recent)
          const msgIndex = currentMessages.indexOf(msg);
          const distanceFromEnd = currentMessages.length - msgIndex;
          matchScore += Math.min(5, distanceFromEnd); // Up to 5 points for being recent
          
          if (matchScore > bestMatchScore) {
            bestMatchScore = matchScore;
            bestMatch = msg;
          }
        }
        
        if (bestMatch && bestMatchScore > 0) {
          console.log("🔄 Replacing optimistic message with real message (score:", bestMatchScore, ")");
          console.log("   Optimistic:", bestMatch.text?.substring(0, 50), "→ Real:", newMessage.text?.substring(0, 50));
          // Replace optimistic message with real one (preserve order)
          const optimisticIndex = currentMessages.indexOf(bestMatch);
          const updatedMessages = [...currentMessages];
          updatedMessages[optimisticIndex] = newMessage;
          set({
            messages: updatedMessages,
          });
          return; // Stop here - message already replaced, don't add again
        } else {
          console.log("✅ Adding new message to chat (no matching optimistic message found)");
          set({
            messages: [...currentMessages, newMessage],
          });
        }
      } else {
        console.log("⚠️ Message not for current chat, ignoring. Message chatId:", messageChatId, "Current chat:", currentSelectedChat._id);
        // Don't sync here - it causes duplicates. Messages will sync when chat is selected.
      }
    });

    socket.on("message-updated", (updatedMessage) => {
      const currentSelectedChat = get().selectedChat;
      if (!currentSelectedChat) return;

      const messageChatId = updatedMessage.chatId || 
        (updatedMessage.groupId 
          ? `group_${updatedMessage.groupId}`
          : (updatedMessage.senderId?._id && updatedMessage.receiverId?._id 
            ? `chat_${updatedMessage.senderId._id}_${updatedMessage.receiverId._id}`
            : null));
      
      if (messageChatId === currentSelectedChat._id || 
          (currentSelectedChat.otherUser && 
           (updatedMessage.senderId?._id === currentSelectedChat.otherUser._id || 
            updatedMessage.receiverId?._id === currentSelectedChat.otherUser._id)) ||
          (updatedMessage.groupId && currentSelectedChat.groupId === updatedMessage.groupId)) {
        set({
          messages: get().messages.map((msg) =>
            msg._id === updatedMessage._id ? updatedMessage : msg
          ),
        });
      }
    });

    socket.on("message-deleted", (deletedMessage) => {
      const currentSelectedChat = get().selectedChat;
      if (!currentSelectedChat) return;

      const messageChatId = deletedMessage.chatId;
      console.log("Received message-deleted event:", deletedMessage, "current chat:", currentSelectedChat._id);
      
      // Check if message belongs to current chat (handle both private and group chats)
      if (messageChatId === currentSelectedChat._id || 
          (currentSelectedChat.groupId && messageChatId?.includes(currentSelectedChat.groupId))) {
        console.log("Removing message:", deletedMessage._id, "from chat:", messageChatId);
        set({
          messages: get().messages.filter((msg) => msg._id !== deletedMessage._id),
        });
      } else {
        console.log("Message deleted from different chat:", messageChatId, "current:", currentSelectedChat._id);
      }
    });

    socket.on("message-reacted", (reactedMessage) => {
      const currentSelectedChat = get().selectedChat;
      if (!currentSelectedChat) return;

      const messageChatId = reactedMessage.chatId || 
        (reactedMessage.groupId 
          ? `group_${reactedMessage.groupId}`
          : (reactedMessage.senderId?._id && reactedMessage.receiverId?._id 
            ? `chat_${reactedMessage.senderId._id}_${reactedMessage.receiverId._id}`
            : null));
      
      if (messageChatId === currentSelectedChat._id || 
          (currentSelectedChat.otherUser && 
           (reactedMessage.senderId?._id === currentSelectedChat.otherUser._id || 
            reactedMessage.receiverId?._id === currentSelectedChat.otherUser._id)) ||
          (reactedMessage.groupId && currentSelectedChat.groupId === reactedMessage.groupId)) {
        set({
          messages: get().messages.map((msg) =>
            msg._id === reactedMessage._id ? reactedMessage : msg
          ),
        });
      }
    });

    socket.on("typing", (data) => {
      const currentSelectedChat = get().selectedChat;
      if (!currentSelectedChat) return;

      const messageChatId = data.chatId;
      console.log("Received typing event:", data, "current chat:", currentSelectedChat._id);
      
      if (messageChatId === currentSelectedChat._id) {
        console.log("Typing indicator for current chat, adding user:", data.userId);
        // Add typing user if not already in list (compare as strings)
        const currentTypingUsers = get().typingUsers;
        const userIdStr = data.userId?.toString();
        const isAlreadyTyping = currentTypingUsers.some(id => id?.toString() === userIdStr);
        
        if (!isAlreadyTyping && userIdStr) {
          set({
            typingUsers: [...currentTypingUsers, userIdStr],
          });
          
          // Remove typing indicator after 3 seconds
          setTimeout(() => {
            set({
              typingUsers: get().typingUsers.filter((id) => id?.toString() !== userIdStr),
            });
          }, 3000);
        }
      } else {
        console.log("Typing from different chat:", messageChatId, "current:", currentSelectedChat._id);
      }
    });

    // NOTE: delete-warning and delete-threshold-warning listeners are set up globally in useAuthStore
    // They don't need to be set up here in subscribeToMessages

    // Handle message errors
    socket.on("message-error", (errorData) => {
      console.error("❌ [FRONTEND] Message error received:", errorData);
      toast.error(errorData.error || "Message operation failed");
    });

    // Handle points update
    socket.on("points-updated", async (data) => {
      console.log("💰 Points updated:", data);
      // Refresh auth user to get updated points
      useAuthStore.getState().refreshAuthUser();
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (socket) {
      socket.off("new-message");
      socket.off("message-updated");
      socket.off("message-deleted");
      socket.off("message-reacted");
      socket.off("typing");
      socket.off("points-updated");
      // NOTE: Don't remove delete-warning and delete-threshold-warning - they're global listeners
    }
  },

  setSelectedUser: (selectedUser) => {
    set({ selectedUser });
    if (selectedUser) {
      get().getOrCreateChat(selectedUser._id).then((chat) => {
        if (chat) {
          set({ selectedChat: chat });
          get().getMessages(chat._id);
        }
      });
    }
  },

  setReplyingTo: (message) => set({ replyingTo: message }),
  setEditingMessage: (message) => set({ editingMessage: message }),

  // Fetch and update user ranks
  updateUserRanks: async () => {
    try {
      console.log("Fetching leaderboard data...");
      const res = await axiosInstance.get("/leaderboard/badges");
      console.log("Leaderboard response:", res.data);
      
      const ranks = {};
      res.data.forEach((user, index) => {
        ranks[user._id] = index + 1; // 1-based rank
      });
      
      console.log("Processed ranks:", ranks);
      set({ userRanks: ranks });
      console.log("Updated userRanks in store:", get().userRanks);
      return ranks;
    } catch (error) {
      console.error("Failed to fetch user ranks:", error);
      if (error.response) {
        console.error("Response data:", error.response.data);
        console.error("Status:", error.response.status);
      }
      return {};
    }
  },
}));

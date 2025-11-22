import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
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

  sendMessage: async (messageData) => {
    const { selectedChat } = get();
    if (!selectedChat) {
      toast.error("Please select a chat to send message");
      return;
    }
    
    try {
      const socket = useAuthStore.getState().socket;
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

      socket.emit("send-message", messagePayload);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error(error.response?.data?.message || "Failed to send message");
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

  deleteMessage: async (messageId) => {
    try {
      const socket = useAuthStore.getState().socket;
      socket.emit("delete-message", { messageId });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete message");
    }
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
    if (!selectedChat) return;

    const socket = useAuthStore.getState().socket;
    if (!socket || !socket.connected) {
      console.error("Socket not connected");
      return;
    }

    // Clear typing users when switching chats
    set({ typingUsers: [] });

    // Remove existing listeners to prevent duplicates
    socket.off("new-message");
    socket.off("message-updated");
    socket.off("message-deleted");
    socket.off("message-reacted");
    socket.off("typing");

    socket.on("new-message", (newMessage) => {
      // Get current selectedChat from store (not closure)
      const currentSelectedChat = get().selectedChat;
      if (!currentSelectedChat) return;

      // Check if message belongs to current chat
      const messageChatId = newMessage.chatId || 
        (newMessage.groupId 
          ? `group_${newMessage.groupId}`
          : (newMessage.senderId?._id && newMessage.receiverId?._id 
            ? `chat_${newMessage.senderId._id}_${newMessage.receiverId._id}`
            : null));
      
      if (messageChatId === currentSelectedChat._id || 
          (currentSelectedChat.otherUser && 
           (newMessage.senderId?._id === currentSelectedChat.otherUser._id || 
            newMessage.receiverId?._id === currentSelectedChat.otherUser._id)) ||
          (newMessage.groupId && currentSelectedChat.groupId === newMessage.groupId)) {
        // Check if message already exists
        const exists = get().messages.some(msg => msg._id === newMessage._id);
        if (!exists) {
          set({
            messages: [...get().messages, newMessage],
          });
        }
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
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (socket) {
      socket.off("new-message");
      socket.off("message-updated");
      socket.off("message-deleted");
      socket.off("message-reacted");
      socket.off("typing");
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
}));

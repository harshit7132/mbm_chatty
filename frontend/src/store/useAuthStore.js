import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import { useCallStore } from "./useCallStore";
import { useChatStore } from "./useChatStore";
import { useChallengeStore } from "./useChallengeStore";

// In development, use HTTP for socket.io (WebSocket connections)
// Browsers allow WebSocket connections from HTTPS to HTTP on localhost
// In production, use relative URL which will use the same protocol as the page
const BASE_URL = import.meta.env.MODE === "development" ? "http://localhost:5001" : window.location.origin;

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  isCheckingAuth: true,
  onlineUsers: [],
  socket: null,
  onlineUsersSyncInterval: null,

  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");
      set({ authUser: res.data });
      get().connectSocket();
      get().fetchOnlineUsers(); // Fetch online users from MongoDB
    } catch (error) {
      // 404 or 401 means user is not authenticated - this is normal
      if (error.response?.status === 404 || error.response?.status === 401) {
        console.log("User not authenticated (normal for new users)");
        set({ authUser: null });
      } else {
        console.error("Error in checkAuth:", error);
        set({ authUser: null });
      }
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  // Refresh auth user data (useful after points changes)
  refreshAuthUser: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");
      set({ authUser: res.data });
    } catch (error) {
      console.error("Error refreshing auth user:", error);
    }
  },

  // Fetch online users from MongoDB
  fetchOnlineUsers: async () => {
    try {
      const res = await axiosInstance.get("/auth/online-users");
      set({ onlineUsers: res.data.onlineUsers || [] });
      console.log("✅ Fetched online users from MongoDB:", res.data.onlineUsers.length);
    } catch (error) {
      console.error("❌ Error fetching online users:", error);
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      console.log("Signing up with data:", { ...data, password: data.password ? "***" : "none" });
      const res = await axiosInstance.post("/auth/signup", data);
      set({ authUser: res.data });
      toast.success("Account created successfully");
      get().connectSocket();
    } catch (error) {
      // console.error("Signup error:", error);
      // console.error("Error response:", error.response?.data);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || "Failed to create account";
      toast.error(errorMessage);
      // Don't re-throw - error is already handled with toast
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      set({ authUser: res.data });
      toast.success("Logged in successfully");

      get().connectSocket();
      return res.data; // Return user data
    } catch (error) {
      toast.error(error.response?.data?.message || "Login failed");
      throw error; // Re-throw to allow caller to handle
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      set({ authUser: null });
      toast.success("Logged out successfully");
      get().disconnectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },

  updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      const res = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: res.data });
      toast.success("Profile updated successfully");
    } catch (error) {
      console.log("error in update profile:", error);
      toast.error(error.response.data.message);
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  connectSocket: () => {
    const { authUser, socket } = get();
    if (!authUser) return;

    // If socket already exists and is connected, just ensure listeners are set up
    if (socket?.connected) {
      console.log("Socket already connected, skipping new connection");
      get().setupSocketListeners(socket);
      return;
    }

    // If socket is connecting, don't create another one
    if (socket && (socket.connecting || socket.disconnected === false)) {
      console.log("Socket is already connecting, skipping new connection");
      return;
    }

    // Disconnect and cleanup existing socket if any
    if (socket) {
      console.log("Disconnecting existing socket before creating new one");
      socket.removeAllListeners(); // Remove all listeners to prevent memory leaks
      socket.disconnect();
    }

    // Create new socket connection
    console.log("Creating new socket connection for userId:", authUser._id);
    const newSocket = io(BASE_URL, {
      query: {
        userId: authUser._id,
      },
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    newSocket.on("connect", () => {
      console.log("✅ Socket connected:", newSocket.id, "userId:", authUser._id);
      newSocket.emit("join", { userId: authUser._id });
      
      // Set up socket listeners immediately after connection
      get().setupSocketListeners(newSocket);
      
      // Re-subscribe to messages if there's an active chat
      const { selectedChat } = useChatStore.getState();
      if (selectedChat) {
        console.log("🔄 Re-subscribing to messages after socket reconnect");
        setTimeout(() => {
          useChatStore.getState().subscribeToMessages();
        }, 500);
      }
      
      // Fetch online users from MongoDB after connecting
      get().fetchOnlineUsers();
      
      // Set up periodic sync with MongoDB (every 30 seconds)
      if (get().onlineUsersSyncInterval) {
        clearInterval(get().onlineUsersSyncInterval);
      }
      const interval = setInterval(() => {
        get().fetchOnlineUsers();
      }, 30000); // Sync every 30 seconds
      set({ onlineUsersSyncInterval: interval });
    });

    newSocket.on("disconnect", (reason) => {
      console.log("Socket disconnected, reason:", reason);
      // Show warning if unexpected disconnect
      if (reason === "io server disconnect") {
        toast.error("Server disconnected. Attempting to reconnect...");
        // Server disconnected, try to reconnect
        newSocket.connect();
      } else if (reason === "transport close" || reason === "transport error") {
        console.log("Connection lost, will attempt to reconnect automatically");
      }
    });

    newSocket.on("connect_error", (error) => {
      console.error("Socket connection error:", error);
      console.error("Attempting to connect to:", BASE_URL);
      // Show user-friendly error message
      if (error.message.includes("ECONNREFUSED") || error.message.includes("ERR_CONNECTION_REFUSED")) {
        toast.error("Cannot connect to server. Make sure the backend is running on port 5001.");
      } else {
        toast.error("Connection error: " + error.message);
      }
    });

    set({ socket: newSocket });
  },

  setupSocketListeners: (socket) => {
    if (!socket) {
      console.error("❌ Cannot setup socket listeners - socket is null");
      return;
    }
    
    // Remove existing listeners to prevent duplicates
    socket.off("getOnlineUsers");
    socket.off("user-online");
    socket.off("user-offline");
    socket.off("points-earned");
    socket.off("incoming-call");
    socket.off("call-answered");
    socket.off("call-ended");
    socket.off("call-error");
    socket.off("call-sent");
    socket.off("challenge-updated");
    socket.off("challenge-reversed");
    
    console.log("✅ Setting up socket listeners for socket:", socket.id);
    
    // Initialize challenge socket listener for real-time updates
    try {
      useChallengeStore.getState().initSocketListener(socket);
    } catch (error) {
      console.error("Error initializing challenge socket listener:", error);
    }
    
    // Initialize delete warning listeners globally (not just in subscribeToMessages)
    // Remove existing listeners to prevent duplicates
    socket.off("delete-warning");
    socket.off("delete-threshold-warning");
    
    // Set up delete warning listeners
    socket.on("delete-warning", (data) => {
      console.log("⚠️ [GLOBAL] Delete warning received:", data);
      console.log("⚠️ [GLOBAL] Setting pendingDeletion in store...");
      useChatStore.getState().setPendingDeletion(data);
      console.log("⚠️ [GLOBAL] pendingDeletion set:", useChatStore.getState().pendingDeletion);
    });
    
    socket.on("delete-threshold-warning", (data) => {
      console.log("⚠️ [GLOBAL] Threshold warning received:", data);
      console.log("⚠️ [GLOBAL] Setting thresholdWarning in store...");
      useChatStore.getState().setThresholdWarning(data);
      console.log("⚠️ [GLOBAL] thresholdWarning set:", useChatStore.getState().thresholdWarning);
    });
    
    console.log("✅ Global delete warning listeners initialized");

    socket.on("getOnlineUsers", (userIds) => {
      // Merge socket online users with MongoDB online users
      get().fetchOnlineUsers().then(() => {
        const mongoUsers = get().onlineUsers;
        const allUsers = [...new Set([...userIds, ...mongoUsers])];
        set({ onlineUsers: allUsers });
      });
    });

    socket.on("user-online", (userId) => {
      const currentUsers = get().onlineUsers;
      if (!currentUsers.includes(userId)) {
        set({ onlineUsers: [...currentUsers, userId] });
      }
      // Also sync with MongoDB
      get().fetchOnlineUsers();
    });

    socket.on("user-offline", (userId) => {
      set({ onlineUsers: get().onlineUsers.filter((id) => id !== userId) });
      // Also sync with MongoDB
      get().fetchOnlineUsers();
    });

    socket.on("points-earned", (data) => {
      toast.success(`Earned ${data.points} Chatty Points!`);
    });

    socket.on("incoming-call", (callData) => {
      console.log("📞 Received incoming-call event:", callData);
      console.log("📞 Current authUser:", get().authUser?._id);
      
      const currentUserId = get().authUser?._id?.toString();
      
      if (!currentUserId) {
        console.error("❌ No current user ID, cannot process incoming call");
        return;
      }
      
      // When receiving an incoming call:
      // - fromUserId = the person calling (caller)
      // - targetUserId = the person receiving (should be current user)
      const fromUserId = callData.fromUserId?.toString()?.trim();
      const targetUserId = callData.targetUserId?.toString()?.trim();
      const currentUserIdTrimmed = String(currentUserId).trim();
      
      console.log("📞 Call comparison:");
      console.log("   fromUserId:", fromUserId, "(type:", typeof fromUserId, ")");
      console.log("   currentUserId:", currentUserIdTrimmed, "(type:", typeof currentUserIdTrimmed, ")");
      console.log("   targetUserId:", targetUserId);
      
      // Ignore calls from ourselves - but be more lenient with format comparison
      const fromUserIdNormalized = fromUserId ? String(fromUserId).trim().toLowerCase() : null;
      const currentUserIdNormalized = currentUserIdTrimmed.toLowerCase();
      
      if (fromUserIdNormalized && fromUserIdNormalized === currentUserIdNormalized) {
        console.log("⚠️ Ignoring call from ourselves (normalized match)");
        console.log("   fromUserId:", fromUserIdNormalized);
        console.log("   currentUserId:", currentUserIdNormalized);
        return;
      }
      
      // Check if this call is for us
      // Accept if:
      // 1. targetUserId matches currentUserId (call is for us), OR
      // 2. targetUserId doesn't match but fromUserId is different (might be broadcast or format issue)
      // 3. No targetUserId (broadcast) - accept if fromUserId is different
      const isTargetMatch = targetUserId && (
        targetUserId === currentUserId || 
        targetUserId.toString() === currentUserId.toString() ||
        String(targetUserId).trim() === String(currentUserId).trim()
      );
      
      const isBroadcast = !targetUserId || !isTargetMatch;
      
      // Always accept if it's from someone else (even if broadcast)
      if (isBroadcast && fromUserId && fromUserId !== currentUserId) {
        console.log("📢 Incoming call appears to be broadcast or format mismatch");
        console.log("   Call target:", targetUserId, "Current user:", currentUserId);
        console.log("   Call from:", fromUserId);
        console.log("   ✅ Accepting call (broadcast or format issue, but from different user)");
      } else if (!isBroadcast) {
        console.log("✅ Incoming call target matches current user");
      } else {
        console.log("⚠️ Incoming call rejected - from self or invalid");
        return;
      }
      
      // Ensure we have the call data with all required fields
      const fullCallData = {
        ...callData,
        isIncoming: true,
        fromUserId: fromUserId || callData.from?.toString() || callData.fromUserId,
        targetUserId: targetUserId || currentUserId, // If no targetUserId, assume it's for us
        type: callData.type || "video",
        chatId: callData.chatId,
        callId: callData.callId || `call_${fromUserId}_${currentUserId}_${Date.now()}`,
      };
      
      console.log("📞 Setting incoming call with full data:", fullCallData);
      console.log("📞 Current incomingCall state before:", useCallStore.getState().incomingCall);
      
      // Set the incoming call
      useCallStore.getState().setIncomingCall(fullCallData);
      
      // Verify it was set
      const newState = useCallStore.getState().incomingCall;
      console.log("📞 Incoming call state after setting:", newState);
      
      if (!newState) {
        console.error("❌ Failed to set incoming call! Retrying...");
        setTimeout(() => {
          useCallStore.getState().setIncomingCall(fullCallData);
          console.log("📞 Retried setting incoming call:", useCallStore.getState().incomingCall);
        }, 100);
      } else {
        console.log("✅ Incoming call set successfully");
      }
    });

    socket.on("call-error", (errorData) => {
      console.error("📞 Call error:", errorData);
      toast.error(errorData.message || "Call failed");
    });

    socket.on("call-answered", (data) => {
      console.log("Received call-answered event:", data);
      if (data.answer) {
        // Don't overwrite activeCall if it already exists (caller already has activeCall set)
        // The activeCall should remain as is when the other user accepts
        const currentActiveCall = useCallStore.getState().activeCall;
        if (!currentActiveCall) {
          // Only set if there's no active call (shouldn't happen, but safety check)
          useCallStore.getState().setActiveCall(data);
        } else {
          // Just update the call status, don't replace the entire call object
          console.log("Call already active, keeping existing call data");
        }
      } else {
        useCallStore.getState().clearCall();
      }
    });

    socket.on("call-ended", (data) => {
      console.log("Received call-ended event from:", data?.fromUserId);
      // Clear the call for the other user
      const currentActiveCall = useCallStore.getState().activeCall;
      if (currentActiveCall) {
        console.log("Clearing active call due to call-ended event");
        useCallStore.getState().clearCall();
      }
    });
  },
  disconnectSocket: () => {
    if (get().socket?.connected) get().socket.disconnect();
    // Clear online users sync interval
    if (get().onlineUsersSyncInterval) {
      clearInterval(get().onlineUsersSyncInterval);
      set({ onlineUsersSyncInterval: null });
    }
  },
}));

import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import { useCallStore } from "./useCallStore";

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

  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");
      set({ authUser: res.data });
      get().connectSocket();
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
      console.log("Socket connected:", newSocket.id, "userId:", authUser._id);
      newSocket.emit("join", { userId: authUser._id });
      get().setupSocketListeners(newSocket);
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
    // Remove existing listeners to prevent duplicates
    socket.off("getOnlineUsers");
    socket.off("user-online");
    socket.off("user-offline");
    socket.off("points-earned");
    socket.off("incoming-call");
    socket.off("call-answered");
    socket.off("call-ended");

    socket.on("getOnlineUsers", (userIds) => {
      set({ onlineUsers: userIds });
    });

    socket.on("user-online", (userId) => {
      if (!get().onlineUsers.includes(userId)) {
        set({ onlineUsers: [...get().onlineUsers, userId] });
      }
    });

    socket.on("user-offline", (userId) => {
      set({ onlineUsers: get().onlineUsers.filter((id) => id !== userId) });
    });

    socket.on("points-earned", (data) => {
      toast.success(`Earned ${data.points} Chatty Points!`);
    });

    socket.on("incoming-call", (callData) => {
      console.log("Received incoming-call event:", callData);
      useCallStore.getState().setIncomingCall(callData);
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
  },
}));

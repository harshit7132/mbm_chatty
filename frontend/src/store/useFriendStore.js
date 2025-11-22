import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";

export const useFriendStore = create((set, get) => ({
  pendingRequests: [],
  isLoading: false,
  socket: null,

  // Send friend request
  sendFriendRequest: async (userId) => {
    try {
      await axiosInstance.post(`/friend/send-request/${userId}`);
      toast.success("Friend request sent");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send friend request");
      return false;
    }
  },

  // Accept friend request
  acceptFriendRequest: async (userId) => {
    try {
      await axiosInstance.post(`/friend/accept-request/${userId}`);
      toast.success("Friend request accepted");
      // Remove from pending requests
      set({
        pendingRequests: get().pendingRequests.filter(
          (req) => req.from._id !== userId
        ),
      });
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to accept friend request");
      return false;
    }
  },

  // Reject friend request
  rejectFriendRequest: async (userId) => {
    try {
      await axiosInstance.post(`/friend/reject-request/${userId}`);
      toast.success("Friend request rejected");
      // Remove from pending requests
      set({
        pendingRequests: get().pendingRequests.filter(
          (req) => req.from._id !== userId
        ),
      });
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to reject friend request");
      return false;
    }
  },

  // Get pending friend requests
  getPendingRequests: async () => {
    set({ isLoading: true });
    try {
      const res = await axiosInstance.get("/friend/requests");
      set({ pendingRequests: res.data.requests || [] });
    } catch (error) {
      console.error("Failed to fetch friend requests:", error);
      set({ pendingRequests: [] });
    } finally {
      set({ isLoading: false });
    }
  },

  // Set socket for real-time notifications
  setSocket: (socket) => {
    if (socket) {
      // Remove existing listener to prevent duplicates
      socket.off("new-friend-request");
      
      // Listen for new friend requests
      socket.on("new-friend-request", (requestData) => {
        console.log("📥 Received new friend request:", requestData);
        toast.success(`New friend request from ${requestData.from?.fullName || requestData.from?.username || "Someone"}`);
        
        // Add to pending requests if not already there
        const currentRequests = get().pendingRequests;
        const exists = currentRequests.some(
          req => req.from._id === requestData.from._id
        );
        
        if (!exists) {
          set({
            pendingRequests: [
              {
                from: requestData.from,
                status: requestData.status || "pending",
              },
              ...currentRequests,
            ],
          });
        } else {
          // Refresh the list to get updated data
          get().getPendingRequests();
        }
      });
    }
    set({ socket });
  },
}));


import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";

export const useLeaderboardStore = create((set, get) => ({
  leaderboards: {
    badges: [],
    chats: [],
    "points-earned": [],
    "points-spent": [],
  },
  isLeaderboardsLoading: false,

  getLeaderboard: async (type) => {
    set({ isLeaderboardsLoading: true });
    try {
      const res = await axiosInstance.get(`/leaderboard/${type}`);
      set({
        leaderboards: {
          ...get().leaderboards,
          [type]: res.data,
        },
      });
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to fetch leaderboard");
      return [];
    } finally {
      set({ isLeaderboardsLoading: false });
    }
  },

  getAllLeaderboards: async () => {
    set({ isLeaderboardsLoading: true });
    try {
      const [badges, chats, pointsEarned, pointsSpent] = await Promise.all([
        axiosInstance.get("/leaderboard/badges"),
        axiosInstance.get("/leaderboard/chats"),
        axiosInstance.get("/leaderboard/points-earned"),
        axiosInstance.get("/leaderboard/points-spent"),
      ]);

      set({
        leaderboards: {
          badges: badges.data,
          chats: chats.data,
          "points-earned": pointsEarned.data,
          "points-spent": pointsSpent.data,
        },
      });
    } catch (error) {
      console.error("Failed to fetch leaderboards:", error);
    } finally {
      set({ isLeaderboardsLoading: false });
    }
  },
}));


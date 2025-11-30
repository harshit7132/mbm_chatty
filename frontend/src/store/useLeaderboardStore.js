import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";

export const useLeaderboardStore = create((set, get) => ({
  leaderboards: {
    badges: [],
    chats: [],
    "points-earned": [],
    "points-spent": [],
    "challenges-completed": [],
  },
  isLeaderboardsLoading: false,

  getLeaderboard: async (type) => {
    set({ isLeaderboardsLoading: true });
    try {
      console.log(`Fetching leaderboard for type: ${type}`);
      const res = await axiosInstance.get(`/leaderboard/${type}`);
      console.log(`Received ${res.data?.length || 0} entries for ${type} leaderboard`);
      
      // Ensure we have valid data
      const leaderboardData = Array.isArray(res.data) ? res.data : [];
      
      set({
        leaderboards: {
          ...get().leaderboards,
          [type]: leaderboardData,
        },
      });
      
      console.log(`Successfully updated ${type} leaderboard with ${leaderboardData.length} entries`);
      return leaderboardData;
    } catch (error) {
      console.error(`Error fetching ${type} leaderboard:`, error);
      toast.error(error.response?.data?.message || `Failed to fetch ${type} leaderboard`);
      return [];
    } finally {
      set({ isLeaderboardsLoading: false });
    }
  },

  getAllLeaderboards: async () => {
    set({ isLeaderboardsLoading: true });
    try {
      const [badges, chats, pointsEarned, pointsSpent, challengesCompleted] = await Promise.all([
        axiosInstance.get("/leaderboard/badges"),
        axiosInstance.get("/leaderboard/chats"),
        axiosInstance.get("/leaderboard/points-earned"),
        axiosInstance.get("/leaderboard/points-spent"),
        axiosInstance.get("/leaderboard/challenges-completed"),
      ]);

      set({
        leaderboards: {
          badges: badges.data,
          chats: chats.data,
          "points-earned": pointsEarned.data,
          "points-spent": pointsSpent.data,
          "challenges-completed": challengesCompleted.data,
        },
      });
    } catch (error) {
      console.error("Failed to fetch leaderboards:", error);
    } finally {
      set({ isLeaderboardsLoading: false });
    }
  },
}));


import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";

export const useChallengeStore = create((set, get) => ({
  dailyChallenges: [],
  lifetimeChallenges: [],
  isChallengesLoading: false,

  getDailyChallenges: async () => {
    set({ isChallengesLoading: true });
    try {
      const res = await axiosInstance.get("/challenge/daily");
      set({ dailyChallenges: res.data });
    } catch (error) {
      console.error("Failed to fetch daily challenges:", error);
    } finally {
      set({ isChallengesLoading: false });
    }
  },

  getMyChallenges: async () => {
    set({ isChallengesLoading: true });
    try {
      const res = await axiosInstance.get("/challenge/my-challenges");
      set({
        dailyChallenges: res.data.daily || [],
        lifetimeChallenges: res.data.lifetime || [],
      });
    } catch (error) {
      console.error("Failed to fetch challenges:", error);
    } finally {
      set({ isChallengesLoading: false });
    }
  },

  initLifetimeChallenges: async () => {
    try {
      await axiosInstance.post("/challenge/init-lifetime");
      get().getMyChallenges();
    } catch (error) {
      console.error("Failed to initialize lifetime challenges:", error);
    }
  },
}));


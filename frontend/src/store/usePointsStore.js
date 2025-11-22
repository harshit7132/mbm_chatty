import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";

export const usePointsStore = create((set, get) => ({
  points: 0,
  pointsHistory: [],
  isPointsLoading: false,

  getMyPoints: async () => {
    set({ isPointsLoading: true });
    try {
      const res = await axiosInstance.get("/points/my-points");
      set({ points: res.data.points || 0, pointsHistory: res.data.history || [] });
    } catch (error) {
      console.error("Failed to fetch points:", error);
    } finally {
      set({ isPointsLoading: false });
    }
  },

  awardTimePoints: async () => {
    try {
      await axiosInstance.post("/points/award-time");
    } catch (error) {
      console.error("Failed to award time points:", error);
    }
  },

  spendPoints: async (amount) => {
    try {
      const res = await axiosInstance.post("/points/spend", { amount });
      set({ points: res.data.points });
      toast.success(`Spent ${amount} points`);
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to spend points");
      return false;
    }
  },
}));


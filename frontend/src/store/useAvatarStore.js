import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";

export const useAvatarStore = create((set, get) => ({
  avatars: [],
  isAvatarsLoading: false,

  getMyAvatars: async () => {
    set({ isAvatarsLoading: true });
    try {
      const res = await axiosInstance.get("/avatar/my-avatars");
      set({ avatars: res.data });
    } catch (error) {
      console.error("Failed to fetch avatars:", error);
    } finally {
      set({ isAvatarsLoading: false });
    }
  },

  createAvatar: async (formData) => {
    try {
      const res = await axiosInstance.post("/avatar/create", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      set({ avatars: [...get().avatars, res.data] });
      toast.success("Avatar created successfully");
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create avatar");
      return null;
    }
  },
}));


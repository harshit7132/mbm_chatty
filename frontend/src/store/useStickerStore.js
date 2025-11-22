import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";

export const useStickerStore = create((set, get) => ({
  stickers: [],
  isStickersLoading: false,

  getMyStickers: async () => {
    set({ isStickersLoading: true });
    try {
      const res = await axiosInstance.get("/sticker/my-stickers");
      set({ stickers: res.data });
    } catch (error) {
      console.error("Failed to fetch stickers:", error);
    } finally {
      set({ isStickersLoading: false });
    }
  },

  createSticker: async (formData) => {
    try {
      const res = await axiosInstance.post("/sticker/create", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      set({ stickers: [...get().stickers, res.data] });
      toast.success("Sticker created successfully");
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create sticker");
      return null;
    }
  },
}));


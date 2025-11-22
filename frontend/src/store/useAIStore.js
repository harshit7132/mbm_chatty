import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";

export const useAIStore = create((set, get) => ({
  aiMessages: [],
  isAILoading: false,

  chatWithAI: async (message) => {
    set({ isAILoading: true });
    try {
      const res = await axiosInstance.post("/ai/chat", { message });
      set({
        aiMessages: [
          ...get().aiMessages,
          { role: "user", content: message },
          { role: "assistant", content: res.data.response },
        ],
      });
      return res.data.response;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to chat with AI");
      return null;
    } finally {
      set({ isAILoading: false });
    }
  },

  clearAIMessages: () => set({ aiMessages: [] }),
}));


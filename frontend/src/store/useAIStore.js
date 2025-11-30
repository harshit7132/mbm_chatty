import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useAIStore = create((set, get) => ({
  aiMessages: [],
  isAILoading: false,
  isLoadingHistory: false,
  typingText: "", // Current text being displayed with typewriter effect
  fullResponse: "", // Full response text waiting to be typed
  showFreeMessagesInfo: false,
  showInsufficientPoints: false,
  showPurchaseModal: false,
  insufficientPointsData: null,

  // Fetch AI chat history from MongoDB
  fetchChatHistory: async () => {
    set({ isLoadingHistory: true });
    try {
      const res = await axiosInstance.get("/ai/history");
      const messages = res.data.messages || [];
      
      set({ 
        aiMessages: messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          createdAt: msg.createdAt,
        }))
      });
      return messages;
    } catch (error) {
      console.error("Error fetching AI chat history:", error);
      // Don't show error toast for history fetch failures
      return [];
    } finally {
      set({ isLoadingHistory: false });
    }
  },

  chatWithAI: async (message, isFirstMessage = false) => {
    set({ isAILoading: true, typingText: "", fullResponse: "" });
    
    // Show free messages info on first message
    if (isFirstMessage) {
      set({ showFreeMessagesInfo: true });
    }
    
    try {
      const currentMessages = get().aiMessages;
      
      // Send conversation history for context (last 10 messages to avoid token limits)
      const conversationHistory = currentMessages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content,
      }));
      
      const res = await axiosInstance.post("/ai/chat", { 
        message,
        conversationHistory 
      });
      
      // Refresh user data after successful message (points may have been deducted, free messages count updated)
      // Always refresh to ensure UI shows latest points and free messages count
      await useAuthStore.getState().refreshAuthUser();
      
      // Add user message immediately
      const newMessages = [
        ...currentMessages,
        { role: "user", content: message },
        { role: "assistant", content: "", isTyping: true }, // Start with empty content, will be filled by typewriter
      ];
      
      set({
        aiMessages: newMessages,
        fullResponse: res.data.response, // Store full response for typewriter effect
        typingText: "", // Reset typing text
      });
      
      return res.data.response;
    } catch (error) {
      // Handle insufficient points error
      if (error.response?.status === 402) {
        const errorData = error.response.data;
        set({
          showInsufficientPoints: true,
          insufficientPointsData: {
            currentPoints: errorData.currentPoints || 0,
            requiredPoints: errorData.requiredPoints || 3,
          },
        });
        return null;
      }
      
      toast.error(error.response?.data?.message || "Failed to chat with AI");
      return null;
    } finally {
      set({ isAILoading: false });
    }
  },

  setShowFreeMessagesInfo: (show) => set({ showFreeMessagesInfo: show }),
  setShowInsufficientPoints: (show) => set({ showInsufficientPoints: show }),
  setShowPurchaseModal: (show) => set({ showPurchaseModal: show }),

  updateTypingText: (text) => {
    set({ typingText: text });
    
    // Update the last assistant message with the current typing text
    const messages = get().aiMessages;
    if (messages.length > 0 && messages[messages.length - 1].role === "assistant") {
      const updatedMessages = [...messages];
      updatedMessages[updatedMessages.length - 1] = {
        ...updatedMessages[updatedMessages.length - 1],
        content: text,
        isTyping: text !== get().fullResponse, // Still typing if text doesn't match full response
      };
      set({ aiMessages: updatedMessages });
    }
  },

  finishTyping: () => {
    const { fullResponse } = get();
    if (fullResponse) {
      set({ typingText: fullResponse });
      const messages = get().aiMessages;
      if (messages.length > 0 && messages[messages.length - 1].role === "assistant") {
        const updatedMessages = [...messages];
        updatedMessages[updatedMessages.length - 1] = {
          ...updatedMessages[updatedMessages.length - 1],
          content: fullResponse,
          isTyping: false,
        };
        set({ aiMessages: updatedMessages, fullResponse: "" });
      }
    }
  },

  clearAIMessages: async () => {
    try {
      await axiosInstance.delete("/ai/history");
      set({ aiMessages: [], typingText: "", fullResponse: "" });
      toast.success("Chat history cleared");
    } catch (error) {
      console.error("Error clearing AI chat history:", error);
      // Clear locally even if API call fails
      set({ aiMessages: [], typingText: "", fullResponse: "" });
      toast.error("Failed to clear chat history on server");
    }
  },
}));


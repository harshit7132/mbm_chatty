import { useState, useEffect, useRef } from "react";
import { useAIStore } from "../store/useAIStore";
import { useAuthStore } from "../store/useAuthStore";
import { Send, Bot } from "lucide-react";
import toast from "react-hot-toast";
import FreeMessagesInfoModal from "./FreeMessagesInfoModal";
import InsufficientPointsModal from "./InsufficientPointsModal";
import PurchasePointsModal from "./PurchasePointsModal";

const AIChat = () => {
  const { 
    aiMessages, 
    chatWithAI, 
    isAILoading, 
    isLoadingHistory, 
    fetchChatHistory, 
    clearAIMessages, 
    fullResponse, 
    updateTypingText, 
    finishTyping,
    showFreeMessagesInfo,
    showInsufficientPoints,
    showPurchaseModal,
    insufficientPointsData,
    setShowFreeMessagesInfo,
    setShowInsufficientPoints,
    setShowPurchaseModal,
  } = useAIStore();
  const { authUser } = useAuthStore();
  const [input, setInput] = useState("");
  const [packages, setPackages] = useState([]);
  const messagesEndRef = useRef(null);
  const typewriterIntervalRef = useRef(null);
  const hasShownFreeInfo = useRef(false);

  // Fetch chat history on component mount
  useEffect(() => {
    fetchChatHistory();
  }, [fetchChatHistory]);

  // Fetch pricing packages
  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const { axiosInstance } = await import("../lib/axios");
        const res = await axiosInstance.get("/payment/packages");
        setPackages(res.data.packages || []);
      } catch (error) {
        console.error("Error fetching packages:", error);
      }
    };
    fetchPackages();
  }, []);

  // Typewriter effect for AI responses
  useEffect(() => {
    if (fullResponse && fullResponse.length > 0) {
      let currentIndex = 0;
      
      // Clear any existing interval
      if (typewriterIntervalRef.current) {
        clearInterval(typewriterIntervalRef.current);
      }
      
      // Start typewriter animation
      typewriterIntervalRef.current = setInterval(() => {
        if (currentIndex < fullResponse.length) {
          const textToShow = fullResponse.substring(0, currentIndex + 1);
          updateTypingText(textToShow);
          currentIndex++;
          
          // Auto-scroll as text appears
          messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        } else {
          // Animation complete
          clearInterval(typewriterIntervalRef.current);
          finishTyping();
        }
      }, 30); // Adjust speed: lower = faster (30ms per character ≈ 33 chars/sec)
      
      return () => {
        if (typewriterIntervalRef.current) {
          clearInterval(typewriterIntervalRef.current);
        }
      };
    }
  }, [fullResponse, updateTypingText, finishTyping]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const message = input.trim();
    setInput("");
    
    // Check if this is the first message
    const isFirstMessage = aiMessages.length === 0 && !hasShownFreeInfo.current;
    if (isFirstMessage) {
      hasShownFreeInfo.current = true;
    }
    
    await chatWithAI(message, isFirstMessage);
  };

  const handlePurchaseClick = () => {
    setShowInsufficientPoints(false);
    setShowPurchaseModal(true);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-base-300 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={24} className="text-primary" />
          <h3 className="font-bold text-lg">AI Assistant</h3>
        </div>
        {aiMessages.length > 0 && (
          <button
            className="btn btn-xs btn-ghost"
            onClick={clearAIMessages}
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingHistory ? (
          <div className="text-center text-base-content/70 py-8">
            <span className="loading loading-spinner loading-md"></span>
            <p className="mt-4">Loading chat history...</p>
          </div>
        ) : aiMessages.length === 0 ? (
          <div className="text-center text-base-content/70 py-8">
            <Bot size={48} className="mx-auto mb-4 opacity-50" />
            <p>Start a conversation with AI</p>
          </div>
        ) : (
          aiMessages.map((msg, idx) => (
            <div
              key={idx}
              className={`chat ${msg.role === "user" ? "chat-end" : "chat-start"}`}
            >
              <div className="chat-image avatar">
                <div className="w-10 h-10 rounded-full bg-base-300 flex items-center justify-center p-0">
                  {msg.role === "assistant" ? (
                    <Bot size={20} className="text-primary flex-shrink-0" />
                  ) : (
                    <span className="text-sm font-medium flex items-center justify-center h-full">You</span>
                  )}
                </div>
              </div>
              <div className="chat-bubble">
                <span>{msg.content}</span>
                {msg.isTyping && (
                  <span className="inline-block w-2 h-4 ml-1 bg-base-content animate-pulse">|</span>
                )}
              </div>
            </div>
          ))
        )}
        {isAILoading && (
          <div className="chat chat-start">
            <div className="chat-bubble">
              <span className="loading loading-dots loading-sm"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="p-4 border-t border-base-300">
        <div className="flex gap-2">
          <input
            type="text"
            className="input input-bordered flex-1"
            placeholder="Ask AI anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isAILoading}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!input.trim() || isAILoading}
          >
            <Send size={18} />
          </button>
        </div>
      </form>

      {/* Modals */}
      {showFreeMessagesInfo && (
        <FreeMessagesInfoModal onClose={() => setShowFreeMessagesInfo(false)} />
      )}
      
      {showInsufficientPoints && insufficientPointsData && (
        <InsufficientPointsModal
          onClose={() => setShowInsufficientPoints(false)}
          onPurchase={handlePurchaseClick}
          currentPoints={insufficientPointsData.currentPoints}
          requiredPoints={insufficientPointsData.requiredPoints}
        />
      )}
      
      {showPurchaseModal && (
        <PurchasePointsModal
          onClose={() => setShowPurchaseModal(false)}
          packages={packages}
        />
      )}
    </div>
  );
};

export default AIChat;


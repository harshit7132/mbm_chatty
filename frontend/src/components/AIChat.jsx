import { useState, useEffect, useRef } from "react";
import { useAIStore } from "../store/useAIStore";
import { Send, Bot } from "lucide-react";
import toast from "react-hot-toast";

const AIChat = () => {
  const { aiMessages, chatWithAI, isAILoading, clearAIMessages } = useAIStore();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const message = input.trim();
    setInput("");
    await chatWithAI(message);
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
        {aiMessages.length === 0 ? (
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
                <div className="w-10 rounded-full bg-base-300 flex items-center justify-center">
                  {msg.role === "assistant" ? (
                    <Bot size={20} className="text-primary" />
                  ) : (
                    <span className="text-sm">You</span>
                  )}
                </div>
              </div>
              <div className="chat-bubble">
                {msg.content}
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
    </div>
  );
};

export default AIChat;


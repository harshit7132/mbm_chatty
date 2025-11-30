import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef } from "react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import MessageBubble from "./MessageBubble";
import { useAuthStore } from "../store/useAuthStore";

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    selectedChat,
    typingUsers,
    subscribeToMessages,
    unsubscribeFromMessages,
  } = useChatStore();
  const { authUser, onlineUsers } = useAuthStore();
  const messageEndRef = useRef(null);

  useEffect(() => {
    if (selectedChat) {
      // First, ensure socket is connected
      const { socket } = useAuthStore.getState();
      if (socket && socket.connected) {
        getMessages(selectedChat._id);
        subscribeToMessages();
      } else if (socket) {
        // Wait for socket to connect
        console.log("⏳ Waiting for socket connection...");
        const onConnect = () => {
          console.log("✅ Socket connected, subscribing to messages");
          getMessages(selectedChat._id);
          subscribeToMessages();
          socket.off("connect", onConnect);
        };
        socket.on("connect", onConnect);
        
        return () => {
          socket.off("connect", onConnect);
          unsubscribeFromMessages();
        };
      } else {
        console.error("❌ Socket not available");
      }
      
      // Set up periodic message sync from MongoDB (every 5 seconds as fallback)
      const syncInterval = setInterval(() => {
        const { selectedChat } = useChatStore.getState();
        if (selectedChat && selectedChat._id) {
          useChatStore.getState().syncMessages();
        }
      }, 5000); // Sync every 5 seconds
      
      return () => {
        unsubscribeFromMessages();
        clearInterval(syncInterval);
      };
    }

    return () => unsubscribeFromMessages();
  }, [selectedChat?._id, getMessages, subscribeToMessages, unsubscribeFromMessages]);

  useEffect(() => {
    if (messageEndRef.current && messages) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <ChatHeader />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <MessageBubble
            key={message._id || `msg-${index}-${message.createdAt || Date.now()}`}
            message={message}
            selectedUser={selectedUser}
          />
        ))}
        <div ref={messageEndRef} />
      </div>

      {typingUsers.length > 0 && (
        <div className="px-4 py-2 text-sm text-base-content/70 italic">
          {typingUsers.length === 1
            ? `${selectedUser?.fullName || "Someone"} is typing...`
            : "Multiple people are typing..."}
        </div>
      )}

      <MessageInput />
    </div>
  );
};
export default ChatContainer;

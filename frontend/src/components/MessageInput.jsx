import { useRef, useState, useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";
import { useAuthStore } from "../store/useAuthStore";
import { Image, Send, X, Reply, Smile } from "lucide-react";
import toast from "react-hot-toast";
import StickerPicker from "./StickerPicker";

const MessageInput = () => {
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const fileInputRef = useRef(null);
  const { sendMessage, replyingTo, setReplyingTo, sendTypingIndicator, editingMessage, setEditingMessage, selectedChat } = useChatStore();
  const { selectedGroup } = useGroupStore();
  const { authUser } = useAuthStore();
  const typingTimeoutRef = useRef(null);
  
  // Check if user can send messages in group
  const canSendMessage = !selectedGroup || !selectedGroup.onlyAdminsCanSendMessages || 
    selectedGroup.admins?.some(admin => 
      (typeof admin === 'object' ? admin._id : admin) === authUser._id
    ) || selectedGroup.createdBy === authUser._id;

  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.text || "");
    }
  }, [editingMessage]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleTyping = () => {
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Send typing indicator immediately
    sendTypingIndicator();
    
    // Set timeout to send typing indicator again after a short delay
    // This ensures the indicator stays active while user is typing
    typingTimeoutRef.current = setTimeout(() => {
      // Send again to keep indicator active
      sendTypingIndicator();
    }, 2000); // Send typing indicator every 2 seconds while typing
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() && !imagePreview) return;

    // Check if user can send messages in group
    if (selectedGroup && !canSendMessage) {
      toast.error("Only admins can send messages in this group");
      return;
    }

    try {
      await sendMessage({
        text: text.trim(),
        image: imagePreview,
        replyTo: replyingTo?._id,
      });

      // Clear form
      setText("");
      setImagePreview(null);
      setReplyingTo(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  const handleSelectSticker = (sticker) => {
    sendMessage({
      text: "",
      sticker: sticker.image,
    });
    setShowStickerPicker(false);
  };

  return (
    <div className="p-4 w-full">
      {replyingTo && (
        <div className="mb-2 p-2 bg-base-300 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <Reply size={16} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium">Replying to {replyingTo.senderId?.fullName || "message"}</div>
              <div className="text-xs opacity-70 truncate">{replyingTo.text?.substring(0, 50)}</div>
            </div>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="btn btn-xs btn-ghost"
            type="button"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {editingMessage && (
        <div className="mb-2 p-2 bg-base-300 rounded-lg flex items-center justify-between">
          <div className="text-sm">Editing message</div>
          <button
            onClick={() => setEditingMessage(null)}
            className="btn btn-xs btn-ghost"
            type="button"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {imagePreview && (
        <div className="mb-3 flex items-center gap-2">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-20 h-20 object-cover rounded-lg border border-zinc-700"
            />
            <button
              onClick={removeImage}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300
              flex items-center justify-center"
              type="button"
            >
              <X className="size-3" />
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="flex items-center gap-2 relative">
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            className="w-full input input-bordered rounded-lg input-sm sm:input-md"
            placeholder={editingMessage ? "Edit message..." : "Type a message..."}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              handleTyping();
            }}
          />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImageChange}
          />

          <button
            type="button"
            className={`hidden sm:flex btn btn-circle
                     ${imagePreview ? "text-emerald-500" : "text-zinc-400"}`}
            onClick={() => fileInputRef.current?.click()}
            title="Attach Image"
          >
            <Image size={20} />
          </button>

          <button
            type="button"
            className="hidden sm:flex btn btn-circle btn-ghost"
            onClick={() => setShowStickerPicker(!showStickerPicker)}
            title="Stickers"
          >
            <Smile size={20} />
          </button>
        </div>
        <button
          type="submit"
          className="btn btn-sm btn-circle"
          disabled={(!text.trim() && !imagePreview) || (selectedGroup && !canSendMessage)}
        >
          <Send size={22} />
        </button>

        {showStickerPicker && (
          <div className="absolute bottom-full right-0 mb-2 z-50">
            <StickerPicker
              onSelectSticker={handleSelectSticker}
              onClose={() => setShowStickerPicker(false)}
            />
          </div>
        )}
      </form>
    </div>
  );
};
export default MessageInput;

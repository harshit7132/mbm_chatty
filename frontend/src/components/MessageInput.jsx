import { useRef, useState, useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";
import { useAuthStore } from "../store/useAuthStore";
import { Image, Send, X, Reply, Smile, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import StickerPicker from "./StickerPicker";
import GifPicker from "./GifPicker";

const MessageInput = () => {
  const [text, setText] = useState("");
  const [imagePreviews, setImagePreviews] = useState([]);
  const [gifPreview, setGifPreview] = useState(null);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [isSending, setIsSending] = useState(false);
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
    const files = Array.from(e.target.files);

    // Validate total count (existing + new)
    if (imagePreviews.length + files.length > 5) {
      toast.error("You can only upload up to 5 images per message");
      return;
    }

    // Validate each file is an image
    const invalidFiles = files.filter(file => !file.type.startsWith("image/"));
    if (invalidFiles.length > 0) {
      toast.error("Please select only image files");
      return;
    }

    // Convert all files to base64
    const fileReaders = files.map(file => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });

    Promise.all(fileReaders)
      .then(base64Results => {
        setImagePreviews(prev => [...prev, ...base64Results]);
      })
      .catch(error => {
        console.error("Error reading files:", error);
        toast.error("Failed to read image files");
      });
  };

  const removeImage = (index) => {
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    // Don't clear fileInputRef as we want to allow adding more images
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
    if (!text.trim() && imagePreviews.length === 0 && !gifPreview) return;

    // Check if user can send messages in group
    if (selectedGroup && !canSendMessage) {
      toast.error("Only admins can send messages in this group");
      return;
    }

    try {
      setIsSending(true);
      await sendMessage({
        text: text.trim(),
        images: imagePreviews, // Send array of images
        image: gifPreview, // GIF URL (legacy single image field)
        replyTo: replyingTo?._id,
      });

      // Clear form
      setText("");
      setImagePreviews([]);
      setGifPreview(null);
      setReplyingTo(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleSelectSticker = (sticker) => {
    sendMessage({
      text: "",
      sticker: sticker.image,
    });
    setShowStickerPicker(false);
  };

  const handleSelectGif = (gifUrl) => {
    setGifPreview(gifUrl);
    setShowGifPicker(false);
  };

  const removeGif = () => {
    setGifPreview(null);
  };

  const handleTextChange = (e) => {
    const value = e.target.value;
    setText(value);

    // Detect slash command
    if (value === "/") {
      setShowSlashMenu(true);
    } else {
      setShowSlashMenu(false);
    }

    handleTyping();
  };

  const handleSlashCommand = (command) => {
    if (command === "gif") {
      setShowGifPicker(true);
      setText(""); // Clear the slash
    }
    setShowSlashMenu(false);
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

      {imagePreviews.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {imagePreviews.map((preview, index) => (
            <div key={index} className="relative">
              <img
                src={preview}
                alt={`Preview ${index + 1}`}
                className="w-20 h-20 object-cover rounded-lg border border-zinc-700"
              />
              <button
                onClick={() => removeImage(index)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300
                flex items-center justify-center hover:bg-error hover:text-error-content transition-colors"
                type="button"
                title="Remove image"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
          {imagePreviews.length < 5 && (
            <button
              type="button"
              className="w-20 h-20 rounded-lg border-2 border-dashed border-zinc-700 
              flex items-center justify-center hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
              title={`Add more images (${5 - imagePreviews.length} remaining)`}
            >
              <Image size={20} className="opacity-50" />
            </button>
          )}
        </div>
      )}

      {gifPreview && (
        <div className="mb-3 flex items-center gap-2">
          <div className="relative">
            <img
              src={gifPreview}
              alt="GIF Preview"
              className="w-32 h-32 object-cover rounded-lg border border-zinc-700"
            />
            <button
              onClick={removeGif}
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
            placeholder={editingMessage ? "Edit message..." : "Type a message or / for commands..."}
            value={text}
            onChange={handleTextChange}
          />
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            ref={fileInputRef}
            onChange={handleImageChange}
          />

          <button
            type="button"
            className={`hidden sm:flex btn btn-circle
                     ${imagePreviews.length > 0 ? "text-emerald-500" : "text-zinc-400"}`}
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
          className={`btn btn-sm btn-circle ${isSending ? 'loading' : ''}`}
          disabled={(!text.trim() && imagePreviews.length === 0 && !gifPreview) || (selectedGroup && !canSendMessage) || isSending}
        >
          {!isSending && <Send size={22} />}
        </button>

        {showSlashMenu && (
          <div className="absolute bottom-full left-0 mb-2 bg-base-200 rounded-lg shadow-lg p-2 z-50 min-w-[200px]">
            <button
              type="button"
              onClick={() => handleSlashCommand("gif")}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-base-300 rounded-lg transition-colors text-left"
            >
              <Sparkles size={16} />
              <div>
                <div className="font-medium text-sm">Send GIF</div>
                <div className="text-xs opacity-70">Search and send GIFs</div>
              </div>
            </button>
          </div>
        )}

        {showStickerPicker && (
          <div className="absolute bottom-full right-0 mb-2 z-50">
            <StickerPicker
              onSelectSticker={handleSelectSticker}
              onClose={() => setShowStickerPicker(false)}
            />
          </div>
        )}
      </form>

      {showGifPicker && (
        <GifPicker
          onSelectGif={handleSelectGif}
          onClose={() => setShowGifPicker(false)}
        />
      )}
    </div>
  );
};
export default MessageInput;

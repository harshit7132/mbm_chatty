import { useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useGroupStore } from "../store/useGroupStore";
import { formatMessageTime } from "../lib/utils";
import ImagePreview from "./ImagePreview";
import ForwardModal from "./ForwardModal";
import {
  MoreVertical,
  Edit,
  Trash2,
  Reply,
  Forward,
  Smile,
  X,
  Video,
  Phone,
  AlertTriangle,
} from "lucide-react";

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

const MessageBubble = ({ message, selectedUser }) => {
  const { authUser } = useAuthStore();
  const { selectedGroup } = useGroupStore();
  const {
    editMessage,
    deleteMessage,
    reactToMessage,
    setReplyingTo,
    forwardMessage,
    editingMessage,
    setEditingMessage,
    deleteImageFromMessage,
  } = useChatStore();

  const [showMenu, setShowMenu] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [editText, setEditText] = useState(message.text || "");
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [showForwardModal, setShowForwardModal] = useState(false);

  // Handle both populated object and string ID - normalize both to strings for comparison
  const senderId = typeof message.senderId === 'object' && message.senderId?._id
    ? message.senderId._id
    : message.senderId;
  const normalizedSenderId = senderId?.toString();
  const normalizedAuthUserId = authUser?._id?.toString();
  const isOwnMessage = normalizedSenderId && normalizedAuthUserId && normalizedSenderId === normalizedAuthUserId;

  // Extract sender info for group messages
  const senderInfo = typeof message.senderId === 'object' && message.senderId
    ? message.senderId
    : null;
  const isSuspiciousSender = senderInfo?.isSuspicious || senderInfo?.fullName === "Suspicious";
  const senderName = senderInfo
    ? (senderInfo.fullName || senderInfo.username || senderInfo.email?.split("@")[0] || "User")
    : (selectedUser?.fullName || selectedUser?.username || "User");
  const senderAvatar = senderInfo && !isSuspiciousSender
    ? (senderInfo.profilePic || senderInfo.avatar || "/avatar.png")
    : (selectedUser?.profilePic || "/avatar.png");

  // Check if this is a group message
  const isGroupMessage = !!message.groupId || !!selectedGroup;

  // Check if user is admin in group (for group messages)
  const isGroupAdmin = selectedGroup && (
    selectedGroup.admins?.some(admin =>
      (typeof admin === 'object' ? admin._id : admin) === authUser._id
    ) || selectedGroup.createdBy === authUser._id
  );

  // Can delete if: own message OR (group message AND admin)
  const canDelete = isOwnMessage || (message.groupId && isGroupAdmin);

  const handleEdit = () => {
    if (editText.trim() && editText !== message.text) {
      editMessage(message._id, editText);
    }
    setEditingMessage(null);
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this message?")) {
      deleteMessage(message._id);
    }
    setShowMenu(false);
  };

  const handleReact = (emoji) => {
    reactToMessage(message._id, emoji);
    setShowEmojis(false);
    setShowMenu(false);
  };

  const handleReply = () => {
    setReplyingTo(message);
    setShowMenu(false);
  };

  const handleForward = () => {
    setShowForwardModal(true);
    setShowMenu(false);
  };

  return (
    <div
      className={`chat ${isOwnMessage ? "chat-end" : "chat-start"}`}
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => {
        if (!showEmojis && !editingMessage) setShowMenu(false);
      }}
    >
      <div className="chat-image avatar">
        <div className="size-10 rounded-full border">
          {isSuspiciousSender && !isOwnMessage ? (
            <div className="bg-error/20 flex items-center justify-center w-full h-full rounded-full">
              <AlertTriangle size={20} className="text-error" />
            </div>
          ) : (
            <img
              src={
                isOwnMessage
                  ? authUser.profilePic || "/avatar.png"
                  : senderAvatar
              }
              alt="profile pic"
            />
          )}
        </div>
      </div>

      <div className="chat-header mb-1">
        {/* Show sender name for group messages (not own messages) */}
        {isGroupMessage && !isOwnMessage && (
          <span className={`text-xs font-semibold opacity-70 mr-2 ${isSuspiciousSender ? "text-error" : ""}`}>
            {senderName}
          </span>
        )}
        <time className="text-xs opacity-50 ml-1">
          {formatMessageTime(message.createdAt)}
        </time>
        {message.isEdited && (
          <span className="text-xs opacity-50 ml-2">(edited)</span>
        )}
      </div>

      {message.replyTo && (
        <div className="text-xs opacity-70 mb-1 ml-1 border-l-2 pl-2">
          Replying to: {message.replyTo.text?.substring(0, 50)}...
        </div>
      )}

      {editingMessage?._id === message._id ? (
        <div className="chat-bubble flex flex-col gap-2">
          <input
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="input input-sm"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleEdit}
              className="btn btn-xs btn-primary"
            >
              Save
            </button>
            <button
              onClick={() => {
                setEditingMessage(null);
                setEditText(message.text || "");
              }}
              className="btn btn-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="chat-bubble flex flex-col gap-1 relative">
          {message.isUploading && (
            <div className="absolute inset-0 bg-base-300/80 rounded-lg flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-2">
                <span className="loading loading-spinner loading-md"></span>
                <span className="text-xs opacity-70">Uploading images...</span>
              </div>
            </div>
          )}
          {message.callType && (
            <div className="flex items-center gap-2 text-sm opacity-80 italic">
              {message.callType === "video" ? (
                <Video size={16} />
              ) : (
                <Phone size={16} />
              )}
              <span>{message.text || `${message.callType === "video" ? "Video" : "Voice"} call ${message.callStatus || "started"}`}</span>
            </div>
          )}
          {/* Display multiple images or single image */}
          {(message.images && message.images.length > 0) ? (
            <div className={`grid gap-1 mb-2 ${message.images.length === 1 ? 'grid-cols-1' :
              message.images.length === 2 ? 'grid-cols-2' :
                message.images.length === 3 ? 'grid-cols-3' :
                  'grid-cols-2'
              }`}>
              {message.images.map((img, idx) => (
                <div key={idx} className="relative group">
                  <img
                    src={img}
                    alt={`Attachment ${idx + 1}`}
                    className={`rounded-md object-cover cursor-pointer hover:opacity-90 transition-opacity ${message.images.length === 1 ? 'sm:max-w-[200px]' :
                      'w-full h-24 sm:h-32'
                      }`}
                    onClick={() => {
                      setPreviewImageIndex(idx);
                      setShowImagePreview(true);
                    }}
                  />
                  {/* Delete button for individual image */}
                  {isOwnMessage && !message.isUploading && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm('Delete this image?')) {
                          deleteImageFromMessage(message._id, idx);
                        }
                      }}
                      className="absolute top-1 right-1 btn btn-xs btn-circle btn-error opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete this image"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : message.image ? (
            <img
              src={message.image}
              alt="Attachment"
              className="sm:max-w-[200px] rounded-md mb-2 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => {
                setPreviewImageIndex(0);
                setShowImagePreview(true);
              }}
            />
          ) : null}
          {message.sticker && (
            <img
              src={message.sticker}
              alt="Sticker"
              className="w-32 h-32 object-contain"
            />
          )}
          {/* Forwarded message indicator */}
          {message.forwardedFromName && (
            <div className="text-xs opacity-60 italic mb-1 flex items-center gap-1">
              <Forward size={12} />
              Forwarded from: {message.forwardedFromName}
            </div>
          )}
          {message.text && !message.callType && <p>{message.text}</p>}

          {message.reactions && message.reactions.length > 0 && (
            <div className="flex gap-1 flex-wrap mt-1">
              {Object.entries(
                message.reactions.reduce((acc, r) => {
                  acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                  return acc;
                }, {})
              ).map(([emoji, count]) => (
                <span
                  key={emoji}
                  className="text-xs bg-base-300 px-2 py-1 rounded-full"
                >
                  {emoji} {count}
                </span>
              ))}
            </div>
          )}

          {showMenu && isOwnMessage && (
            <div className="absolute -top-8 right-0 bg-base-200 rounded-lg shadow-lg p-1 flex gap-1 z-10">
              <button
                onClick={() => setShowEmojis(!showEmojis)}
                className="btn btn-xs btn-ghost"
                title="React"
              >
                <Smile size={14} />
              </button>
              <button
                onClick={handleReply}
                className="btn btn-xs btn-ghost"
                title="Reply"
              >
                <Reply size={14} />
              </button>
              <button
                onClick={() => {
                  setEditingMessage(message);
                  setEditText(message.text || "");
                }}
                className="btn btn-xs btn-ghost"
                title="Edit"
              >
                <Edit size={14} />
              </button>
              <button
                onClick={handleForward}
                className="btn btn-xs btn-ghost"
                title="Forward"
              >
                <Forward size={14} />
              </button>
              <button
                onClick={handleDelete}
                className="btn btn-xs btn-ghost text-error"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}

          {showMenu && !isOwnMessage && !(message.groupId && isGroupAdmin) && (
            <div className="absolute -top-8 left-0 bg-base-200 rounded-lg shadow-lg p-1 flex gap-1 z-10">
              <button
                onClick={() => setShowEmojis(!showEmojis)}
                className="btn btn-xs btn-ghost"
                title="React"
              >
                <Smile size={14} />
              </button>
              <button
                onClick={handleReply}
                className="btn btn-xs btn-ghost"
                title="Reply"
              >
                <Reply size={14} />
              </button>
              <button
                onClick={handleForward}
                className="btn btn-xs btn-ghost"
                title="Forward"
              >
                <Forward size={14} />
              </button>
              {message.groupId && isGroupAdmin && (
                <button
                  onClick={handleDelete}
                  className="btn btn-xs btn-ghost text-error"
                  title="Delete (Admin)"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )}

          {showEmojis && (
            <div className="absolute -top-12 bg-base-200 rounded-lg shadow-lg p-2 flex gap-2 z-20">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleReact(emoji)}
                  className="text-2xl hover:scale-125 transition-transform"
                >
                  {emoji}
                </button>
              ))}
              <button
                onClick={() => setShowEmojis(false)}
                className="btn btn-xs btn-ghost"
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Image Preview Modal */}
      {showImagePreview && (
        <ImagePreview
          images={message.images && message.images.length > 0 ? message.images : [message.image]}
          initialIndex={previewImageIndex}
          onClose={() => setShowImagePreview(false)}
        />
      )}

      {/* Forward Modal */}
      {showForwardModal && (
        <ForwardModal
          message={message}
          onClose={() => setShowForwardModal(false)}
        />
      )}
    </div>
  );
};

export default MessageBubble;


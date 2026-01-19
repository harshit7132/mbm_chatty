import { useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { X, Send } from "lucide-react";
import toast from "react-hot-toast";

const ForwardModal = ({ message, onClose }) => {
    const { authUser } = useAuthStore();
    const { users, forwardMessage, selectedUser } = useChatStore(); // Get selectedUser to exclude
    const [selectedChats, setSelectedChats] = useState([]);
    const [isForwarding, setIsForwarding] = useState(false);

    // Get available users to forward to (exclude yourself and current chat user)
    const availableChats = (users || []).filter(user => {
        if (!user || !user._id) return false;
        if (user._id === authUser._id) return false; // Exclude yourself
        if (selectedUser && user._id === selectedUser._id) return false; // Exclude current chat user
        return true;
    });

    const toggleChat = (chatId) => {
        setSelectedChats(prev =>
            prev.includes(chatId)
                ? prev.filter(id => id !== chatId)
                : [...prev, chatId]
        );
    };

    const handleForward = async () => {
        if (selectedChats.length === 0) {
            toast.error("Please select at least one chat");
            return;
        }

        setIsForwarding(true);
        try {
            await forwardMessage(message._id, selectedChats);
            toast.success(`Forwarded to ${selectedChats.length} chat(s)`);
            onClose();
        } catch (error) {
            toast.error("Failed to forward message");
        } finally {
            setIsForwarding(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-base-200 rounded-lg p-6 w-full max-w-md max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Forward Message</h2>
                    <button onClick={onClose} className="btn btn-sm btn-ghost btn-circle">
                        <X size={20} />
                    </button>
                </div>

                {/* Message Preview */}
                <div className="bg-base-300 p-3 rounded-lg mb-4">
                    <p className="text-sm opacity-70 mb-1">Forwarding:</p>
                    {message.text && <p className="text-sm">{message.text.substring(0, 100)}{message.text.length > 100 ? "..." : ""}</p>}
                    {message.images && message.images.length > 0 && (
                        <p className="text-xs opacity-60 mt-1">📷 {message.images.length} image(s)</p>
                    )}
                </div>

                {/* Chat List */}
                <div className="flex-1 overflow-y-auto mb-4">
                    <p className="text-sm opacity-70 mb-2">Select chats:</p>
                    {availableChats.length === 0 ? (
                        <p className="text-sm opacity-50 text-center py-4">No chats available</p>
                    ) : (
                        <div className="space-y-2">
                            {availableChats.map(user => {
                                const displayName = user.fullName || user.username || user.email?.split('@')[0] || "User";
                                const avatar = user.profilePic || user.avatar || "/avatar.png";
                                // Create chat ID in format: chat_userId1_userId2
                                const chatId = `chat_${authUser._id}_${user._id}`;

                                return (
                                    <label
                                        key={chatId}
                                        className="flex items-center gap-3 p-2 hover:bg-base-300 rounded-lg cursor-pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            className="checkbox checkbox-primary"
                                            checked={selectedChats.includes(chatId)}
                                            onChange={() => toggleChat(chatId)}
                                        />
                                        <div className="avatar">
                                            <div className="size-10 rounded-full">
                                                <img src={avatar} alt={displayName} />
                                            </div>
                                        </div>
                                        <span className="flex-1">{displayName}</span>
                                    </label>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-2">
                    <button
                        onClick={onClose}
                        className="btn btn-ghost flex-1"
                        disabled={isForwarding}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleForward}
                        className={`btn btn-primary flex-1 ${isForwarding ? 'loading' : ''}`}
                        disabled={selectedChats.length === 0 || isForwarding}
                    >
                        {!isForwarding && <Send size={18} />}
                        Forward ({selectedChats.length})
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ForwardModal;

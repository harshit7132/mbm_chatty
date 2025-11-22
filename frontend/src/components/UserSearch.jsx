import { useState, useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useFriendStore } from "../store/useFriendStore";
import { Search, X, UserPlus, Check, XCircle } from "lucide-react";

const UserSearch = ({ onSelectUser, onClose }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const { searchUsers } = useChatStore();
  const { onlineUsers, authUser } = useAuthStore();
  const { sendFriendRequest, acceptFriendRequest, rejectFriendRequest } = useFriendStore();
  const [processingRequest, setProcessingRequest] = useState(null);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (query.trim()) {
        handleSearch(query);
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const handleSearch = async (searchQuery) => {
    setIsSearching(true);
    const users = await searchUsers(searchQuery);
    setResults(users);
    setIsSearching(false);
  };

  const handleSelectUser = (user) => {
    onSelectUser(user);
    setQuery("");
    setResults([]);
    // Don't auto-close to allow multiple selections
    // onClose will be called explicitly when needed
  };

  const handleSendFriendRequest = async (userId, e) => {
    e.stopPropagation(); // Prevent selecting user
    setProcessingRequest(userId);
    await sendFriendRequest(userId);
    // Refresh search results to update friend status
    if (query.trim()) {
      handleSearch(query);
    }
    setProcessingRequest(null);
  };

  const handleAcceptRequest = async (userId, e) => {
    e.stopPropagation();
    setProcessingRequest(userId);
    await acceptFriendRequest(userId);
    if (query.trim()) {
      handleSearch(query);
    }
    setProcessingRequest(null);
  };

  const handleRejectRequest = async (userId, e) => {
    e.stopPropagation();
    setProcessingRequest(userId);
    await rejectFriendRequest(userId);
    if (query.trim()) {
      handleSearch(query);
    }
    setProcessingRequest(null);
  };

  return (
    <div className="relative">
      <div className="form-control">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-base-content/50" size={18} />
          <input
            type="text"
            placeholder="Search users..."
            className="input input-bordered w-full pl-10 pr-10"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                setResults([]);
              }}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 btn btn-ghost btn-xs"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {query && (
        <div className="absolute z-50 w-full mt-2 bg-base-100 rounded-lg shadow-lg border border-base-300 max-h-96 overflow-y-auto">
          {isSearching ? (
            <div className="p-4 text-center">
              <span className="loading loading-spinner"></span>
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-base-content/70">
              No users found
            </div>
          ) : (
            <div className="py-2">
              {results.map((user) => {
                const isFriend = user.isFriend;
                const isCurrentUser = user._id === authUser?._id;
                const isProcessing = processingRequest === user._id;

                return (
                  <div
                    key={user._id}
                    className="w-full px-4 py-3 hover:bg-base-200 flex items-center gap-3"
                  >
                    <button
                      onClick={() => handleSelectUser(user)}
                      className="flex items-center gap-3 flex-1 text-left"
                    >
                      <div className="avatar">
                        <div className="w-10 rounded-full relative">
                          <img
                            src={user.profilePic || "/avatar.png"}
                            alt={user.fullName}
                          />
                          {onlineUsers.includes(user._id) && (
                            <span className="absolute bottom-0 right-0 size-3 bg-green-500 rounded-full ring-2 ring-base-100"></span>
                          )}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{user.fullName}</div>
                        <div className="text-sm text-base-content/70">
                          {onlineUsers.includes(user._id) ? "Online" : "Offline"}
                          {isFriend && " • Friend"}
                        </div>
                      </div>
                    </button>
                    {!isCurrentUser && !isFriend && (
                      <button
                        onClick={(e) => handleSendFriendRequest(user._id, e)}
                        disabled={isProcessing}
                        className="btn btn-sm btn-primary"
                        title="Send friend request"
                      >
                        {isProcessing ? (
                          <span className="loading loading-spinner loading-xs"></span>
                        ) : (
                          <UserPlus size={16} />
                        )}
                      </button>
                    )}
                    {isFriend && (
                      <div className="text-xs text-green-500 font-medium">
                        Friend
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserSearch;


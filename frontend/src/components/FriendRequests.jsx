import { useEffect, useState } from "react";
import { useFriendStore } from "../store/useFriendStore";
import { useAuthStore } from "../store/useAuthStore";
import { UserPlus, Check, X, Bell } from "lucide-react";
import toast from "react-hot-toast";

const FriendRequests = () => {
  const { pendingRequests, getPendingRequests, acceptFriendRequest, rejectFriendRequest, isLoading, setSocket } = useFriendStore();
  const { onlineUsers, socket } = useAuthStore();
  const [showModal, setShowModal] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  // Set up socket listener for friend requests
  useEffect(() => {
    if (socket) {
      setSocket(socket);
    }
  }, [socket, setSocket]);

  useEffect(() => {
    getPendingRequests();
    // Refresh every 30 seconds (as fallback)
    const interval = setInterval(() => {
      getPendingRequests();
    }, 30000);
    return () => clearInterval(interval);
  }, [getPendingRequests]);

  const handleAccept = async (userId) => {
    setProcessingId(userId);
    const success = await acceptFriendRequest(userId);
    if (success) {
      getPendingRequests(); // Refresh list
    }
    setProcessingId(null);
  };

  const handleReject = async (userId) => {
    setProcessingId(userId);
    const success = await rejectFriendRequest(userId);
    if (success) {
      getPendingRequests(); // Refresh list
    }
    setProcessingId(null);
  };

  const pendingCount = pendingRequests.length;

  return (
    <>
      {/* Friend Request Bell Icon */}
      <div className="relative">
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-ghost btn-circle relative"
          title="Friend Requests"
        >
          <Bell size={20} />
          {pendingCount > 0 && (
            <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {pendingCount > 9 ? "9+" : pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* Friend Requests Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowModal(false)}>
          <div className="bg-base-100 rounded-lg shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-base-300">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <UserPlus size={24} />
                Friend Requests
                {pendingCount > 0 && (
                  <span className="badge badge-primary">{pendingCount}</span>
                )}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="btn btn-ghost btn-sm btn-circle"
              >
                <X size={20} />
              </button>
            </div>

            {/* Requests List */}
            <div className="flex-1 overflow-y-auto p-4">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <span className="loading loading-spinner"></span>
                </div>
              ) : pendingRequests.length === 0 ? (
                <div className="text-center py-8 text-base-content/70">
                  <UserPlus size={48} className="mx-auto mb-4 opacity-50" />
                  <p>No pending friend requests</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.map((request, index) => {
                    const user = request.from;
                    if (!user) return null; // Skip if user data is missing
                    const isProcessing = processingId === user._id;
                    
                    return (
                      <div
                        key={user._id || `request-${index}`}
                        className="flex items-center gap-3 p-3 bg-base-200 rounded-lg"
                      >
                        <div className="avatar relative">
                          <div className="w-12 rounded-full">
                            <img
                              src={user.profilePic || user.avatar || "/avatar.png"}
                              alt={user.fullName}
                            />
                          </div>
                          {onlineUsers.includes(user._id) && (
                            <span className="absolute bottom-0 right-0 size-3 bg-green-500 rounded-full ring-2 ring-base-200"></span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {user.fullName || user.username || user.email?.split("@")[0] || "User"}
                          </div>
                          <div className="text-sm text-base-content/70">
                            {onlineUsers.includes(user._id) ? "Online" : "Offline"}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAccept(user._id)}
                            disabled={isProcessing}
                            className="btn btn-sm btn-success"
                            title="Accept"
                          >
                            {isProcessing ? (
                              <span className="loading loading-spinner loading-xs"></span>
                            ) : (
                              <Check size={16} />
                            )}
                          </button>
                          <button
                            onClick={() => handleReject(user._id)}
                            disabled={isProcessing}
                            className="btn btn-sm btn-error"
                            title="Reject"
                          >
                            {isProcessing ? (
                              <span className="loading loading-spinner loading-xs"></span>
                            ) : (
                              <X size={16} />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default FriendRequests;


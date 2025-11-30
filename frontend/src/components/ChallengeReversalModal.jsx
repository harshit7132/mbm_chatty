import { X, AlertTriangle } from "lucide-react";
import { useChallengeStore } from "../store/useChallengeStore";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";

const ChallengeReversalModal = ({ reversalData, onClose }) => {
  const { refreshChallenges } = useChallengeStore();
  const { authUser, refreshAuthUser } = useAuthStore();
  const { pendingDeletion, clearPendingDeletion, deleteMessage } = useChatStore();

  // Use pendingDeletion if available (for delete confirmation), otherwise use reversalData (for after deletion)
  const data = pendingDeletion?.reversalData || reversalData;

  console.log("🔍 [MODAL] ChallengeReversalModal rendered:", { pendingDeletion, reversalData, data });

  if (!data || !data.hasReversals) {
    console.log("🔍 [MODAL] No data or hasReversals=false, returning null");
    return null;
  }
  
  console.log("✅ [MODAL] ChallengeReversalModal will render with data:", data);

  const handleConfirm = async () => {
    // If this is a pending deletion, confirm it
    if (pendingDeletion) {
      await deleteMessage(pendingDeletion.messageId, true); // confirmed = true
      clearPendingDeletion();
    }
    
    // Refresh challenges and user data
    await refreshChallenges();
    await refreshAuthUser();
    onClose();
  };

  const handleCancel = () => {
    // Cancel deletion - don't delete the message
    if (pendingDeletion) {
      clearPendingDeletion();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={handleCancel}>
      <div 
        className="bg-base-100 rounded-lg shadow-xl w-full max-w-md mx-4 border-2 border-warning"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-base-300 bg-warning/10">
          <div className="flex items-center gap-2">
            <AlertTriangle className="text-warning" size={24} />
            <h2 className="text-xl font-bold text-warning">
              {pendingDeletion ? "Delete Message Warning" : "Challenge Rewards Revoked"}
            </h2>
          </div>
          <button
            onClick={handleCancel}
            className="btn btn-ghost btn-sm btn-circle"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-base mb-4">
            {pendingDeletion 
              ? "Deleting this message will affect your challenge progress. The following rewards will be revoked:"
              : "You deleted messages that affected your challenge progress. The following rewards have been revoked:"
            }
          </p>

          {/* Affected Challenges */}
          <div className="space-y-3 mb-4">
            {data.affectedChallenges.map((challenge) => (
              <div 
                key={challenge._id} 
                className="bg-base-200 rounded-lg p-3 border border-base-300"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{challenge.title}</p>
                    {challenge.pointsRevoked > 0 && (
                      <p className="text-sm text-error">
                        -{challenge.pointsRevoked} points revoked
                      </p>
                    )}
                    {challenge.badgeRevoked && (
                      <p className="text-sm text-error">
                        Badge "{challenge.badgeRevoked}" removed
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Total Points Revoked */}
          {data.totalPointsRevoked > 0 && (
            <div className="bg-error/10 border border-error rounded-lg p-4 mb-4">
              <p className="text-lg font-bold text-error">
                Total Points {pendingDeletion ? "Will Be" : ""} Revoked: {data.totalPointsRevoked}
              </p>
            </div>
          )}

          {/* Warning Message */}
          <div className="bg-warning/10 border border-warning rounded-lg p-3">
            <p className="text-sm text-warning">
              ⚠️ Your challenge progress has been reset. Complete challenges again to earn rewards.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-base-300">
          {pendingDeletion ? (
            <>
              <button
                onClick={handleCancel}
                className="btn btn-ghost"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="btn btn-error"
              >
                Delete Anyway
              </button>
            </>
          ) : (
            <button
              onClick={handleConfirm}
              className="btn btn-primary"
            >
              I Understand
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChallengeReversalModal;


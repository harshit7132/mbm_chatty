import { X, AlertTriangle } from "lucide-react";
import { useChatStore } from "../store/useChatStore";

const ThresholdWarningModal = ({ warningData, onClose }) => {
  const { thresholdWarning, clearThresholdWarning, deleteMessage } = useChatStore();

  const data = thresholdWarning?.warningData || warningData;

  console.log("🔍 [MODAL] ThresholdWarningModal rendered:", { thresholdWarning, warningData, data });

  if (!data || !data.hasWarnings) {
    console.log("🔍 [MODAL] No data or hasWarnings=false, returning null");
    return null;
  }
  
  console.log("✅ [MODAL] ThresholdWarningModal will render with data:", data);

  const handleConfirm = async () => {
    // User confirmed - proceed with deletion
    if (thresholdWarning) {
      // Continue with deletion (it will check for reversals next)
      await deleteMessage(thresholdWarning.messageId, false); // Not confirmed yet, will show reversal modal if needed
      clearThresholdWarning();
    }
    onClose();
  };

  const handleCancel = () => {
    // Cancel deletion - don't delete the message
    if (thresholdWarning) {
      clearThresholdWarning();
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
            <h2 className="text-xl font-bold text-warning">Warning: Challenge Threshold</h2>
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
          <p className="text-base mb-4 font-semibold">
            ⚠️ If you delete this message, you will be close to losing challenge progress:
          </p>

          {/* Affected Challenges */}
          <div className="space-y-3 mb-4">
            {data.challenges.map((challenge) => (
              <div 
                key={challenge._id} 
                className="bg-base-200 rounded-lg p-3 border border-warning"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{challenge.title}</p>
                    <p className="text-sm text-warning">
                      Current: {challenge.current} / {challenge.target}
                    </p>
                    <p className="text-sm text-error">
                      After deletion: {challenge.newCurrent} / {challenge.target}
                    </p>
                    {challenge.points > 0 && (
                      <p className="text-sm text-base-content/70">
                        Reward: {challenge.points} points
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Warning Message */}
          <div className="bg-error/10 border border-error rounded-lg p-3">
            <p className="text-sm text-error font-semibold">
              ⚠️ If you delete more messages, your points from these challenges will be removed!
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-base-300">
          <button
            onClick={handleCancel}
            className="btn btn-ghost"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="btn btn-warning"
          >
            Delete Anyway
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThresholdWarningModal;


import { X, AlertCircle, ShoppingCart, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";

const InsufficientPointsModal = ({ onClose, onPurchase, currentPoints, requiredPoints }) => {
  const navigate = useNavigate();

  const handleChallenges = () => {
    onClose();
    navigate("/challenges");
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div 
        className="bg-base-100 rounded-lg shadow-xl w-full max-w-md mx-4 border-2 border-error"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-base-300 bg-error/10">
          <div className="flex items-center gap-2">
            <AlertCircle className="text-error" size={24} />
            <h2 className="text-xl font-bold text-error">Insufficient Chatty Points</h2>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm btn-circle"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="space-y-4">
            <p className="text-base">
              You don't have enough Chatty Points to send this message.
            </p>
            <div className="bg-base-200 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm">Required Points:</span>
                <span className="font-bold text-error">{requiredPoints}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Your Points:</span>
                <span className="font-bold">{currentPoints}</span>
              </div>
            </div>
            <p className="text-base-content/80 text-sm">
              Complete challenges or purchase points to continue chatting with AI.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-base-300">
          <button
            onClick={handleChallenges}
            className="btn btn-outline btn-primary"
          >
            <Trophy size={18} className="mr-2" />
            Challenges
          </button>
          <button
            onClick={onPurchase}
            className="btn btn-primary"
          >
            <ShoppingCart size={18} className="mr-2" />
            Purchase Points
          </button>
        </div>
      </div>
    </div>
  );
};

export default InsufficientPointsModal;


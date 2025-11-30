import { X, Info } from "lucide-react";

const FreeMessagesInfoModal = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div 
        className="bg-base-100 rounded-lg shadow-xl w-full max-w-md mx-4 border-2 border-primary"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-base-300 bg-primary/10">
          <div className="flex items-center gap-2">
            <Info className="text-primary" size={24} />
            <h2 className="text-xl font-bold text-primary">Welcome to AI Chat!</h2>
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
              🎉 <strong>You get 2 free messages!</strong>
            </p>
            <p className="text-base-content/80">
              After your first 2 messages, each message will cost <strong className="text-primary">3 Chatty Points</strong>.
            </p>
            <div className="bg-base-200 rounded-lg p-4 mt-4">
              <p className="text-sm font-semibold mb-2">💡 Ways to earn Chatty Points:</p>
              <ul className="text-sm space-y-1 text-base-content/80">
                <li>• Complete challenges</li>
                <li>• Purchase points directly</li>
                <li>• Earn through daily activities</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-base-300">
          <button
            onClick={onClose}
            className="btn btn-primary"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};

export default FreeMessagesInfoModal;


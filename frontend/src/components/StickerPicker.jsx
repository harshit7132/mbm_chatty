import { useEffect, useState } from "react";
import { useStickerStore } from "../store/useStickerStore";
import { Plus, X } from "lucide-react";
import toast from "react-hot-toast";

const StickerPicker = ({ onSelectSticker, onClose }) => {
  const { stickers, getMyStickers, createSticker, isStickersLoading } = useStickerStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [stickerFile, setStickerFile] = useState(null);
  const [stickerName, setStickerName] = useState("");

  useEffect(() => {
    getMyStickers();
  }, [getMyStickers]);

  const handleCreateSticker = async (e) => {
    e.preventDefault();
    if (!stickerFile || !stickerName.trim()) {
      toast.error("Please provide a name and image");
      return;
    }

    const formData = new FormData();
    formData.append("image", stickerFile);
    formData.append("name", stickerName);

    const sticker = await createSticker(formData);
    if (sticker) {
      setStickerFile(null);
      setStickerName("");
      setShowCreateModal(false);
    }
  };

  return (
    <div className="bg-base-100 border border-base-300 rounded-lg shadow-lg p-4 w-80 max-h-96 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold">Stickers</h3>
        <div className="flex gap-2">
          <button
            className="btn btn-xs btn-primary"
            onClick={() => setShowCreateModal(true)}
            title="Create Sticker"
          >
            <Plus size={14} />
          </button>
          {onClose && (
            <button className="btn btn-xs btn-ghost" onClick={onClose}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isStickersLoading ? (
          <div className="flex justify-center py-4">
            <span className="loading loading-spinner"></span>
          </div>
        ) : stickers.length === 0 ? (
          <div className="text-center py-4 text-base-content/70">
            No stickers yet. Create one!
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {stickers.map((sticker) => (
              <button
                key={sticker._id}
                onClick={() => {
                  onSelectSticker(sticker);
                  if (onClose) onClose();
                }}
                className="aspect-square p-2 hover:bg-base-200 rounded-lg transition-colors"
              >
                <img
                  src={sticker.image}
                  alt={sticker.name}
                  className="w-full h-full object-contain"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Create Sticker</h3>
            <form onSubmit={handleCreateSticker}>
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Sticker Name</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={stickerName}
                  onChange={(e) => setStickerName(e.target.value)}
                  required
                />
              </div>
              <div className="form-control mb-4">
                <label className="label">
                  <span className="label-text">Sticker Image</span>
                </label>
                <input
                  type="file"
                  accept="image/*"
                  className="file-input file-input-bordered"
                  onChange={(e) => setStickerFile(e.target.files[0])}
                  required
                />
              </div>
              <div className="modal-action">
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setShowCreateModal(false);
                    setStickerFile(null);
                    setStickerName("");
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StickerPicker;


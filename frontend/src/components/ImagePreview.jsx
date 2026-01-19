import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

const ImagePreview = ({ images, initialIndex = 0, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                onClose();
            } else if (e.key === "ArrowLeft") {
                handlePrevious();
            } else if (e.key === "ArrowRight") {
                handleNext();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [currentIndex, onClose]);

    const handlePrevious = () => {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
    };

    const handleNext = () => {
        setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
    };

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center"
            onClick={handleBackdropClick}
        >
            {/* Close button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-base-300 hover:bg-base-200 transition-colors z-10"
                title="Close (ESC)"
            >
                <X size={24} />
            </button>

            {/* Image counter */}
            {images.length > 1 && (
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-base-300 rounded-full text-sm z-10">
                    {currentIndex + 1} / {images.length}
                </div>
            )}

            {/* Main image */}
            <div className="relative w-full h-full flex items-center justify-center p-12">
                <img
                    src={images[currentIndex]}
                    alt={`Preview ${currentIndex + 1}`}
                    className="max-w-full max-h-full object-contain"
                />
            </div>

            {/* Navigation buttons (only show if more than 1 image) */}
            {images.length > 1 && (
                <>
                    <button
                        onClick={handlePrevious}
                        className="absolute left-4 top-1/2 transform -translate-y-1/2 p-3 rounded-full bg-base-300 hover:bg-base-200 transition-colors"
                        title="Previous (←)"
                    >
                        <ChevronLeft size={28} />
                    </button>
                    <button
                        onClick={handleNext}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 p-3 rounded-full bg-base-300 hover:bg-base-200 transition-colors"
                        title="Next (→)"
                    >
                        <ChevronRight size={28} />
                    </button>
                </>
            )}

            {/* Thumbnail strip (if more than 1 image) */}
            {images.length > 1 && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 max-w-screen-lg overflow-x-auto p-2 bg-base-300 rounded-lg">
                    {images.map((img, idx) => (
                        <button
                            key={idx}
                            onClick={() => setCurrentIndex(idx)}
                            className={`flex-shrink-0 w-16 h-16 rounded overflow-hidden border-2 transition-all ${idx === currentIndex
                                    ? "border-primary scale-110"
                                    : "border-transparent opacity-60 hover:opacity-100"
                                }`}
                        >
                            <img
                                src={img}
                                alt={`Thumbnail ${idx + 1}`}
                                className="w-full h-full object-cover"
                            />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ImagePreview;

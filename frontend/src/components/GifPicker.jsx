import { useState, useEffect, useRef } from "react";
import { X, Search, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

const GIPHY_API_KEY = "YOUR_API_KEY_HERE"; // User needs to replace this

const GifPicker = ({ onSelectGif, onClose }) => {
    const [gifs, setGifs] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const searchTimeoutRef = useRef(null);

    // Load trending GIFs on mount
    useEffect(() => {
        loadTrendingGifs();
    }, []);

    // Search GIFs when query changes
    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (searchQuery.trim()) {
            searchTimeoutRef.current = setTimeout(() => {
                searchGifs(searchQuery);
            }, 500); // Debounce search
        } else {
            loadTrendingGifs();
        }

        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [searchQuery]);

    const loadTrendingGifs = async () => {
        if (GIPHY_API_KEY === "YOUR_API_KEY_HERE") {
            setError("Please set your Giphy API key in GifPicker.jsx");
            toast.error("Giphy API key not configured");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=g`
            );

            if (!response.ok) {
                throw new Error("Failed to load trending GIFs");
            }

            const data = await response.json();
            setGifs(data.data || []);
        } catch (err) {
            console.error("Error loading trending GIFs:", err);
            setError("Failed to load GIFs. Please check your API key.");
            toast.error("Failed to load GIFs");
        } finally {
            setLoading(false);
        }
    };

    const searchGifs = async (query) => {
        if (GIPHY_API_KEY === "YOUR_API_KEY_HERE") {
            setError("Please set your Giphy API key in GifPicker.jsx");
            toast.error("Giphy API key not configured");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(
                `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(
                    query
                )}&limit=20&rating=g`
            );

            if (!response.ok) {
                throw new Error("Failed to search GIFs");
            }

            const data = await response.json();
            setGifs(data.data || []);
        } catch (err) {
            console.error("Error searching GIFs:", err);
            setError("Failed to search GIFs");
            toast.error("Failed to search GIFs");
        } finally {
            setLoading(false);
        }
    };

    const handleGifSelect = (gif) => {
        // Use the downsized medium version for better chat display
        const gifUrl = gif.images.downsized_medium.url;
        onSelectGif(gifUrl);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-base-100 rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-base-300">
                    <h3 className="text-lg font-semibold">Choose a GIF</h3>
                    <button
                        onClick={onClose}
                        className="btn btn-sm btn-ghost btn-circle"
                        title="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-base-300">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/50" size={20} />
                        <input
                            type="text"
                            placeholder="Search GIFs..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input input-bordered w-full pl-10"
                            autoFocus
                        />
                    </div>
                    {searchQuery && (
                        <p className="text-xs text-base-content/70 mt-2">
                            Searching for: {searchQuery}
                        </p>
                    )}
                    {!searchQuery && (
                        <p className="text-xs text-base-content/70 mt-2">
                            Showing trending GIFs
                        </p>
                    )}
                </div>

                {/* GIF Grid */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading && (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="animate-spin" size={32} />
                        </div>
                    )}

                    {error && (
                        <div className="flex flex-col items-center justify-center py-12 text-error">
                            <p>{error}</p>
                            <button
                                onClick={loadTrendingGifs}
                                className="btn btn-sm btn-primary mt-4"
                            >
                                Retry
                            </button>
                        </div>
                    )}

                    {!loading && !error && gifs.length === 0 && (
                        <div className="flex items-center justify-center py-12 text-base-content/70">
                            <p>No GIFs found. Try a different search.</p>
                        </div>
                    )}

                    {!loading && !error && gifs.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {gifs.map((gif) => (
                                <button
                                    key={gif.id}
                                    onClick={() => handleGifSelect(gif)}
                                    className="relative aspect-square rounded-lg overflow-hidden hover:ring-2 hover:ring-primary transition-all cursor-pointer bg-base-200"
                                >
                                    <img
                                        src={gif.images.fixed_height.url}
                                        alt={gif.title}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                    />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-base-300 text-center">
                    <p className="text-xs text-base-content/50">
                        Powered by <span className="font-semibold">GIPHY</span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default GifPicker;

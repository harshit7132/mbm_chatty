import { useEffect } from "react";
import { usePointsStore } from "../store/usePointsStore";
import { Coins } from "lucide-react";

const PointsDisplay = () => {
  const { points, getMyPoints, isPointsLoading } = usePointsStore();

  useEffect(() => {
    getMyPoints();
    // Refresh points every minute
    const interval = setInterval(() => {
      getMyPoints();
    }, 60000);

    return () => clearInterval(interval);
  }, [getMyPoints]);

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-base-200 rounded-lg">
      <Coins size={18} className="text-warning" />
      <span className="font-semibold">{isPointsLoading ? "..." : points}</span>
      <span className="text-sm opacity-70">Chatty Points</span>
    </div>
  );
};

export default PointsDisplay;


import { useEffect, useState } from "react";
import { useLeaderboardStore } from "../store/useLeaderboardStore";
import { Trophy, Medal, Award, Coins } from "lucide-react";

const LEADERBOARD_TYPES = [
  { key: "badges", label: "Badges", icon: Trophy },
  { key: "chats", label: "Chats", icon: Medal },
  { key: "points-earned", label: "Points Earned", icon: Award },
  { key: "points-spent", label: "Points Spent", icon: Coins },
];

const Leaderboard = () => {
  const { leaderboards, getLeaderboard, isLeaderboardsLoading } = useLeaderboardStore();
  const [activeTab, setActiveTab] = useState("badges");

  useEffect(() => {
    getLeaderboard(activeTab);
  }, [activeTab, getLeaderboard]);

  const currentLeaderboard = leaderboards[activeTab] || [];

  const getRankIcon = (rank) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  };

  const getValue = (user, type) => {
    // Backend returns 'score' field for all types
    if (user.score !== undefined) {
      return user.score;
    }
    // Fallback to specific fields if score not available
    switch (type) {
      case "badges":
        return user.badges?.length || 0;
      case "chats":
        return user.chatCount || 0;
      case "points-earned":
        return user.points || 0;
      case "points-spent":
        return user.score || 0;
      default:
        return 0;
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Leaderboards</h2>

      <div className="tabs tabs-boxed mb-6">
        {LEADERBOARD_TYPES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={`tab ${activeTab === key ? "tab-active" : ""}`}
            onClick={() => setActiveTab(key)}
          >
            <Icon size={18} className="mr-2" />
            {label}
          </button>
        ))}
      </div>

      {isLeaderboardsLoading ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>Rank</th>
                <th>User</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {currentLeaderboard.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-base-content/70">
                    No data available
                  </td>
                </tr>
              ) : (
                currentLeaderboard.map((user, index) => (
                  <tr key={user._id} className="hover">
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getRankIcon(index + 1)}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="avatar">
                          <div className="w-10 rounded-full">
                            <img
                              src={user.profilePic || "/avatar.png"}
                              alt={user.fullName}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="font-medium">{user.fullName}</div>
                          {user.badges && user.badges.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {user.badges.slice(0, 3).map((badge, idx) => (
                                <span
                                  key={idx}
                                  className="badge badge-sm badge-primary"
                                >
                                  {badge}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="font-semibold">{getValue(user, activeTab)}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;


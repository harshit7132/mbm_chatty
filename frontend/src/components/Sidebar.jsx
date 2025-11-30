import { useEffect, useState, useMemo } from "react";
import { useChatStore } from "../store/useChatStore";
import { useGroupStore } from "../store/useGroupStore";
import { useAuthStore } from "../store/useAuthStore";
import { useLeaderboardStore } from "../store/useLeaderboardStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import UserSearch from "./UserSearch";
import { Users, Search, MessageSquare, Trophy } from "lucide-react";

// Helper to get rank badge with color based on position
const getRankBadge = (rank) => {
  if (!rank) return null;
  
  const number = String(rank).padStart(3, '0');
  
  // Different colors for top 3 positions
  if (rank === 1) return { text: number, color: "text-yellow-400" };
  if (rank === 2) return { text: number, color: "text-gray-300" };
  if (rank === 3) return { text: number, color: "text-amber-600" };
  
  return { 
    text: number, 
    color: "text-base-content/70" 
  };
};

const Sidebar = () => {
  const { 
    getUsers, 
    users, 
    selectedUser, 
    setSelectedUser, 
    isUsersLoading 
  } = useChatStore();
  
  const { groups, getMyGroups, selectedGroup, setSelectedGroup } = useGroupStore();
  const { onlineUsers } = useAuthStore();
  const { leaderboards, getLeaderboard } = useLeaderboardStore();
  
  // Create a map of user IDs to their rank in the badges leaderboard
  const userBadgeRanks = useMemo(() => {
    const ranks = {};
    leaderboards.badges?.forEach((user, index) => {
      if (user?._id) {
        ranks[user._id] = index + 1; // 1-based rank
      }
    });
    return ranks;
  }, [leaderboards.badges]);
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [activeTab, setActiveTab] = useState("users");
  const [showSearch, setShowSearch] = useState(false);

  // Fetch initial data
  useEffect(() => {
    getUsers();
    getLeaderboard('badges'); // Load badges leaderboard
    if (activeTab === "groups") {
      getMyGroups();
    }
  }, [getUsers, getMyGroups, activeTab, getLeaderboard]);

  const filteredUsers = showOnlineOnly
    ? users.filter((user) => onlineUsers.includes(user._id))
    : users;

  if (isUsersLoading) return <SidebarSkeleton />;

  return (
    <aside className="h-full w-20 lg:w-72 border-r border-base-300 flex flex-col transition-all duration-200">
      <div className="border-b border-base-300 w-full p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="size-6" />
            <span className="font-medium hidden lg:block">Contacts</span>
          </div>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="btn btn-xs btn-ghost"
            title="Search users"
          >
            <Search size={16} />
          </button>
        </div>

        {showSearch && (
          <div className="mb-3">
            <UserSearch
              onSelectUser={(user) => {
                setSelectedUser(user);
                setShowSearch(false);
              }}
              onClose={() => setShowSearch(false)}
            />
          </div>
        )}

        <div className="tabs tabs-boxed tabs-sm mb-3">
          <button
            className={`tab flex-1 ${activeTab === "users" ? "tab-active" : ""}`}
            onClick={() => {
              setActiveTab("users");
              // Clear selected group when switching to users tab
              setSelectedGroup(null);
              const chatStore = useChatStore.getState();
              chatStore.setSelectedChat(null);
              chatStore.setSelectedUser(null);
            }}
          >
            <Users size={14} className="mr-1" />
            <span className="hidden lg:inline">Users</span>
          </button>
          <button
            className={`tab flex-1 ${activeTab === "groups" ? "tab-active" : ""}`}
            onClick={() => {
              setActiveTab("groups");
              // Clear selected user when switching to groups tab
              setSelectedUser(null);
              const chatStore = useChatStore.getState();
              chatStore.setSelectedChat(null);
            }}
          >
            <MessageSquare size={14} className="mr-1" />
            <span className="hidden lg:inline">Groups</span>
          </button>
        </div>

        {activeTab === "users" && (
          <div className="mt-3 hidden lg:flex items-center gap-2">
            <label className="cursor-pointer flex items-center gap-2">
              <input
                type="checkbox"
                checked={showOnlineOnly}
                onChange={(e) => setShowOnlineOnly(e.target.checked)}
                className="checkbox checkbox-sm"
              />
              <span className="text-sm">Show online only</span>
            </label>
            <span className="text-xs text-zinc-500">({onlineUsers.length - 1} online)</span>
          </div>
        )}
      </div>

      <div className="overflow-y-auto w-full py-3">
        {activeTab === "users" ? (
          <>
            {filteredUsers.map((user, index) => (
              <button
                key={user._id}
                onClick={() => setSelectedUser(user)}
                className={`
                  w-full p-3 flex items-center gap-3
                  hover:bg-base-300 transition-colors
                  ${selectedUser?._id === user._id ? "bg-base-300 ring-1 ring-base-300" : ""}
                `}
              >
                <div className="relative mx-auto lg:mx-0">
                  <img
                    src={user.profilePic || "/avatar.png"}
                    alt={user.fullName}
                    className="size-12 object-cover rounded-full"
                  />
                  {onlineUsers.includes(user._id) && (
                    <span
                      className="absolute bottom-0 right-0 size-3 bg-green-500 
                      rounded-full ring-2 ring-zinc-900"
                    />
                  )}
                </div>

                <div className="hidden lg:block text-left min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-medium truncate">{user.fullName}</div>
                    {userBadgeRanks[user._id] && (
                      <div className="flex items-center gap-1" title={`Rank #${userBadgeRanks[user._id]} in badges leaderboard`}>
                        <Trophy size={14} className="text-yellow-400" />
                        <span 
                          className={`text-xs font-mono font-medium ${getRankBadge(userBadgeRanks[user._id]).color}`}
                        >
                          {getRankBadge(userBadgeRanks[user._id]).text}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-zinc-400">
                    {onlineUsers.includes(user._id) ? "Online" : "Offline"}
                  </div>
                </div>
              </button>
            ))}

            {filteredUsers.length === 0 && (
              <div className="text-center text-zinc-500 py-4">No users found</div>
            )}
          </>
        ) : (
          <>
            {groups.map((group) => (
              <button
                key={group._id}
                onClick={() => {
                  setSelectedGroup(group);
                  useChatStore.getState().setSelectedGroupChat(group._id);
                  useChatStore.getState().setSelectedUser(null);
                }}
                className={`
                  w-full p-3 flex items-center gap-3
                  hover:bg-base-300 transition-colors
                  ${selectedGroup?._id === group._id ? "bg-base-300 ring-1 ring-base-300" : ""}
                `}
              >
                <div className="relative mx-auto lg:mx-0">
                  <div className="size-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <MessageSquare size={20} className="text-primary" />
                  </div>
                </div>

                <div className="hidden lg:block text-left min-w-0">
                  <div className="font-medium truncate">{group.name}</div>
                  <div className="text-sm text-zinc-400">
                    {group.members?.length || 0} members
                  </div>
                </div>
              </button>
            ))}

            {groups.length === 0 && (
              <div className="text-center text-zinc-500 py-4">No groups yet</div>
            )}
          </>
        )}
      </div>
    </aside>
  );
};
export default Sidebar;

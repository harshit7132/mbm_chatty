import { Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import PointsDisplay from "./PointsDisplay";
import FriendRequests from "./FriendRequests";
import {
  LogOut,
  MessageSquare,
  Settings,
  User,
  Trophy,
  Target,
  Shield,
  Bot,
  Calendar,
} from "lucide-react";

const Navbar = () => {
  const { logout, authUser } = useAuthStore();

  return (
    <header
      className="bg-base-100 border-b border-base-300 fixed w-full top-0 z-40 
    backdrop-blur-lg bg-base-100/80"
    >
      <div className="container mx-auto px-4 h-16">
        <div className="flex items-center justify-between h-full">
          <div className="flex items-center gap-8">
            <Link
              to="/"
              className="flex items-center gap-2.5 hover:opacity-80 transition-all"
            >
              <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
              <h1 className="text-lg font-bold">Chatty</h1>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {authUser && (
              <>
                <PointsDisplay />
                <FriendRequests />
                <Link to="/leaderboard" className="btn btn-sm btn-ghost" title="Leaderboard">
                  <Trophy className="w-4 h-4" />
                  <span className="hidden sm:inline">Leaderboard</span>
                </Link>
                <Link to="/challenges" className="btn btn-sm btn-ghost" title="Challenges">
                  <Target className="w-4 h-4" />
                  <span className="hidden sm:inline">Challenges</span>
                </Link>
                <Link to="/calendar" className="btn btn-sm btn-ghost" title="Calendar">
                  <Calendar className="w-4 h-4" />
                  <span className="hidden sm:inline">Calendar</span>
                </Link>
                <Link to="/groups" className="btn btn-sm btn-ghost" title="Groups">
                  <MessageSquare className="w-4 h-4" />
                  <span className="hidden sm:inline">Groups</span>
                </Link>
                <Link to="/ai-chat" className="btn btn-sm btn-ghost" title="AI Chat">
                  <Bot className="w-4 h-4" />
                  <span className="hidden sm:inline">AI</span>
                </Link>
                {authUser.isAdmin && (
                  <Link to="/admin" className="btn btn-sm btn-ghost" title="Admin">
                    <Shield className="w-4 h-4" />
                    <span className="hidden sm:inline">Admin</span>
                  </Link>
                )}
                <Link to="/settings" className="btn btn-sm btn-ghost" title="Settings">
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Settings</span>
                </Link>
                <Link to="/profile" className="btn btn-sm btn-ghost" title="Profile">
                  <User className="size-5" />
                  <span className="hidden sm:inline">Profile</span>
                </Link>
                <button className="btn btn-sm btn-ghost" onClick={logout} title="Logout">
                  <LogOut className="size-5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
export default Navbar;

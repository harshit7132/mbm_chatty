import Navbar from "./components/Navbar";
import SecurityFeatures from "./components/SecurityFeatures";
import VideoCall from "./components/VideoCall";
import IncomingCallModal from "./components/IncomingCallModal";
import ChallengeReversalModal from "./components/ChallengeReversalModal";
import ThresholdWarningModal from "./components/ThresholdWarningModal";
import { useCallStore } from "./store/useCallStore";
import { useChallengeStore } from "./store/useChallengeStore";
import { useChatStore } from "./store/useChatStore";

import HomePage from "./pages/HomePage";
import SignUpPage from "./pages/SignUpPage";
import LoginPage from "./pages/LoginPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/ProfilePage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import ChallengesPage from "./pages/ChallengesPage";
import AIChatPage from "./pages/AIChatPage";
import GroupsPage from "./pages/GroupsPage";
import AdminPage from "./pages/AdminPage";
import CalendarPage from "./pages/CalendarPage";

import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/useAuthStore";
import { useThemeStore } from "./store/useThemeStore";
import { useEffect } from "react";
import { useActivityTracker } from "./hooks/useActivityTracker";

import { Loader } from "lucide-react";
import { Toaster } from "react-hot-toast";

const App = () => {
  const { authUser, checkAuth, isCheckingAuth } = useAuthStore();
  const { theme } = useThemeStore();
  const { activeCall, incomingCall, clearCall, answerCall, rejectCall } = useCallStore();
  const { challengeReversal, clearChallengeReversal } = useChallengeStore();
  const { pendingDeletion, thresholdWarning, clearThresholdWarning, clearPendingDeletion } = useChatStore();

  // Track user activity (time spent on website)
  useActivityTracker();

  // Debug: Log modal state
  useEffect(() => {
    console.log("🔍 [APP] Modal state:", { 
      thresholdWarning, 
      pendingDeletion, 
      challengeReversal,
      hasThresholdWarning: !!thresholdWarning,
      hasPendingDeletion: !!pendingDeletion,
      hasChallengeReversal: !!challengeReversal
    });
  }, [thresholdWarning, pendingDeletion, challengeReversal]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isCheckingAuth && !authUser)
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader className="size-10 animate-spin" />
      </div>
    );

  return (
    <div data-theme={theme}>
      <SecurityFeatures />
      <Navbar />

      {activeCall && (
        <VideoCall callData={activeCall} onEndCall={clearCall} />
      )}

      {incomingCall && (
        <IncomingCallModal
          callData={incomingCall}
          onAnswer={answerCall}
          onReject={rejectCall}
        />
      )}

      {thresholdWarning && thresholdWarning.warningData && (
        <ThresholdWarningModal
          warningData={thresholdWarning.warningData}
          onClose={clearThresholdWarning}
        />
      )}

      {(challengeReversal || pendingDeletion) && !thresholdWarning && (
        <ChallengeReversalModal
          reversalData={pendingDeletion?.reversalData || challengeReversal}
          onClose={pendingDeletion ? clearPendingDeletion : clearChallengeReversal}
        />
      )}

      <Routes>
        <Route
          path="/"
          element={authUser ? <HomePage /> : <Navigate to="/login" />}
        />
        <Route
          path="/signup"
          element={!authUser ? <SignUpPage /> : <Navigate to="/" />}
        />
        <Route
          path="/login"
          element={!authUser ? <LoginPage /> : <Navigate to="/" />}
        />
        <Route
          path="/admin/login"
          element={!authUser ? <AdminLoginPage /> : <Navigate to="/admin" />}
        />
        <Route
          path="/settings"
          element={authUser ? <SettingsPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/profile"
          element={authUser ? <ProfilePage /> : <Navigate to="/login" />}
        />
        <Route
          path="/leaderboard"
          element={authUser ? <LeaderboardPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/challenges"
          element={authUser ? <ChallengesPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/calendar"
          element={authUser ? <CalendarPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/ai-chat"
          element={authUser ? <AIChatPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/groups"
          element={authUser ? <GroupsPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/admin"
          element={
            authUser?.isAdmin ? (
              <AdminPage />
            ) : authUser ? (
              <Navigate to="/" />
            ) : (
              <Navigate to="/admin/login" />
            )
          }
        />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Routes>

      <Toaster />
    </div>
  );
};
export default App;

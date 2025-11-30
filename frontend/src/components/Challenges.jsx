import { useEffect, useState, useRef } from "react";
import { useChallengeStore } from "../store/useChallengeStore";
import { useAuthStore } from "../store/useAuthStore";
import { Target, CheckCircle, Circle, RefreshCw, Play } from "lucide-react";
import toast from "react-hot-toast";
import ChallengeAttemptModal from "./ChallengeAttemptModal";

const Challenges = () => {
  const {
    dailyChallenges,
    lifetimeChallenges,
    getDailyChallenges,
    getMyChallenges,
    isChallengesLoading,
    updateChallenges,
    refreshDailyChallenges,
  } = useChallengeStore();
  const { socket, updatePoints } = useAuthStore();
  const [activeTab, setActiveTab] = useState("daily");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [showAttemptModal, setShowAttemptModal] = useState(false);
  const lastRefreshDateRef = useRef(null);

  useEffect(() => {
    if (activeTab === "daily") {
      getDailyChallenges();
    } else {
      getMyChallenges();
    }
  }, [activeTab]);

  // Automatic refresh at midnight (12:00 AM)
  useEffect(() => {
    const checkAndRefreshAtMidnight = () => {
      const now = new Date();
      const currentDate = now.getDate();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      const dateKey = `${currentYear}-${currentMonth}-${currentDate}`;
      const hours = now.getHours();
      const minutes = now.getMinutes();
      
      // Check if it's midnight (00:00) and we haven't refreshed today
      if (hours === 0 && minutes === 0 && lastRefreshDateRef.current !== dateKey) {
        console.log("🕛 [Challenges] Midnight detected, auto-refreshing daily challenges...");
        lastRefreshDateRef.current = dateKey;
        
        if (activeTab === "daily") {
          refreshDailyChallenges(updatePoints).catch(error => {
            console.error("Failed to auto-refresh challenges at midnight:", error);
          });
        }
      }
    };

    // Check every minute for midnight (more efficient than every second)
    const intervalId = setInterval(checkAndRefreshAtMidnight, 60000);
    
    // Check immediately on mount
    checkAndRefreshAtMidnight();

    return () => clearInterval(intervalId);
  }, [activeTab, refreshDailyChallenges, updatePoints]);

  // Initialize socket listener for real-time updates (backup - also set up in auth store)
  useEffect(() => {
    if (!socket || !socket.connected) {
      console.log("⚠️ [Challenges] Socket not available or not connected");
      return;
    }
    
    console.log("🔌 [Challenges] Setting up challenge socket listener");
    const { initSocketListener, cleanupSocketListener } = useChallengeStore.getState();
    
    // Initialize socket listener
    initSocketListener(socket);
    
    // Cleanup on unmount
    return () => {
      console.log("🧹 [Challenges] Cleaning up challenge socket listener");
      cleanupSocketListener(socket);
    };
  }, [socket]);

  // Debug: Log challenges when they change
  useEffect(() => {
    console.log("Daily challenges:", dailyChallenges);
    console.log("Lifetime challenges:", lifetimeChallenges);
  }, [dailyChallenges, lifetimeChallenges]);

  const getProgressPercentage = (challenge) => {
    if (!challenge.target) return 0;
    const progress = challenge.current || challenge.progress || 0;
    return Math.min((progress / challenge.target) * 100, 100);
  };

  // Test function to manually update a challenge (for debugging)
  const testUpdate = () => {
    if (dailyChallenges.length > 0) {
      const testChallenge = { ...dailyChallenges[0], current: (dailyChallenges[0].current || 0) + 1 };
      updateChallenges([testChallenge]);
      console.log("🧪 Test update applied:", testChallenge);
    }
  };

  // Handle refresh daily challenges
  const handleRefresh = async () => {
    if (isRefreshing) return;
    
    try {
      setIsRefreshing(true);
      await refreshDailyChallenges(updatePoints);
      toast.success("Daily challenges refreshed!");
    } catch (error) {
      console.error("Failed to refresh challenges:", error);
      toast.error(error.response?.data?.message || "Failed to refresh challenges");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Challenges</h2>
        {/* Debug button - remove in production */}
        <div className="flex gap-2">
          {/* {process.env.NODE_ENV === "development" && dailyChallenges.length > 0 && (
            <button 
              onClick={testUpdate}
              className="btn btn-xs btn-ghost"
              title="Test real-time update"
            >
              Test Update
            </button>
          )} */}
          {activeTab === "daily" && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="btn btn-xs btn-ghost"
              title="Refresh daily challenges (Costs 4 points)"
            >
              <RefreshCw size={14} className={`mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh (4 pts)
            </button>
          )}
        </div>
      </div>

      <div className="tabs tabs-boxed mb-6">
        <button
          className={`tab ${activeTab === "daily" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("daily")}
        >
          Daily Challenges
        </button>
        <button
          className={`tab ${activeTab === "lifetime" ? "tab-active" : ""}`}
          onClick={() => setActiveTab("lifetime")}
        >
          Lifetime Challenges
        </button>
      </div>

      {isChallengesLoading ? (
        <div className="flex justify-center py-8">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : (
        <div className="space-y-4">
          {activeTab === "daily" ? (
            dailyChallenges.length === 0 ? (
              <div className="text-center py-8 text-base-content/70">
                No daily challenges available
              </div>
            ) : (
              dailyChallenges.map((challenge) => (
                <div
                  key={challenge._id}
                  className="card bg-base-200 shadow-md"
                >
                  <div className="card-body">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="card-title text-lg">{challenge.title}</h3>
                        <p className="text-sm opacity-70 mt-1">
                          {challenge.description || "No description"}
                        </p>
                        <div className="mt-3">
                          <div className="flex justify-between text-sm mb-1">
                            <span>
                              Progress: {challenge.current || 0} / {challenge.target}
                            </span>
                            <span className="font-semibold">
                              +{challenge.reward?.points || challenge.points || 0} points
                            </span>
                          </div>
                          <progress
                            className="progress progress-primary w-full mt-2"
                            value={getProgressPercentage(challenge)}
                            max="100"
                          ></progress>
                          {challenge.expiresAt && (
                            <div className="text-xs opacity-60 mt-1">
                              Expires: {new Date(challenge.expiresAt).toLocaleDateString()}
                            </div>
                          )}
                          {/* Show attempt button for interactive challenges */}
                          {((challenge.category === "trivia" || challenge.category === "puzzle" || 
                            challenge.category === "quiz" || challenge.category === "coding") ||
                            (challenge.challengeId?.category === "trivia" || challenge.challengeId?.category === "puzzle" ||
                            challenge.challengeId?.category === "quiz" || challenge.challengeId?.category === "coding")) && 
                            challenge.challengeId && !challenge.completed && (
                            <button
                              onClick={() => {
                                setSelectedChallenge(challenge);
                                setShowAttemptModal(true);
                              }}
                              className="btn btn-sm btn-primary mt-3 w-full"
                            >
                              <Play size={14} className="mr-2" />
                              Attempt Challenge
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="ml-4">
                        {challenge.completed ? (
                          <CheckCircle className="text-success" size={24} />
                        ) : (
                          <Circle className="text-base-content/30" size={24} />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )
          ) : (
            lifetimeChallenges.length === 0 ? (
              <div className="text-center py-8 text-base-content/70">
                No lifetime challenges available
              </div>
            ) : (
              lifetimeChallenges.map((challenge) => (
                <div
                  key={challenge._id}
                  className="card bg-base-200 shadow-md"
                >
                  <div className="card-body">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Target size={20} />
                          <h3 className="card-title text-lg">{challenge.title}</h3>
                        </div>
                        <p className="text-sm opacity-70 mb-3">
                          {challenge.description || "No description"}
                        </p>
                        <div className="mt-3">
                          <div className="flex justify-between text-sm mb-1">
                            <span>
                              Progress: {challenge.current || 0} / {challenge.target}
                            </span>
                            <span className="font-semibold">
                              +{challenge.reward?.points || challenge.points || 0} points
                            </span>
                          </div>
                          {/* Show attempt button for interactive challenges */}
                          {((challenge.category === "trivia" || challenge.category === "puzzle" || 
                            challenge.category === "quiz" || challenge.category === "coding") ||
                            (challenge.challengeId?.category === "trivia" || challenge.challengeId?.category === "puzzle" ||
                            challenge.challengeId?.category === "quiz" || challenge.challengeId?.category === "coding")) && 
                            challenge.challengeId && !challenge.completed && (
                            <button
                              onClick={() => {
                                setSelectedChallenge(challenge);
                                setShowAttemptModal(true);
                              }}
                              className="btn btn-sm btn-primary mb-3 w-full"
                            >
                              <Play size={14} className="mr-2" />
                              Attempt Challenge
                            </button>
                          )}
                          {challenge.stages && challenge.stages.length > 0 ? (
                            <div className="space-y-2 mt-2">
                              {challenge.stages.map((stage, idx) => {
                                const currentProgress = challenge.current || 0;
                                const stageTarget = stage.target || 1;
                                const isCompleted = currentProgress >= stageTarget;
                                const progressPercent = Math.min((currentProgress / stageTarget) * 100, 100);
                                
                                return (
                                  <div key={idx} className="border-l-2 border-primary pl-2">
                                    <div className="flex justify-between text-xs mb-1">
                                      <span className="font-medium">
                                        Stage {idx + 1}: {stageTarget}
                                        {isCompleted && <CheckCircle className="inline ml-1 text-success" size={12} />}
                                      </span>
                                      <span className="font-semibold">
                                        +{stage.reward?.points || 0} pts
                                        {stage.reward?.badge && (
                                          <span className="badge badge-xs badge-primary ml-1">
                                            {stage.reward.badge}
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                    <div className="text-xs opacity-70 mb-1">
                                      {currentProgress} / {stageTarget}
                                    </div>
                                    <progress
                                      className="progress progress-secondary w-full"
                                      value={progressPercent}
                                      max="100"
                                    ></progress>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <progress
                              className="progress progress-secondary w-full mt-2"
                              value={getProgressPercentage(challenge)}
                              max="100"
                            ></progress>
                          )}
                          {challenge.reward?.badge && (
                            <div className="text-xs opacity-60 mt-1">
                              Badge: {challenge.reward.badge}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="ml-4">
                        {challenge.completed ? (
                          <CheckCircle className="text-success" size={24} />
                        ) : (
                          <Circle className="text-base-content/30" size={24} />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      )}
      
      {/* Challenge Attempt Modal */}
      <ChallengeAttemptModal
        challenge={selectedChallenge}
        isOpen={showAttemptModal}
        onClose={() => {
          setShowAttemptModal(false);
          setSelectedChallenge(null);
        }}
      />
    </div>
  );
};

export default Challenges;


import { useEffect, useState } from "react";
import { axiosInstance } from "../lib/axios";
import { Target, CheckCircle, Circle, Play, Trophy } from "lucide-react";
import toast from "react-hot-toast";
import ChallengeAttemptModal from "./ChallengeAttemptModal";
import { useAuthStore } from "../store/useAuthStore";

const GroupChallenges = ({ groupId }) => {
  const [challenges, setChallenges] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [showAttemptModal, setShowAttemptModal] = useState(false);
  const [completionNotification, setCompletionNotification] = useState(null);
  const { socket, updatePoints } = useAuthStore();

  useEffect(() => {
    if (groupId) {
      fetchGroupChallenges();
    }
  }, [groupId]);

  // Listen for challenge completion notifications
  useEffect(() => {
    if (!socket) return;

    const handleChallengeCompleted = (data) => {
      console.log("Group challenge completed:", data);
      setCompletionNotification(data);
      
      // Refresh challenges
      fetchGroupChallenges();
      
      // Hide notification after 5 seconds
      setTimeout(() => {
        setCompletionNotification(null);
      }, 5000);
    };

    socket.on("group-challenge-completed", handleChallengeCompleted);

    return () => {
      socket.off("group-challenge-completed", handleChallengeCompleted);
    };
  }, [socket, groupId]);

  const fetchGroupChallenges = async () => {
    if (!groupId) return;
    
    setIsLoading(true);
    try {
      const res = await axiosInstance.get(`/challenge/group/${groupId}`);
      setChallenges(res.data || []);
    } catch (error) {
      console.error("Failed to fetch group challenges:", error);
      toast.error(error.response?.data?.message || "Failed to load group challenges");
    } finally {
      setIsLoading(false);
    }
  };

  const getProgressPercentage = (challenge) => {
    if (!challenge.target) return 0;
    const progress = challenge.current || 0;
    return Math.min((progress / challenge.target) * 100, 100);
  };

  const incompleteChallenges = challenges.filter(c => !c.completed);
  const hasChallenges = challenges.length > 0;
  const hasIncompleteChallenges = incompleteChallenges.length > 0;

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <span className="loading loading-spinner"></span>
      </div>
    );
  }

  if (!hasChallenges) {
    return null;
  }

  return (
    <div className="px-4 py-3 border-b border-base-300 bg-base-200">
      {/* Completion Notification */}
      {completionNotification && (
        <div className="mb-3 p-3 bg-success/20 border border-success rounded-lg text-center animate-pulse">
          <div className="flex items-center justify-center gap-2">
            <Trophy className="text-success" size={20} />
            <span className="font-semibold text-success">
              {completionNotification.completedBy?.fullName || completionNotification.completedBy?.username || "Someone"} 
              {" "}completed: {completionNotification.challengeTitle}
            </span>
            <Trophy className="text-success" size={20} />
          </div>
          {completionNotification.points > 0 && (
            <div className="text-sm text-success/80 mt-1">
              +{completionNotification.points} points awarded
            </div>
          )}
        </div>
      )}

      {/* New Challenge Message */}
      {hasIncompleteChallenges && (
        <div className="text-center mb-3">
          <p className="text-base font-semibold text-primary">
            🎯 New challenge is waiting for you to complete!
          </p>
        </div>
      )}

      {/* Challenges List */}
      {hasIncompleteChallenges && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {incompleteChallenges.map((challenge) => {
            const category = challenge.challengeId?.category || challenge.category || "custom";
            const isInteractive = ["trivia", "puzzle", "quiz", "coding"].includes(category);
            
            return (
              <div
                key={challenge._id}
                className="card bg-base-100 shadow-sm border border-base-300"
              >
                <div className="card-body p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm truncate">{challenge.title}</h4>
                      {challenge.description && (
                        <p className="text-xs text-base-content/70 mt-1 line-clamp-2">
                          {challenge.description}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-1">
                            <span>Progress: {challenge.current || 0} / {challenge.target}</span>
                            <span className="font-semibold text-primary">
                              +{challenge.reward?.points || challenge.challengeId?.points || 0} pts
                            </span>
                          </div>
                          <progress
                            className="progress progress-primary h-1.5"
                            value={getProgressPercentage(challenge)}
                            max="100"
                          ></progress>
                        </div>
                      </div>
                      {isInteractive && challenge.challengeId && (
                        <button
                          onClick={() => {
                            setSelectedChallenge({ ...challenge, groupId });
                            setShowAttemptModal(true);
                          }}
                          className="btn btn-xs btn-primary mt-2 w-full"
                        >
                          <Play size={12} className="mr-1" />
                          Play Challenge
                        </button>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      {challenge.completed ? (
                        <CheckCircle className="text-success" size={18} />
                      ) : (
                        <Circle className="text-base-content/30" size={18} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Completed Challenges Summary */}
      {!hasIncompleteChallenges && hasChallenges && (
        <div className="text-center py-2">
          <p className="text-sm text-base-content/70">
            ✅ All group challenges completed!
          </p>
        </div>
      )}

      {/* Challenge Attempt Modal */}
      <ChallengeAttemptModal
        challenge={selectedChallenge}
        isOpen={showAttemptModal}
        onClose={() => {
          setShowAttemptModal(false);
          setSelectedChallenge(null);
          fetchGroupChallenges(); // Refresh after closing
        }}
        isGroupChallenge={true}
        groupId={groupId}
      />
    </div>
  );
};

export default GroupChallenges;


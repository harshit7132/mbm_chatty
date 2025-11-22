import { useEffect, useState } from "react";
import { useChallengeStore } from "../store/useChallengeStore";
import { Target, CheckCircle, Circle } from "lucide-react";

const Challenges = () => {
  const {
    dailyChallenges,
    lifetimeChallenges,
    getDailyChallenges,
    getMyChallenges,
    isChallengesLoading,
  } = useChallengeStore();
  const [activeTab, setActiveTab] = useState("daily");

  useEffect(() => {
    if (activeTab === "daily") {
      getDailyChallenges();
    } else {
      getMyChallenges();
    }
  }, [activeTab, getDailyChallenges, getMyChallenges]);

  const getProgressPercentage = (challenge) => {
    if (!challenge.target) return 0;
    return Math.min((challenge.progress / challenge.target) * 100, 100);
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Challenges</h2>

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
                        <h3 className="card-title text-lg">{challenge.name}</h3>
                        <p className="text-sm opacity-70 mt-1">
                          {challenge.description}
                        </p>
                        <div className="mt-3">
                          <div className="flex justify-between text-sm mb-1">
                            <span>
                              Progress: {challenge.progress || 0} / {challenge.target}
                            </span>
                            <span className="font-semibold">
                              +{challenge.pointsReward} points
                            </span>
                          </div>
                          <progress
                            className="progress progress-primary w-full"
                            value={getProgressPercentage(challenge)}
                            max="100"
                          ></progress>
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
                          <h3 className="card-title text-lg">{challenge.name}</h3>
                        </div>
                        <p className="text-sm opacity-70 mb-3">
                          {challenge.description}
                        </p>
                        <div className="space-y-2">
                          {challenge.stages?.map((stage, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                              <div className="flex-1">
                                <div className="flex justify-between text-sm mb-1">
                                  <span>
                                    Stage {idx + 1}: {stage.name}
                                  </span>
                                  <span>
                                    {stage.completed ? (
                                      <CheckCircle className="text-success inline" size={16} />
                                    ) : (
                                      <span className="text-xs">
                                        {stage.progress || 0} / {stage.target}
                                      </span>
                                    )}
                                  </span>
                                </div>
                                <progress
                                  className="progress progress-secondary w-full"
                                  value={
                                    stage.completed
                                      ? 100
                                      : Math.min(
                                          ((stage.progress || 0) / stage.target) * 100,
                                          100
                                        )
                                  }
                                  max="100"
                                ></progress>
                                {stage.badgeReward && (
                                  <div className="mt-1">
                                    <span className="badge badge-sm badge-primary">
                                      {stage.badgeReward}
                                    </span>
                                    <span className="text-xs ml-2">
                                      +{stage.pointsReward} points
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      )}
    </div>
  );
};

export default Challenges;


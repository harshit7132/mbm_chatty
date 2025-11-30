import { useState, useEffect } from "react";
import { X, Clock, CheckCircle, XCircle } from "lucide-react";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { useChallengeStore } from "../store/useChallengeStore";
import { useAuthStore } from "../store/useAuthStore";

const ChallengeAttemptModal = ({ challenge, isOpen, onClose }) => {
  const [challengeData, setChallengeData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [codeAnswer, setCodeAnswer] = useState("");
  const [quizAnswers, setQuizAnswers] = useState([]);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [result, setResult] = useState(null);
  const [showAttemptInfo, setShowAttemptInfo] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const { getMyChallenges, getDailyChallenges } = useChallengeStore();
  const { refreshAuthUser, authUser } = useAuthStore();

  useEffect(() => {
    if (isOpen && challenge) {
      // Reset all state when opening a new challenge
      setResult(null);
      setSelectedAnswer(null);
      setTextAnswer("");
      setCodeAnswer("");
      setQuizAnswers([]);
      setTimeRemaining(null);
      setSubmitting(false);
      setShowAttemptInfo(false);
      
      // Handle challengeId - it might be an object (from populate) or a string
      const challengeId = typeof challenge.challengeId === 'object' 
        ? challenge.challengeId?._id || challenge.challengeId 
        : challenge.challengeId;
      
      if (challengeId) {
        fetchChallengeData(challengeId);
        // Check if this is the first attempt and show info dialog
        // Use the current challenge's attempts, not stale data
        const attempts = challenge.attempts || [];
        setAttemptCount(attempts.length);
        if (attempts.length === 0) {
          setShowAttemptInfo(true);
        }
      } else {
        console.error("No challengeId found in challenge:", challenge);
        toast.error("Challenge ID not found");
        onClose();
      }
    } else if (!isOpen) {
      // Reset state when modal closes
      setResult(null);
      setChallengeData(null);
      setSelectedAnswer(null);
      setTextAnswer("");
      setCodeAnswer("");
      setQuizAnswers([]);
      setTimeRemaining(null);
      setAttemptCount(0);
      setShowAttemptInfo(false);
    }
  }, [isOpen, challenge]);

  useEffect(() => {
    if (timeRemaining !== null && timeRemaining > 0) {
      const timer = setTimeout(() => {
        setTimeRemaining(timeRemaining - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (timeRemaining === 0 && challenge) {
      handleSubmit(true); // Auto-submit when time runs out
    }
  }, [timeRemaining, challenge]);

  const fetchChallengeData = async (challengeIdToFetch) => {
    try {
      setLoading(true);
      
      if (!challengeIdToFetch) {
        throw new Error("Challenge ID not found");
      }
      
      console.log("📋 [FRONTEND] Fetching challenge data for ID:", challengeIdToFetch);
      const res = await axiosInstance.get(`/challenge/${challengeIdToFetch}/data`);
      console.log("📋 [FRONTEND] Challenge data received:", res.data);
      setChallengeData(res.data);
      
      // Update attempt count from the current challenge prop (fresh data)
      // This ensures we get the correct count for this specific challenge
      if (challenge && challenge.attempts) {
        const attempts = Array.isArray(challenge.attempts) ? challenge.attempts : [];
        setAttemptCount(attempts.length);
        console.log("📋 [FRONTEND] Setting attempt count from challenge:", attempts.length);
      } else {
        // If no attempts array, start at 0
        setAttemptCount(0);
        console.log("📋 [FRONTEND] No attempts found, setting count to 0");
      }
      
      // Initialize quiz answers array
      if (res.data.category === "quiz" && res.data.challengeData?.questions) {
        setQuizAnswers(new Array(res.data.challengeData.questions.length).fill(null));
      }
      
      // Initialize code with starter code
      if (res.data.category === "coding" && res.data.challengeData?.starterCode) {
        setCodeAnswer(res.data.challengeData.starterCode);
      }
      
      // Start timer if time limit exists
      if (res.data.timeLimit) {
        setTimeRemaining(res.data.timeLimit);
      }
    } catch (error) {
      console.error("Failed to fetch challenge data:", error);
      toast.error("Failed to load challenge");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (isTimeout = false) => {
    if (submitting) return;
    
    // Check if challenge is still available
    if (!challenge) {
      toast.error("Challenge no longer available");
      onClose();
      return;
    }
    
    if (isTimeout) {
      toast.error("Time's up!");
    }
    
    // Check if user needs to pay for this attempt
    const attempts = challenge?.attempts || [];
    const freeAttemptsUsed = attempts.length;
    const needsPayment = freeAttemptsUsed >= 2;
    
    if (needsPayment) {
      if (!authUser || authUser.points < 2) {
        toast.error("You need at least 2 points to attempt this challenge");
        return;
      }
      
      const confirmPayment = window.confirm(
        `You've used your 2 free attempts. This attempt will cost 2 points.\n\nYour current points: ${authUser.points}\nPoints after attempt: ${authUser.points - 2}\n\nContinue?`
      );
      
      if (!confirmPayment) {
        return;
      }
    }
    
    setSubmitting(true);
    
    try {
      let answerToSubmit = null;
      
      if (challengeData.category === "trivia") {
        if (selectedAnswer === null) {
          toast.error("Please select an answer");
          setSubmitting(false);
          return;
        }
        answerToSubmit = selectedAnswer;
      } else if (challengeData.category === "puzzle") {
        if (!textAnswer.trim()) {
          toast.error("Please enter your answer");
          setSubmitting(false);
          return;
        }
        answerToSubmit = textAnswer.trim();
      } else if (challengeData.category === "quiz") {
        if (quizAnswers.some(a => a === null)) {
          toast.error("Please answer all questions");
          setSubmitting(false);
          return;
        }
        answerToSubmit = quizAnswers;
      } else if (challengeData.category === "coding") {
        if (!codeAnswer.trim()) {
          toast.error("Please write your code");
          setSubmitting(false);
          return;
        }
        answerToSubmit = codeAnswer;
      }
      
      // Handle challengeId - it might be an object (from populate) or a string
      const challengeId = typeof challenge.challengeId === 'object' 
        ? challenge.challengeId._id || challenge.challengeId 
        : challenge.challengeId;
      
      if (!challengeId) {
        toast.error("Challenge ID not found");
        setSubmitting(false);
        return;
      }
      
      const res = await axiosInstance.post(`/challenge/${challengeId}/submit`, {
        answer: answerToSubmit,
        code: challengeData.category === "coding" ? codeAnswer : undefined
      });
      
      setResult(res.data);
      
      // Update attempt count from response
      const newAttemptCount = res.data.attemptsUsed || 0;
      setAttemptCount(newAttemptCount);
      
      // Update the challenge object's attempts if available
      // This ensures the next time the modal opens, it has the correct count
      if (challenge && res.data.attemptsUsed !== undefined) {
        // The challenge object will be updated when challenges are refreshed
      }
      
      // Show points charged message if applicable
      if (res.data.pointsCharged > 0) {
        toast(`2 points deducted for this attempt. ${res.data.freeAttemptsRemaining} free attempts remaining.`, {
          icon: "💳",
          duration: 3000
        });
      }
      
      if (res.data.correct) {
        toast.success(`Correct! You earned ${res.data.pointsAwarded} points!`);
        // Refresh challenges and user data
        if (challenge.type === "daily") {
          getDailyChallenges();
        } else {
          getMyChallenges(true);
        }
        refreshAuthUser();
        
        // Close after 2 seconds
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        toast.error(res.data.feedback || "Incorrect answer");
        refreshAuthUser(); // Refresh to update points if charged
      }
    } catch (error) {
      console.error("Failed to submit answer:", error);
      toast.error(error.response?.data?.message || "Failed to submit answer");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !challenge) return null;

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg">{challengeData?.title || challenge.title}</h3>
          <button onClick={onClose} className="btn btn-sm btn-circle btn-ghost">
            <X size={20} />
          </button>
        </div>

        {/* Attempt Info Dialog */}
        {showAttemptInfo && (
          <div className="alert alert-info mb-4">
            <div>
              <h4 className="font-bold">Challenge Attempt Rules</h4>
              <p className="text-sm mt-2">
                You will get <strong>2 free attempts</strong> for this challenge.
                <br />
                After that, each attempt will cost <strong>2 points</strong>.
              </p>
              <div className="mt-3">
                <button
                  onClick={() => setShowAttemptInfo(false)}
                  className="btn btn-sm btn-primary"
                >
                  I Understand
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Attempt Counter */}
        {!showAttemptInfo && attemptCount > 0 && (
          <div className="alert alert-warning mb-4">
            <div className="text-sm">
              <strong>Attempts used:</strong> {attemptCount} / 2 (free)
              {attemptCount >= 2 && (
                <span className="ml-2 text-error">
                  Next attempt will cost 2 points
                </span>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : result ? (
          <div className="text-center py-8">
            {result.correct ? (
              <CheckCircle className="mx-auto text-success mb-4" size={64} />
            ) : (
              <XCircle className="mx-auto text-error mb-4" size={64} />
            )}
            <h4 className="text-xl font-bold mb-2">
              {result.correct ? "Correct!" : "Incorrect"}
            </h4>
            <p className="mb-4 whitespace-pre-line">{result.feedback}</p>
            
            {/* Show detailed question results for quiz challenges */}
            {result.questionResults && result.questionResults.length > 0 && (
              <div className="mt-6 text-left bg-base-200 p-4 rounded-lg">
                <h5 className="font-bold mb-3">Question Results:</h5>
                <div className="space-y-3">
                  {result.questionResults.map((qResult, idx) => (
                    <div key={idx} className={`p-3 rounded ${qResult.isCorrect ? 'bg-success/20 border border-success' : 'bg-error/20 border border-error'}`}>
                      <div className="flex items-start gap-2">
                        <span className={qResult.isCorrect ? 'text-success' : 'text-error'}>
                          {qResult.isCorrect ? '✅' : '❌'}
                        </span>
                        <div className="flex-1">
                          <p className="font-semibold">Question {qResult.questionNumber}: {qResult.question}</p>
                          <p className="text-sm mt-1">
                            <span className={qResult.isCorrect ? 'text-success' : 'text-error'}>
                              Your answer: {qResult.userAnswer}
                            </span>
                            {!qResult.isCorrect && (
                              <span className="block text-success mt-1">
                                Correct answer: {qResult.correctAnswer}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {result.correctCount !== undefined && (
                  <p className="mt-4 text-center font-semibold">
                    Score: {result.correctCount} / {result.totalQuestions} correct
                  </p>
                )}
              </div>
            )}
            
            {result.pointsAwarded > 0 && (
              <p className="text-success font-semibold mt-4">
                +{result.pointsAwarded} points awarded!
              </p>
            )}
            
            {!result.correct && (
              <button
                onClick={() => {
                  setResult(null);
                  setSelectedAnswer(null);
                  setTextAnswer("");
                  setCodeAnswer(challengeData?.challengeData?.starterCode || "");
                  setQuizAnswers(new Array(challengeData?.challengeData?.questions?.length || 0).fill(null));
                }}
                className="btn btn-primary mt-4"
              >
                Try Again
              </button>
            )}
          </div>
        ) : challengeData ? (
          <div>
            {timeRemaining !== null && (
              <div className="alert alert-warning mb-4">
                <Clock size={20} />
                <span>Time remaining: {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}</span>
              </div>
            )}

            {challengeData.category === "trivia" && (
              <div>
                <p className="text-lg mb-4">{challengeData.challengeData?.question || "Question"}</p>
                <div className="space-y-2">
                  {(challengeData.challengeData?.options || []).map((option, idx) => (
                    <label key={idx} className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-base-200">
                      <input
                        type="radio"
                        name="trivia-answer"
                        value={idx}
                        checked={selectedAnswer === idx}
                        onChange={(e) => setSelectedAnswer(Number(e.target.value))}
                        className="radio radio-primary mr-3"
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {challengeData.category === "puzzle" && (
              <div>
                <p className="text-lg mb-4 whitespace-pre-line">{challengeData.challengeData?.question || "Puzzle"}</p>
                {challengeData.challengeData?.hint && (
                  <div className="alert alert-info mb-4">
                    <span>Hint: {challengeData.challengeData.hint}</span>
                  </div>
                )}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Your Answer</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered"
                    value={textAnswer}
                    onChange={(e) => setTextAnswer(e.target.value)}
                    placeholder="Enter your answer"
                  />
                </div>
              </div>
            )}

            {challengeData.category === "quiz" && challengeData.challengeData?.questions && (
              <div className="space-y-6">
                {challengeData.challengeData.questions.map((question, qIdx) => (
                  <div key={qIdx} className="border-b pb-4">
                    <p className="font-semibold mb-3">
                      Question {qIdx + 1}: {question?.question || "Question"}
                    </p>
                    <div className="space-y-2">
                      {(question?.options || []).map((option, oIdx) => (
                        <label key={oIdx} className="flex items-center p-2 border rounded cursor-pointer hover:bg-base-200">
                          <input
                            type="radio"
                            name={`quiz-${qIdx}`}
                            value={oIdx}
                            checked={quizAnswers[qIdx] === oIdx}
                            onChange={() => {
                              const newAnswers = [...quizAnswers];
                              newAnswers[qIdx] = oIdx;
                              setQuizAnswers(newAnswers);
                            }}
                            className="radio radio-primary mr-2"
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {challengeData.category === "coding" && (
              <div>
                <p className="text-lg mb-4 whitespace-pre-line">{challengeData.challengeData?.problem || "Coding Challenge"}</p>
                {challengeData.challengeData?.testCases && challengeData.challengeData.testCases.length > 0 && (
                  <div className="alert alert-info mb-4">
                    <span className="font-semibold">Test Cases:</span>
                    <pre className="mt-2 text-sm">
                      {JSON.stringify(challengeData.challengeData.testCases, null, 2)}
                    </pre>
                  </div>
                )}
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Your Code</span>
                  </label>
                  <textarea
                    className="textarea textarea-bordered font-mono text-sm"
                    value={codeAnswer}
                    onChange={(e) => setCodeAnswer(e.target.value)}
                    rows={15}
                    placeholder="Write your code here..."
                  />
                </div>
              </div>
            )}

            <div className="modal-action mt-6">
              <button onClick={onClose} className="btn" disabled={submitting}>
                Cancel
              </button>
              <button
                onClick={() => handleSubmit()}
                className="btn btn-primary"
                disabled={submitting || timeRemaining === 0}
              >
                {submitting ? "Submitting..." : "Submit Answer"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ChallengeAttemptModal;


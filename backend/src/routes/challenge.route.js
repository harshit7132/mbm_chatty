import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import Challenge from "../models/challenge.model.js";
import UserChallenge from "../models/userChallenge.model.js";
import User from "../models/user.model.js";

const router = express.Router();

// AI Helper function to verify challenge answers using the same AI as chat
const verifyAnswerWithAI = async (challenge, userAnswer, code = null) => {
  try {
    if (!process.env.HUGGINGFACE_API_KEY) {
      console.warn("HUGGINGFACE_API_KEY not configured, falling back to basic verification");
      return { isCorrect: false, feedback: "AI verification not available" };
    }

    const HF_API_URL = "https://router.huggingface.co/v1/chat/completions";
    const CHAT_MODEL = "meta-llama/Llama-3.2-3B-Instruct";

    let systemPrompt = "";
    let userPrompt = "";

    if (challenge.category === "trivia") {
      systemPrompt = "You are an expert quiz evaluator. Your task is to determine if a selected answer option is correct for a trivia question. Respond ONLY with 'CORRECT' or 'INCORRECT' followed by a brief explanation.";
      userPrompt = `Question: ${challenge.challengeData.question}\n\nOptions:\n${challenge.challengeData.options.map((opt, idx) => `${idx}: ${opt}`).join('\n')}\n\nUser selected option: ${userAnswer}\nCorrect answer option: ${challenge.challengeData.correctAnswer}\n\nIs the user's selected answer correct? Respond with 'CORRECT' or 'INCORRECT' followed by a brief explanation.`;
    } else if (challenge.category === "puzzle") {
      systemPrompt = "You are an expert puzzle evaluator. Your task is to determine if a user's answer matches the correct answer for a puzzle or riddle. Consider variations in spelling, capitalization, and minor wording differences. Respond ONLY with 'CORRECT' or 'INCORRECT' followed by a brief explanation.";
      userPrompt = `Puzzle/Riddle: ${challenge.challengeData.question}\n\nCorrect Answer: ${challenge.challengeData.answer}\nUser's Answer: ${userAnswer}\n\nDoes the user's answer match the correct answer? Consider that answers might be worded differently but mean the same thing. Respond with 'CORRECT' or 'INCORRECT' followed by a brief explanation.`;
    } else if (challenge.category === "quiz") {
      systemPrompt = "You are an expert quiz evaluator. Your task is to evaluate multiple quiz questions and answers. For each question, compare the user's selected answer with the correct answer. Count how many questions the user answered correctly. You must also provide the correct answer text for each question. Respond ONLY with a valid JSON object in this exact format: {\"correctCount\": <number>, \"totalQuestions\": <number>, \"feedback\": \"<string>\", \"correctAnswers\": [{\"questionNumber\": <number>, \"correctAnswerText\": \"<string>\"}]}. Do not include any text before or after the JSON.";
      userPrompt = `Evaluate the following quiz answers. Compare each user's selected answer with the correct answer:\n\n${challenge.challengeData.questions.map((q, idx) => {
        const userAnsIdx = userAnswer[idx];
        const userAns = userAnsIdx !== null && userAnsIdx !== undefined && q.options && q.options[userAnsIdx] ? q.options[userAnsIdx] : "No answer provided";
        // Try to get correct answer - handle both cases where correctAnswer exists (as index) or answer exists (as text)
        let correctAnsIdx = q.correctAnswer;
        let correctAns = "Unknown";
        
        // If correctAnswer is an index, use it
        if (correctAnsIdx !== undefined && correctAnsIdx !== null && q.options && q.options[correctAnsIdx]) {
          correctAns = q.options[correctAnsIdx];
        } else if (q.answer !== undefined && q.options && Array.isArray(q.options)) {
          // If answer is text, find its index in options
          const answerText = String(q.answer).trim();
          const foundIndex = q.options.findIndex(opt => String(opt).trim().toLowerCase() === answerText.toLowerCase());
          if (foundIndex !== -1) {
            correctAnsIdx = foundIndex;
            correctAns = q.options[foundIndex];
          }
        }
        
        const isUserCorrect = !isNaN(correctAnsIdx) && Number(userAnsIdx) === Number(correctAnsIdx);
        return `Question ${idx + 1}: ${q.question}\nOptions: ${q.options ? q.options.map((opt, i) => `${i}: ${opt}`).join(', ') : 'No options'}\nUser selected option index: ${userAnsIdx}\nUser Answer: ${userAns}\nCorrect Answer: ${correctAns}\nIs user's answer correct? ${isUserCorrect ? 'YES' : 'NO'}`;
      }).join('\n\n')}\n\nNow count how many questions the user answered correctly and provide the correct answer text for each question. Keep your response concise. Respond with JSON only: {"correctCount": <number>, "totalQuestions": ${challenge.challengeData.questions.length}, "feedback": "<brief feedback>", "correctAnswers": [{"questionNumber": 1, "correctAnswerText": "<just the answer text, e.g. 'Paris'>"}, ...]}`;
    } else if (challenge.category === "coding") {
      systemPrompt = "You are an expert code evaluator. Your task is to evaluate if submitted code solves the given problem correctly. Consider the problem description and test cases. Respond ONLY with 'CORRECT' or 'INCORRECT' followed by a brief explanation of what the code does or what's wrong.";
      userPrompt = `Problem: ${challenge.challengeData.problem}\n\nTest Cases:\n${JSON.stringify(challenge.challengeData.testCases || [], null, 2)}\n\nUser's Code:\n\`\`\`\n${code}\n\`\`\`\n\nDoes this code correctly solve the problem? Respond with 'CORRECT' or 'INCORRECT' followed by a brief explanation.`;
    } else {
      return { isCorrect: false, feedback: "Challenge type not supported for AI verification" };
    }

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];

    const response = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages,
        max_tokens: 1000, // Increased to handle full correctAnswers array for quizzes
        temperature: 0.3, // Lower temperature for more consistent evaluation
      }),
    });

    if (!response.ok) {
      console.error("AI verification API error:", response.status);
      // Fallback to basic verification
      return null;
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || "";

    console.log(`🤖 [AI VERIFICATION] Response for ${challenge.category}:`, aiResponse);
    
    // Store raw AI response for MongoDB
    const rawAIResponse = aiResponse;

    // Parse AI response
    if (challenge.category === "quiz") {
      try {
        // Try to extract JSON from response - be more flexible with whitespace
        let jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          // Try to find JSON that might be wrapped in code blocks
          jsonMatch = aiResponse.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
          if (jsonMatch) {
            jsonMatch = [jsonMatch[1]];
          }
        }
        
        if (jsonMatch) {
          let jsonStr = jsonMatch[0].trim();
          
          // Try to fix incomplete JSON (if truncated)
          if (!jsonStr.endsWith('}')) {
            // Try to close the JSON properly
            if (jsonStr.includes('"correctAnswers"')) {
              // Extract complete correctAnswers entries
              const correctAnswersMatch = jsonStr.match(/"correctAnswers":\s*\[([\s\S]*)/);
              if (correctAnswersMatch) {
                const arrayContent = correctAnswersMatch[1];
                // Extract complete JSON objects from the array
                const entries = [];
                let depth = 0;
                let currentEntry = '';
                let inString = false;
                let escapeNext = false;
                
                for (let i = 0; i < arrayContent.length; i++) {
                  const char = arrayContent[i];
                  
                  if (escapeNext) {
                    currentEntry += char;
                    escapeNext = false;
                    continue;
                  }
                  
                  if (char === '\\') {
                    escapeNext = true;
                    currentEntry += char;
                    continue;
                  }
                  
                  if (char === '"') {
                    inString = !inString;
                    currentEntry += char;
                    continue;
                  }
                  
                  if (!inString) {
                    if (char === '{') {
                      depth++;
                      currentEntry += char;
                    } else if (char === '}') {
                      depth--;
                      currentEntry += char;
                      if (depth === 0 && currentEntry.trim()) {
                        // Complete entry found
                        try {
                          JSON.parse(currentEntry);
                          entries.push(currentEntry.trim());
                        } catch (e) {
                          // Invalid entry, skip
                        }
                        currentEntry = '';
                      }
                    } else if (char === ',' && depth === 0) {
                      // Entry separator
                      if (currentEntry.trim()) {
                        try {
                          JSON.parse(currentEntry.trim());
                          entries.push(currentEntry.trim());
                        } catch (e) {
                          // Invalid entry, skip
                        }
                      }
                      currentEntry = '';
                    } else {
                      currentEntry += char;
                    }
                  } else {
                    currentEntry += char;
                  }
                }
                
                // Add any remaining complete entry
                if (currentEntry.trim() && depth === 0) {
                  try {
                    JSON.parse(currentEntry.trim());
                    entries.push(currentEntry.trim());
                  } catch (e) {
                    // Invalid entry, skip
                  }
                }
                
                if (entries.length > 0) {
                  // Reconstruct JSON with complete entries
                  const beforeArray = jsonStr.substring(0, jsonStr.indexOf('"correctAnswers"'));
                  jsonStr = beforeArray + `"correctAnswers": [${entries.join(', ')}]}`;
                  console.log(`🔧 [AI QUIZ] Fixed truncated JSON: extracted ${entries.length} complete entries`);
                }
              }
            }
            
            // Ensure JSON is properly closed
            if (!jsonStr.endsWith('}')) {
              jsonStr += '}';
            }
          }
          
          try {
            const result = JSON.parse(jsonStr);
            const correctCount = Number(result.correctCount) || 0;
            const totalQuestions = Number(result.totalQuestions) || challenge.challengeData.questions.length;
            
            console.log(`🤖 [AI QUIZ] Parsed result: ${correctCount}/${totalQuestions} correct`);
            
            // Extract correct answers from AI response if provided
            const aiCorrectAnswers = result.correctAnswers || [];
            console.log(`🤖 [AI QUIZ] Extracted ${aiCorrectAnswers.length} correct answers from AI`);
            
            return {
              isCorrect: correctCount === totalQuestions,
              feedback: result.feedback || `You got ${correctCount} out of ${totalQuestions} questions correct. ${correctCount === totalQuestions ? 'Well done!' : 'Keep trying!'}`,
              correctCount: correctCount,
              totalQuestions: totalQuestions,
              aiCorrectAnswers: aiCorrectAnswers, // Store AI-provided correct answers
              rawResponse: rawAIResponse // Store raw AI response for MongoDB
            };
          } catch (parseError) {
            console.error("❌ [AI QUIZ] Failed to parse JSON even after fixing:", parseError.message);
            console.error("JSON string (first 1000 chars):", jsonStr.substring(0, 1000));
            // Fall through to fallback parsing
          }
        }
      } catch (e) {
        console.error("Failed to parse quiz JSON:", e);
        console.error("Raw AI response:", aiResponse);
      }
      
      // Fallback: Try to extract numbers from response
      const numbers = aiResponse.match(/\d+/g);
      if (numbers && numbers.length >= 2) {
        const correctCount = parseInt(numbers[0]);
        const totalQuestions = parseInt(numbers[1]) || challenge.challengeData.questions.length;
        console.log(`🤖 [AI QUIZ] Fallback parsing: ${correctCount}/${totalQuestions} correct`);
        return {
          isCorrect: correctCount === totalQuestions,
          feedback: `You got ${correctCount} out of ${totalQuestions} questions correct. ${correctCount === totalQuestions ? 'Well done!' : 'Keep trying!'}`,
          correctCount: correctCount,
          totalQuestions: totalQuestions,
          rawResponse: rawAIResponse
        };
      }
      
      // Last resort: Use basic verification if AI parsing completely fails
      console.warn("🤖 [AI QUIZ] AI response could not be parsed, falling back to basic verification");
      return null; // This will trigger fallback to basic verification
    }

    // For other types, check if response contains "CORRECT" or "INCORRECT"
    const upperResponse = aiResponse.toUpperCase().trim();
    
    // More robust checking - look for CORRECT first, then INCORRECT
    let isCorrect = false;
    if (upperResponse.startsWith("CORRECT") || upperResponse.includes(" CORRECT")) {
      isCorrect = true;
    } else if (upperResponse.startsWith("INCORRECT") || upperResponse.includes(" INCORRECT")) {
      isCorrect = false;
    } else {
      // If neither found, check for positive/negative indicators
      const positiveWords = ["YES", "RIGHT", "TRUE", "VALID", "ACCEPT"];
      const negativeWords = ["NO", "WRONG", "FALSE", "INVALID", "REJECT"];
      
      const hasPositive = positiveWords.some(word => upperResponse.includes(word));
      const hasNegative = negativeWords.some(word => upperResponse.includes(word));
      
      if (hasPositive && !hasNegative) {
        isCorrect = true;
      } else if (hasNegative) {
        isCorrect = false;
      }
    }
    
    // Extract feedback (everything after CORRECT/INCORRECT or use full response)
    let feedback = aiResponse.trim();
    const correctIndex = upperResponse.indexOf("CORRECT");
    const incorrectIndex = upperResponse.indexOf("INCORRECT");
    
    if (correctIndex !== -1) {
      feedback = aiResponse.substring(correctIndex + 7).trim();
      if (!feedback) feedback = "Correct! Well done!";
    } else if (incorrectIndex !== -1) {
      feedback = aiResponse.substring(incorrectIndex + 9).trim();
      if (!feedback) feedback = "Incorrect. Please try again.";
    }

    return {
      isCorrect,
      feedback: feedback || (isCorrect ? "Correct! Well done!" : "Incorrect. Please try again."),
      rawResponse: rawAIResponse // Store raw AI response for MongoDB
    };

  } catch (error) {
    console.error("Error in AI verification:", error);
    return null; // Return null to fallback to basic verification
  }
};

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

// Get daily challenges (user-specific progress on shared daily challenges)
// Challenges are shared but each user has their own progress tracked in MongoDB
router.get("/daily", protectRoute, async (req, res) => {
  try {
    const userId = req.user._id;
    const userIdString = userId.toString();
    console.log(`Fetching daily challenges for user: ${userIdString}`);
    
    // First, ensure user has all active daily Challenge templates as UserChallenges
    // Filter out challenges with 0 points automatically
    const activeDailyChallenges = await Challenge.find({ 
      isActive: true, 
      type: "daily",
      points: { $gt: 0 } // Only get challenges with points > 0
    });
    
    // Create missing UserChallenges for daily challenges
    const newUserChallenges = [];
    for (const challenge of activeDailyChallenges) {
      const exists = await UserChallenge.findOne({
        $or: [ 
          { userId: userId, challengeId: challenge._id },
          { userId: userIdString, challengeId: challenge._id }
        ]
      });
      
      if (!exists) {
        const expiresAt = (() => {
          const date = new Date();
          date.setHours(23, 59, 59, 999); 
          return date;
        })();

        const userChallenge = new UserChallenge({
          userId: userId,
          challengeId: challenge._id,
          type: "daily",
          title: challenge.title,
          description: challenge.description || "",
          target: challenge.target,
          current: 0,
          reward: { points: challenge.points || 0, badge: null },
          stage: 1,
          maxStages: 1,
          stages: [],
          completed: false,
          completedAt: null,
          expiresAt: expiresAt,
          category: challenge.category || "custom",
          attempts: [],
        });
        newUserChallenges.push(userChallenge);
      }
    }
    
    if (newUserChallenges.length > 0) {
      await UserChallenge.insertMany(newUserChallenges);
      console.log(`✅ Created ${newUserChallenges.length} new daily UserChallenges for user ${userIdString}`);
    }
    
    // Get this user's daily challenges with their own progress
    const dailyChallenges = await UserChallenge.find({
      $and: [
        {
          $or: [
            { userId: userId },
            { userId: userIdString }
          ]
        },
        {
          type: "daily"
        }
      ]
    })
    .populate({
      path: "challengeId",
      select: "category challengeData timeLimit points",
      strictPopulate: false // Don't throw error if challengeId is null or invalid
    })
    .sort({ createdAt: -1 });
    
    console.log(`Found ${dailyChallenges.length} daily challenges for user ${userIdString} (with user's progress)`);
    
    // Convert to plain objects and filter out challenges with 0 points
    const response = dailyChallenges.map(c => {
      if (!c) return null;
      try {
        const obj = c.toObject ? c.toObject() : c;
        // Ensure attempts array exists and is properly formatted
        if (!obj.attempts) {
          obj.attempts = [];
        }
        
        // Get points from challenge template or userChallenge reward
        const challengePoints = obj.challengeId?.points || obj.reward?.points || 0;
        
        // Filter out challenges with 0 points
        if (challengePoints <= 0) {
          console.log(`🗑️ [AUTO-REMOVE] Filtering out challenge "${obj.title}" with 0 points`);
          return null;
        }
        
        return obj;
      } catch (err) {
        console.error("Error converting challenge to object:", err);
        return null;
      }
    }).filter(c => c !== null);
    
    res.status(200).json(response);
  } catch (error) {
    console.error("❌ [ERROR] Error in getDailyChallenges:", error.message);
    console.error("Full error:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ 
      message: "Internal Server Error", 
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
  }
});

// Get my challenges (user-specific progress on shared challenges)
// Challenges are shared but each user has their own progress tracked in MongoDB
// When user logs in from another PC, they see their own progress synced from MongoDB
router.get("/my-challenges", protectRoute, async (req, res) => {
  try {
    const userId = req.user._id;
    const userIdString = userId.toString();
    console.log(`Fetching challenges for user: ${userIdString}`);
    
    // Get this user's challenges with their own progress
    // Each user has their own challenge documents with their own progress
    let userChallenges = await UserChallenge.find({
      $or: [
        { userId: userId },
        { userId: userIdString }
      ]
    }).sort({ createdAt: -1 });
    
    console.log(`Found ${userChallenges.length} challenges for user ${userIdString}`);
    
    // Always check for active Challenge templates that the user doesn't have UserChallenges for
    // This ensures newly created challenges from admin are automatically added to all users
    console.log(`Checking for missing Challenge templates for user ${userIdString}...`);
    
    // Get all active challenges from Challenge collection
    // Filter out challenges with 0 points automatically
    const activeChallenges = await Challenge.find({ 
      isActive: true,
      points: { $gt: 0 } // Only get challenges with points > 0
    });
    console.log(`Found ${activeChallenges.length} active Challenge templates (0 point challenges filtered out)`);
    
    // Create user-specific copies of challenges that the user doesn't have yet
    const newUserChallenges = [];
    for (const challenge of activeChallenges) {
      // Check if user already has this challenge (by challengeId)
      const exists = await UserChallenge.findOne({
        $or: [ 
          { userId: userId, challengeId: challenge._id },
          { userId: userIdString, challengeId: challenge._id }
        ]
      });
      
      if (!exists) {
        console.log(`Creating UserChallenge for user ${userIdString} from template: ${challenge.title} (${challenge.type})`);
        const expiresAt = challenge.type === "daily" ? (() => {
          const date = new Date();
          date.setHours(23, 59, 59, 999); 
          return date;
        })() : null;

        const userChallenge = new UserChallenge({
          userId: userId,
          challengeId: challenge._id, // Always use challenge._id from Challenge model
          type: challenge.type,
          title: challenge.title,
          description: challenge.description || "",
          target: challenge.target,
          current: 0, // Start fresh for this user
          reward: { points: challenge.points || 0, badge: null }, // Use challenge.points
          stage: 1,
          maxStages: 1,
          stages: [],
          completed: false,
          completedAt: null,
          expiresAt: expiresAt,
          category: challenge.category || "custom", // Store category from template
          attempts: [], // Initialize attempts array
        });
        newUserChallenges.push(userChallenge);
      }
    }

    // Insert any new UserChallenges that were created
    if (newUserChallenges.length > 0) {
      await UserChallenge.insertMany(newUserChallenges);
      console.log(`✅ Created ${newUserChallenges.length} new UserChallenges for user ${userIdString}`);
      
      // Re-fetch user challenges to include the newly created ones
      userChallenges = await UserChallenge.find({
        $or: [
          { userId: userId },
          { userId: userIdString }
        ]
      }).sort({ createdAt: -1 });
      console.log(`Total challenges for user ${userIdString} after sync: ${userChallenges.length}`);
    } else {
      console.log(`No new challenges to create for user ${userIdString}`);
    }
    
    // Separate into daily and lifetime
    const dailyChallenges = userChallenges.filter(c => c.type === "daily");
    const lifetimeChallenges = userChallenges.filter(c => c.type === "lifetime");
    
    console.log(`  - Daily: ${dailyChallenges.length} (with user's progress)`);
    console.log(`  - Lifetime: ${lifetimeChallenges.length} (with user's progress)`);
    
    // Convert to plain objects and filter out challenges with 0 points
    const dailyResponse = dailyChallenges.map(c => {
      if (!c) return null;
      try {
        const obj = c.toObject ? c.toObject() : c;
        // Ensure attempts array exists and is properly formatted
        if (!obj.attempts) {
          obj.attempts = [];
        }
        
        // Get points from challenge template or userChallenge reward
        const challengePoints = obj.challengeId?.points || obj.reward?.points || 0;
        
        // Filter out challenges with 0 points
        if (challengePoints <= 0) {
          console.log(`🗑️ [AUTO-REMOVE] Filtering out daily challenge "${obj.title}" with 0 points`);
          return null;
        }
        
        return obj;
      } catch (err) {
        console.error("Error converting daily challenge to object:", err);
        return null;
      }
    }).filter(c => c !== null);
    
    const lifetimeResponse = lifetimeChallenges.map(c => {
      if (!c) return null;
      try {
        const obj = c.toObject ? c.toObject() : c;
        // Ensure attempts array exists and is properly formatted
        if (!obj.attempts) {
          obj.attempts = [];
        }
        
        // Get points from challenge template or userChallenge reward
        const challengePoints = obj.challengeId?.points || obj.reward?.points || 0;
        
        // Filter out challenges with 0 points
        if (challengePoints <= 0) {
          console.log(`🗑️ [AUTO-REMOVE] Filtering out lifetime challenge "${obj.title}" with 0 points`);
          return null;
        }
        
        return obj;
      } catch (err) {
        console.error("Error converting lifetime challenge to object:", err);
        return null;
      }
    }).filter(c => c !== null);
    
    res.status(200).json({ daily: dailyResponse, lifetime: lifetimeResponse });
  } catch (error) {
    console.error("❌ [ERROR] Error in getMyChallenges:", error);
    console.error("Error stack:", error.stack);
    console.error("Error message:", error.message);
    res.status(500).json({ 
      message: "Internal Server Error", 
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
  }
});

// Initialize lifetime challenges
router.post("/init-lifetime", protectRoute, async (req, res) => {
  try {
    // This can be used to initialize default lifetime challenges
    res.status(200).json({ message: "Lifetime challenges initialized" });
  } catch (error) {
    console.log("Error in initLifetimeChallenges:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Admin: Create challenge
router.post("/create", protectRoute, isAdmin, async (req, res) => {
  try {
    const { title, description, type, points, target, category, startDate, endDate, challengeData, timeLimit } = req.body;

    console.log("📝 [CREATE CHALLENGE] Request received:", { title, type, points, target, category });

    // Stricter validation - check for null/undefined explicitly, allow 0
    if (!title || !type || points === undefined || points === null || !target) {
      console.log("❌ [CREATE CHALLENGE] Validation failed:", { title: !!title, type: !!type, points, target: !!target });
      return res.status(400).json({ message: "Title, type, points, and target are required" });
    }

    // Validate points is a valid number and > 0 (challenges with 0 points will be automatically removed)
    const pointsNum = Number(points);
    if (isNaN(pointsNum) || pointsNum <= 0) {
      console.log("❌ [CREATE CHALLENGE] Invalid points value:", points);
      return res.status(400).json({ message: "Points must be a valid number greater than 0. Challenges with 0 points are automatically removed." });
    }

    if (!["daily", "lifetime"].includes(type)) {
      return res.status(400).json({ message: "Type must be 'daily' or 'lifetime'" });
    }

     // Check if a challenge with the same title and type already exists
    const existingChallenge = await Challenge.findOne({ 
      title: { $regex: new RegExp(`^${title}$`, 'i') }, // Case-insensitive match
      type 
    });

    if (existingChallenge) {
      console.log("❌ [CREATE CHALLENGE] Duplicate challenge found:", existingChallenge._id);
      return res.status(400).json({ 
        message: `A ${type} challenge with this title already exists` 
      });
    }

    // Validate challengeData based on category
    let validatedChallengeData = null;
    if (challengeData) {
      if (category === "trivia") {
        if (!challengeData.question || !challengeData.options || challengeData.correctAnswer === undefined) {
          return res.status(400).json({ message: "Trivia challenge requires question, options, and correctAnswer" });
        }
        validatedChallengeData = {
          question: challengeData.question,
          options: Array.isArray(challengeData.options) ? challengeData.options : challengeData.options.split("\n").filter(o => o.trim()),
          correctAnswer: Number(challengeData.correctAnswer),
          explanation: challengeData.explanation || ""
        };
      } else if (category === "puzzle") {
        if (!challengeData.question || !challengeData.answer) {
          return res.status(400).json({ message: "Puzzle challenge requires question and answer" });
        }
        validatedChallengeData = {
          question: challengeData.question,
          answer: challengeData.answer,
          hint: challengeData.hint || ""
        };
      } else if (category === "quiz") {
        if (!challengeData.questions || !Array.isArray(challengeData.questions)) {
          return res.status(400).json({ message: "Quiz challenge requires questions array" });
        }
        validatedChallengeData = {
          questions: challengeData.questions
        };
      } else if (category === "coding") {
        if (!challengeData.problem) {
          return res.status(400).json({ message: "Coding challenge requires problem description" });
        }
        validatedChallengeData = {
          problem: challengeData.problem,
          starterCode: challengeData.starterCode || "",
          testCases: challengeData.testCases || [],
          solution: challengeData.solution || ""
        };
      }
    }

    // Create the challenge template
    const challenge = new Challenge({
      title,
      description: description || "",
      type,
      points: pointsNum, // Use validated pointsNum
      target: Number(target),
      category: category || "custom",
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
      createdBy: req.user._id,
      isActive: true,
      challengeData: validatedChallengeData,
      timeLimit: timeLimit ? Number(timeLimit) : null,
    });

    await challenge.save();
    await challenge.populate("createdBy", "fullName username email");
    
    console.log("✅ [CREATE CHALLENGE] Challenge created successfully:", challenge._id, "with points:", challenge.points);
    
    // Note: Challenges with 0 points are automatically filtered out when fetching
    // They won't appear in user challenge lists

    // Create user challenge progress for all existing users
    // const users = await User.find({});
    // const userChallenges = [];

    // for (const user of users) {
    //   const expiresAt = type === "daily" ? (() => {
    //     const date = new Date();
    //     date.setHours(23, 59, 59, 999);
    //     return date;
    //   })() : null;

    //   const userChallenge = new UserChallenge({
    //     userId: user._id,
    //     challengeId: challenge._id,
    //     type: challenge.type,
    //     title: challenge.title,
    //     description: challenge.description,
    //     target: challenge.target,
    //     current: 0,
    //     reward: {
    //       points: challenge.points,
    //       badge: null,
    //     },
    //     stage: 1,
    //     maxStages: 1,
    //     completed: false,
    //     expiresAt: expiresAt,
    //   });

    //   userChallenges.push(userChallenge);
    // }

    // // Bulk insert user challenges
    // if (userChallenges.length > 0) {
    //   await UserChallenge.insertMany(userChallenges);
    //   console.log(`Created user challenge progress for ${userChallenges.length} users`);
    // }

    // res.status(201).json(challenge);
    res.status(201).json({
      message: "Challenge created successfully",
      challenge
    });
  } catch (error) {
    console.log("Error in createChallenge:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Admin: Get all challenges (both templates and user progress)
router.get("/all", protectRoute, isAdmin, async (req, res) => {
  try {
    // Get all challenge templates (filter out 0 point challenges)
    const challengeTemplates = await Challenge.find({ points: { $gt: 0 } })
      .populate("createdBy", "fullName username email")
      .sort({ createdAt: -1 });

    // Get all user challenge progress (for admin to see user progress)
    // Include both new challenges (with challengeId) and old challenges (without challengeId)
    const userChallenges = await UserChallenge.find()
      .populate("userId", "fullName username email")
      .populate("challengeId", "title type")
      .sort({ createdAt: -1 })
      .limit(500); // Increased limit to see more challenges

    // Get unique old challenges (without challengeId) grouped by title
    const oldChallengesMap = new Map();
    userChallenges.forEach(uc => {
      if (!uc.challengeId && !oldChallengesMap.has(uc.title)) {
        oldChallengesMap.set(uc.title, {
          _id: uc._id,
          title: uc.title,
          description: uc.description,
          type: uc.type,
          target: uc.target,
          points: uc.reward?.points || 0,
          category: "custom",
          isActive: true,
          createdBy: uc.userId,
          createdAt: uc.createdAt,
          isOldChallenge: true, // Flag to identify old challenges
        });
      }
    });

    const oldChallenges = Array.from(oldChallengesMap.values());

    console.log(`Admin: Found ${challengeTemplates.length} template challenges and ${userChallenges.length} user challenges (${oldChallenges.length} unique old challenges)`);

    res.status(200).json({
      templates: challengeTemplates,
      userProgress: userChallenges,
      oldChallenges: oldChallenges, // Add old challenges separately
    });
  } catch (error) {
    console.log("Error in getAllChallenges:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Admin: Update challenge
router.put("/:challengeId", protectRoute, isAdmin, async (req, res) => {
  try {
    const { title, description, type, points, target, category, isActive, startDate, endDate, challengeData, timeLimit } = req.body;
    
    // First, try to find in Challenge model (template)
    let challenge = await Challenge.findById(req.params.challengeId);

    if (challenge) {
      // Validate challengeData if provided
      let validatedChallengeData = challenge.challengeData;
      if (challengeData !== undefined) {
        if (challengeData === null) {
          validatedChallengeData = null;
        } else if (category === "trivia" || challenge.category === "trivia") {
          if (!challengeData.question || !challengeData.options || challengeData.correctAnswer === undefined) {
            return res.status(400).json({ message: "Trivia challenge requires question, options, and correctAnswer" });
          }
          validatedChallengeData = {
            question: challengeData.question,
            options: Array.isArray(challengeData.options) ? challengeData.options : challengeData.options.split("\n").filter(o => o.trim()),
            correctAnswer: Number(challengeData.correctAnswer),
            explanation: challengeData.explanation || ""
          };
        } else if (category === "puzzle" || challenge.category === "puzzle") {
          if (!challengeData.question || !challengeData.answer) {
            return res.status(400).json({ message: "Puzzle challenge requires question and answer" });
          }
          validatedChallengeData = {
            question: challengeData.question,
            answer: challengeData.answer,
            hint: challengeData.hint || ""
          };
        } else if (category === "quiz" || challenge.category === "quiz") {
          if (!challengeData.questions || !Array.isArray(challengeData.questions)) {
            return res.status(400).json({ message: "Quiz challenge requires questions array" });
          }
          validatedChallengeData = {
            questions: challengeData.questions
          };
        } else if (category === "coding" || challenge.category === "coding") {
          if (!challengeData.problem) {
            return res.status(400).json({ message: "Coding challenge requires problem description" });
          }
          validatedChallengeData = {
            problem: challengeData.problem,
            starterCode: challengeData.starterCode || "",
            testCases: challengeData.testCases || [],
            solution: challengeData.solution || ""
          };
        } else {
          validatedChallengeData = challengeData;
        }
      }
      
      // Update Challenge template
      if (title) challenge.title = title;
      if (description !== undefined) challenge.description = description;
      if (type) challenge.type = type;
      if (points !== undefined) {
        const newPoints = Number(points);
        if (newPoints <= 0) {
          return res.status(400).json({ message: "Points must be greater than 0. Challenges with 0 points are automatically removed." });
        }
        challenge.points = newPoints;
      }
      if (target !== undefined) challenge.target = Number(target);
      if (category) challenge.category = category;
      if (isActive !== undefined) challenge.isActive = isActive;
      if (startDate) challenge.startDate = new Date(startDate);
      if (endDate !== undefined) challenge.endDate = endDate ? new Date(endDate) : null;
      if (challengeData !== undefined) challenge.challengeData = validatedChallengeData;
      if (timeLimit !== undefined) challenge.timeLimit = timeLimit ? Number(timeLimit) : null;

      await challenge.save();
      await challenge.populate("createdBy", "fullName username email");

      // Also update all UserChallenge documents that reference this challenge
      const updateFields = {};
      if (title) updateFields.title = title;
      if (description !== undefined) updateFields.description = description;
      if (type) updateFields.type = type;
      if (target !== undefined) updateFields.target = Number(target);
      if (points !== undefined) {
        updateFields["reward.points"] = Number(points);
      }

      if (Object.keys(updateFields).length > 0) {
        await UserChallenge.updateMany(
          { challengeId: challenge._id },
          { $set: updateFields }
        );
        console.log(`Updated ${await UserChallenge.countDocuments({ challengeId: challenge._id })} user challenge progress documents`);
      }

      res.status(200).json(challenge);
    } else {
      // Try to find in UserChallenge model (old challenge without challengeId)
      const oldChallenge = await UserChallenge.findById(req.params.challengeId);
      
      if (!oldChallenge) {
        return res.status(404).json({ message: "Challenge not found" });
      }

      // This is an old challenge - update all UserChallenge documents with the same title
      const updateFields = {};
      if (title) updateFields.title = title;
      if (description !== undefined) updateFields.description = description;
      if (type) updateFields.type = type;
      if (target !== undefined) updateFields.target = Number(target);
      if (points !== undefined) {
        updateFields["reward.points"] = Number(points);
      }

      // Update all UserChallenge documents with the same title (old challenges)
      const result = await UserChallenge.updateMany(
        { 
          title: oldChallenge.title,
          challengeId: { $exists: false } // Only update old challenges without challengeId
        },
        { $set: updateFields }
      );

      console.log(`Updated ${result.modifiedCount} old challenge documents with title: ${oldChallenge.title}`);

      // Return the updated challenge
      const updatedChallenge = await UserChallenge.findById(req.params.challengeId);
      res.status(200).json({
        _id: updatedChallenge._id,
        title: updatedChallenge.title,
        description: updatedChallenge.description,
        type: updatedChallenge.type,
        points: updatedChallenge.reward?.points || 0,
        target: updatedChallenge.target,
        category: category || "custom",
        isActive: isActive !== undefined ? isActive : true,
        startDate: startDate ? new Date(startDate) : updatedChallenge.createdAt,
        endDate: endDate ? new Date(endDate) : null,
        isOldChallenge: true,
      });
    }
  } catch (error) {
    console.log("Error in updateChallenge:", error.message);
    console.error("Full error:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// Admin: Delete challenge
router.delete("/:challengeId", protectRoute, isAdmin, async (req, res) => {
  try {
    console.log(`🗑️ [DELETE CHALLENGE] Attempting to delete challenge with ID: ${req.params.challengeId}`);
    
    // First, try to find in Challenge model (template)
    const challenge = await Challenge.findById(req.params.challengeId);

    if (challenge) {
      console.log(`🗑️ [DELETE CHALLENGE] Found template challenge: ${challenge.title} (points: ${challenge.points})`);
      
      // Delete Challenge template
      await Challenge.findByIdAndDelete(req.params.challengeId);
      
      // Also delete all UserChallenge documents that reference this challenge
      const deletedCount = await UserChallenge.deleteMany({ challengeId: challenge._id });
      console.log(`🗑️ [DELETE CHALLENGE] Deleted template challenge and ${deletedCount.deletedCount} user challenge progress documents`);
      
      res.status(200).json({ message: "Challenge deleted successfully" });
    } else {
      // Try to find in UserChallenge model (old challenge)
      const oldChallenge = await UserChallenge.findById(req.params.challengeId);
      
      if (!oldChallenge) {
        console.log(`❌ [DELETE CHALLENGE] Challenge not found: ${req.params.challengeId}`);
        return res.status(404).json({ message: "Challenge not found" });
      }

      console.log(`🗑️ [DELETE CHALLENGE] Found old challenge: ${oldChallenge.title} (points: ${oldChallenge.reward?.points || 0})`);
      
      // Delete only the specific challenge by _id, not all with the same title
      // This prevents accidentally deleting other challenges with the same title
      await UserChallenge.findByIdAndDelete(req.params.challengeId);
      
      console.log(`🗑️ [DELETE CHALLENGE] Deleted old challenge document with ID: ${req.params.challengeId}, title: ${oldChallenge.title}`);
      res.status(200).json({ message: "Challenge deleted successfully" });
    }
  } catch (error) {
    console.log("Error in deleteChallenge:", error.message);
    console.error("Full error:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// Get challenge template data (for interactive challenges)
router.get("/:challengeId/data", protectRoute, async (req, res) => {
  try {
    const challengeId = req.params.challengeId;
    console.log(`📋 [GET CHALLENGE DATA] Request for challengeId: ${challengeId}`);
    
    if (!challengeId) {
      return res.status(400).json({ message: "Challenge ID is required" });
    }
    
    const challenge = await Challenge.findById(challengeId);
    
    if (!challenge) {
      console.log(`❌ [GET CHALLENGE DATA] Challenge not found: ${challengeId}`);
      return res.status(404).json({ message: "Challenge not found" });
    }
    
    console.log(`✅ [GET CHALLENGE DATA] Found challenge: ${challenge.title}, category: ${challenge.category}`);
    
    // Return challenge data (question, options, etc.) without the answer
    const response = {
      _id: challenge._id,
      title: challenge.title,
      description: challenge.description || "",
      category: challenge.category || "custom",
      type: challenge.type,
      points: challenge.points || 0,
      timeLimit: challenge.timeLimit || null,
      challengeData: challenge.challengeData || null,
    };
    
    // For puzzle challenges, don't send the answer
    if (challenge.category === "puzzle" && challenge.challengeData) {
      response.challengeData = {
        question: challenge.challengeData.question || "",
        hint: challenge.challengeData.hint || ""
      };
    }
    
    // For trivia challenges, don't send the correct answer
    if (challenge.category === "trivia" && challenge.challengeData) {
      const triviaData = { ...challenge.challengeData };
      delete triviaData.correctAnswer; // Don't send the answer to frontend
      response.challengeData = triviaData;
    }
    
    // For coding challenges, don't send the solution
    if (challenge.category === "coding" && challenge.challengeData) {
      const codingData = { ...challenge.challengeData };
      delete codingData.solution; // Don't send the solution to frontend
      response.challengeData = codingData;
    }
    
    // For quiz challenges, don't send the correctAnswer in each question
    if (challenge.category === "quiz" && challenge.challengeData && challenge.challengeData.questions) {
      const quizData = {
        ...challenge.challengeData,
        questions: challenge.challengeData.questions.map(q => {
          const { correctAnswer, ...questionWithoutAnswer } = q;
          return questionWithoutAnswer; // Remove correctAnswer from each question
        })
      };
      response.challengeData = quizData;
    }
    
    res.status(200).json(response);
  } catch (error) {
    console.error("❌ [GET CHALLENGE DATA] Error:", error.message);
    console.error("Full error stack:", error.stack);
    res.status(500).json({ 
      message: "Internal Server Error", 
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined
    });
  }
});

// Submit challenge answer
router.post("/:challengeId/submit", protectRoute, async (req, res) => {
  try {
    const userId = req.user._id;
    const { answer, code } = req.body;
    
    // Get challenge template
    const challenge = await Challenge.findById(req.params.challengeId);
    if (!challenge) {
      return res.status(404).json({ message: "Challenge not found" });
    }
    
    // Get user's challenge progress
    const userChallenge = await UserChallenge.findOne({
      userId: userId,
      challengeId: challenge._id
    });
    
    if (!userChallenge) {
      return res.status(404).json({ message: "User challenge not found" });
    }
    
    // Allow multiple attempts even if completed - users can retry for better scores
    // if (userChallenge.completed) {
    //   return res.status(400).json({ message: "Challenge already completed" });
    // }
    
    // Check attempt count and charge points if needed
    // IMPORTANT: Check BEFORE adding the new attempt, so 3rd attempt (index 2) needs payment
    const attempts = userChallenge.attempts || [];
    const freeAttemptsUsed = attempts.length; // Current attempts (before adding this one)
    const needsPayment = freeAttemptsUsed >= 2; // 3rd attempt (index 2) and beyond need payment
    
    console.log(`💰 [ATTEMPT PAYMENT] Attempt #${freeAttemptsUsed + 1}, needsPayment: ${needsPayment}, previousAttempts: ${freeAttemptsUsed}, freeAttemptsRemaining: ${Math.max(0, 2 - freeAttemptsUsed)}`);
    
    if (needsPayment) {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (user.points < 2) {
        return res.status(400).json({ 
          message: "Insufficient points. You need 2 points to attempt this challenge after using your free attempts." 
        });
      }
      
      // Deduct 2 points for this attempt
      user.points = (user.points || 0) - 2;
      user.pointsSpent = (user.pointsSpent || 0) + 2; // Update pointsSpent for leaderboard
      user.pointsHistory.push({
        type: "challenge_attempt",
        amount: -2,
        description: `Attempt fee for challenge: ${challenge.title}`,
        timestamp: new Date(),
      });
      await user.save();
      
      console.log(`💰 [ATTEMPT PAYMENT] Deducted 2 points. User now has ${user.points} points`);
      
      // Emit socket event for real-time points update
      if (req.app.get("io")) {
        req.app.get("io").to(userId.toString()).emit("points-updated", { points: user.points });
      }
    }
    
    let isCorrect = false;
    let feedback = "";
    let aiResult = null;
    let verificationMethod = "ai"; // Track verification method for MongoDB
    let questionResults = []; // For quiz challenges - track which questions are correct/incorrect
    let correctCount = 0;
    let totalQuestions = 0;
    
    // Verify answer using AI (same AI as chat feature)
    console.log(`🤖 [CHALLENGE SUBMIT] Verifying ${challenge.category} challenge answer with AI...`);
    
    if (challenge.category === "trivia") {
      if (answer === null || answer === undefined) {
        return res.status(400).json({ message: "Please select an answer" });
      }
      
      aiResult = await verifyAnswerWithAI(challenge, Number(answer));
      
      if (aiResult) {
        isCorrect = aiResult.isCorrect;
        feedback = aiResult.feedback;
      } else {
        // Fallback to basic verification if AI fails
        verificationMethod = "basic";
        const selectedAnswer = Number(answer);
        isCorrect = selectedAnswer === challenge.challengeData?.correctAnswer;
        feedback = isCorrect 
          ? "Correct! " + (challenge.challengeData?.explanation || "")
          : "Incorrect. Try again!";
      }
    } else if (challenge.category === "puzzle") {
      if (!answer || !answer.trim()) {
        return res.status(400).json({ message: "Please enter your answer" });
      }
      
      aiResult = await verifyAnswerWithAI(challenge, answer.trim());
      
      if (aiResult) {
        isCorrect = aiResult.isCorrect;
        feedback = aiResult.feedback;
      } else {
        // Fallback to basic verification if AI fails
        verificationMethod = "basic";
        const userAnswer = answer.trim().toLowerCase();
        const correctAnswer = (challenge.challengeData?.answer || "").trim().toLowerCase();
        isCorrect = userAnswer === correctAnswer;
        feedback = isCorrect 
          ? "Correct! Well done!" 
          : "Incorrect. Try again!";
      }
    } else if (challenge.category === "quiz") {
      // Quiz has multiple questions - answer should be an array
      if (!Array.isArray(answer) || answer.length !== challenge.challengeData?.questions?.length) {
        return res.status(400).json({ message: "Invalid answer format for quiz" });
      }
      
      aiResult = await verifyAnswerWithAI(challenge, answer);
      
      // For quiz, we need to track correctCount and totalQuestions for partial credit
      // Also track which questions are correct/incorrect for detailed feedback
      correctCount = 0;
      totalQuestions = challenge.challengeData.questions.length;
      questionResults = []; // Array to store which questions are correct/incorrect
      
      if (aiResult && aiResult.correctCount !== undefined) {
        correctCount = aiResult.correctCount;
        totalQuestions = aiResult.totalQuestions || totalQuestions;
        isCorrect = correctCount === totalQuestions; // Only fully correct if all questions are right
        feedback = aiResult.feedback;
        
        // Build detailed question-by-question feedback
        // IMPORTANT: challenge.challengeData comes from database and should have correctAnswer
        challenge.challengeData.questions.forEach((q, idx) => {
          const userAnswerIdx = Number(answer[idx]);
          // Handle correctAnswer - it might be a number (index), string (text), or undefined
          let correctAnswerIdx = NaN;
          
          // First, try correctAnswer as index (number)
          if (q.correctAnswer !== undefined && q.correctAnswer !== null) {
            correctAnswerIdx = Number(q.correctAnswer);
          }
          
          // If still NaN, check if 'answer' field exists (text answer) and find its index
          if (isNaN(correctAnswerIdx) && q.answer !== undefined && q.options && Array.isArray(q.options)) {
            // Find the index of the answer text in options array
            const answerText = String(q.answer).trim();
            const foundIndex = q.options.findIndex(opt => String(opt).trim().toLowerCase() === answerText.toLowerCase());
            if (foundIndex !== -1) {
              correctAnswerIdx = foundIndex;
              console.log(`✅ [QUIZ] Question ${idx + 1}: Converted answer text "${q.answer}" to index ${foundIndex}`);
            }
          }
          
          // If still NaN, try alternative field names
          if (isNaN(correctAnswerIdx)) {
            console.warn(`⚠️ [QUIZ] Question ${idx + 1}: correctAnswer is missing. Trying alternative fields.`, {
              correctAnswer: q.correctAnswer,
              answer: q.answer,
              questionKeys: Object.keys(q)
            });
            if (q.correct !== undefined) {
              const correctVal = Number(q.correct);
              if (!isNaN(correctVal)) {
                correctAnswerIdx = correctVal;
              } else if (q.options && Array.isArray(q.options)) {
                // Try to find index of correct text
                const foundIndex = q.options.findIndex(opt => String(opt).trim().toLowerCase() === String(q.correct).trim().toLowerCase());
                if (foundIndex !== -1) correctAnswerIdx = foundIndex;
              }
            }
          }
          
          const isQuestionCorrect = !isNaN(correctAnswerIdx) && userAnswerIdx === correctAnswerIdx;
          
          // Get user answer text
          let userAnswerText = "No answer";
          if (q.options && Array.isArray(q.options) && userAnswerIdx >= 0 && userAnswerIdx < q.options.length) {
            userAnswerText = q.options[userAnswerIdx];
          }
          
          // Get correct answer text - prioritize AI-provided answer if database answer is missing
          let correctAnswerText = "Unknown";
          
          // First, try to get from AI response if database answer is missing
          if (isNaN(correctAnswerIdx) && aiResult && aiResult.aiCorrectAnswers) {
            const aiAnswer = aiResult.aiCorrectAnswers.find(a => a.questionNumber === idx + 1);
            if (aiAnswer && aiAnswer.correctAnswerText) {
              correctAnswerText = aiAnswer.correctAnswerText;
              console.log(`✅ [QUIZ] Question ${idx + 1}: Using AI-provided correct answer: ${correctAnswerText}`);
            }
          }
          
          // If we have a valid index from database, use that (takes priority over AI)
          if (!isNaN(correctAnswerIdx) && q.options && Array.isArray(q.options) && correctAnswerIdx >= 0 && correctAnswerIdx < q.options.length) {
            correctAnswerText = q.options[correctAnswerIdx];
          } else if (isNaN(correctAnswerIdx) && (!aiResult || !aiResult.aiCorrectAnswers || !aiResult.aiCorrectAnswers.find(a => a.questionNumber === idx + 1))) {
            // If still unknown and AI didn't provide it, show error
            correctAnswerText = "Correct answer not available";
            console.error(`❌ [QUIZ] Question ${idx + 1}: Cannot determine correct answer. correctAnswer: ${q.correctAnswer}, options length: ${q.options?.length || 0}`);
          }
          
          questionResults.push({
            questionNumber: idx + 1,
            question: q.question || "Question",
            userAnswer: userAnswerText,
            correctAnswer: correctAnswerText,
            isCorrect: isQuestionCorrect
          });
        });
      } else {
        // Fallback to basic verification if AI fails
        verificationMethod = "basic";
        challenge.challengeData.questions.forEach((q, idx) => {
          const userAnswerIdx = Number(answer[idx]);
          // Handle correctAnswer - it might be a number, string, or undefined
          let correctAnswerIdx = NaN;
          if (q.correctAnswer !== undefined && q.correctAnswer !== null) {
            correctAnswerIdx = Number(q.correctAnswer);
          }
          
          // If still NaN, try to find it in the question object
          if (isNaN(correctAnswerIdx)) {
            console.warn(`⚠️ [QUIZ] Question ${idx + 1}: correctAnswer is missing or invalid. Question data:`, JSON.stringify(q, null, 2));
            // Try alternative field names
            if (q.correct !== undefined) correctAnswerIdx = Number(q.correct);
            if (q.answer !== undefined) correctAnswerIdx = Number(q.answer);
          }
          
          const isQuestionCorrect = !isNaN(correctAnswerIdx) && userAnswerIdx === correctAnswerIdx;
          
          if (isQuestionCorrect) {
            correctCount++;
          }
          
          // Get user answer text
          let userAnswerText = "No answer";
          if (q.options && Array.isArray(q.options) && userAnswerIdx >= 0 && userAnswerIdx < q.options.length) {
            userAnswerText = q.options[userAnswerIdx];
          }
          
          // Get correct answer text
          let correctAnswerText = "Unknown";
          if (!isNaN(correctAnswerIdx) && q.options && Array.isArray(q.options) && correctAnswerIdx >= 0 && correctAnswerIdx < q.options.length) {
            correctAnswerText = q.options[correctAnswerIdx];
          } else if (isNaN(correctAnswerIdx)) {
            correctAnswerText = "Invalid question data";
            console.error(`❌ [QUIZ] Question ${idx + 1}: Cannot determine correct answer. correctAnswer field: ${q.correctAnswer}`);
          }
          
          questionResults.push({
            questionNumber: idx + 1,
            question: q.question || "Question",
            userAnswer: userAnswerText,
            correctAnswer: correctAnswerText,
            isCorrect: isQuestionCorrect
          });
        });
        
        isCorrect = correctCount === totalQuestions; // Only fully correct if all questions are right
        
        // Build detailed feedback message
        const correctQuestions = questionResults.filter(q => q.isCorrect).map(q => `Question ${q.questionNumber}`).join(", ");
        const incorrectQuestions = questionResults.filter(q => !q.isCorrect).map(q => `Question ${q.questionNumber}`).join(", ");
        
        feedback = `You got ${correctCount} out of ${totalQuestions} questions correct.\n\n`;
        if (correctQuestions) {
          feedback += `✅ Correct: ${correctQuestions}\n`;
        }
        if (incorrectQuestions) {
          feedback += `❌ Incorrect: ${incorrectQuestions}`;
        }
      }
      
      // Store correctCount and questionResults for partial credit calculation and detailed feedback
      if (!aiResult) {
        aiResult = { correctCount, totalQuestions, questionResults };
      } else {
        aiResult.questionResults = questionResults;
      }
    } else if (challenge.category === "coding") {
      if (!code || !code.trim()) {
        return res.status(400).json({ message: "Code submission required" });
      }
      
      aiResult = await verifyAnswerWithAI(challenge, null, code);
      
      if (aiResult) {
        isCorrect = aiResult.isCorrect;
        feedback = aiResult.feedback;
      } else {
        // Fallback: For coding, we can't really verify without running code
        // So we'll require AI verification
        verificationMethod = "basic";
        isCorrect = false;
        feedback = "Unable to verify code. Please ensure AI verification is available.";
      }
    } else {
      return res.status(400).json({ message: "This challenge type doesn't support answer submission" });
    }
    
    // Store attempt in MongoDB with AI verification data
    if (!userChallenge.attempts) {
      userChallenge.attempts = [];
    }
    
    // Store attempt in MongoDB with all verification data
    const attemptData = {
      attemptDate: new Date(),
      correct: isCorrect,
      answer: answer || code,
      paid: needsPayment, // Track if this attempt was paid (stored in MongoDB)
      verifiedWithAI: verificationMethod === "ai", // Track if verified with AI (stored in MongoDB)
      aiFeedback: feedback, // Store AI feedback (stored in MongoDB)
    };
    
    // Store additional data for quiz challenges (stored in MongoDB)
    if (challenge.category === "quiz" && aiResult && aiResult.correctCount !== undefined) {
      attemptData.correctCount = aiResult.correctCount;
      attemptData.totalQuestions = aiResult.totalQuestions;
    }
    
    // Store raw AI response if available (for debugging/analytics in MongoDB)
    if (aiResult && aiResult.rawResponse) {
      attemptData.aiResponse = aiResult.rawResponse;
    }
    
    // Push attempt data to MongoDB
    userChallenge.attempts.push(attemptData);
    console.log(`💾 [MONGODB] Storing attempt data:`, {
      correct: attemptData.correct,
      paid: attemptData.paid,
      verifiedWithAI: attemptData.verifiedWithAI,
      hasAIResponse: !!attemptData.aiResponse
    });
    
    // Update category if not set (for backward compatibility)
    if (!userChallenge.category && challenge.category) {
      userChallenge.category = challenge.category;
    }
    
    // Calculate points to award (with partial credit for quizzes)
    let pointsToAward = 0;
    const basePoints = challenge.points || userChallenge.reward?.points || 0;
    
    if (challenge.category === "quiz" && aiResult && aiResult.correctCount !== undefined) {
      // Partial credit for quizzes: (correctCount / totalQuestions) * basePoints
      const correctCount = aiResult.correctCount;
      const totalQuestions = aiResult.totalQuestions || challenge.challengeData.questions.length;
      if (correctCount > 0 && totalQuestions > 0) {
        pointsToAward = Math.floor((correctCount / totalQuestions) * basePoints);
        console.log(`🎯 [PARTIAL CREDIT] Quiz: ${correctCount}/${totalQuestions} correct = ${pointsToAward} points (out of ${basePoints})`);
      }
    } else if (isCorrect) {
      // Full points for fully correct answers (non-quiz or fully correct quiz)
      pointsToAward = basePoints;
    }
    
    // Award points (even if partial credit for quizzes)
    if (pointsToAward > 0) {
      const user = await User.findById(userId);
      if (user) {
        user.points = (user.points || 0) + pointsToAward;
        user.totalPoints = (user.totalPoints || 0) + pointsToAward;
        user.pointsHistory.push({
          type: "challenge",
          amount: pointsToAward,
          description: challenge.category === "quiz" && aiResult && aiResult.correctCount !== undefined
            ? `Quiz challenge: ${aiResult.correctCount}/${aiResult.totalQuestions} correct - ${challenge.title}`
            : `Completed challenge: ${challenge.title}`,
          timestamp: new Date(),
        });
        await user.save();
        
        console.log(`💰 [POINTS AWARDED] Awarded ${pointsToAward} points. User now has ${user.points} points`);
        
        // Emit socket event for real-time points update
        if (req.app.get("io")) {
          req.app.get("io").to(userId.toString()).emit("points-updated", { points: user.points });
        }
      }
    }
    
    // Only mark as completed if fully correct (all questions correct for quiz)
    if (isCorrect) {
      userChallenge.current = userChallenge.target;
      userChallenge.completed = true;
      userChallenge.completedAt = new Date();
    }
    
    // Save userChallenge with attempt history to MongoDB
    await userChallenge.save();
    
    res.status(200).json({
      success: isCorrect,
      correct: isCorrect,
      feedback: feedback,
      completed: userChallenge.completed,
      pointsAwarded: pointsToAward, // Use calculated points (includes partial credit for quizzes)
      pointsCharged: needsPayment ? 2 : 0,
      attemptsUsed: userChallenge.attempts.length,
      freeAttemptsRemaining: Math.max(0, 2 - freeAttemptsUsed), // Use freeAttemptsUsed (before adding this attempt)
      // For quiz challenges, include detailed question results
      ...(challenge.category === "quiz" && aiResult && aiResult.correctCount !== undefined ? {
        correctCount: aiResult.correctCount,
        totalQuestions: aiResult.totalQuestions,
        questionResults: aiResult.questionResults || [] // Detailed breakdown of which questions are correct/incorrect
      } : challenge.category === "quiz" ? {
        // Even if AI failed, include question results from basic verification
        correctCount: correctCount || 0,
        totalQuestions: totalQuestions || challenge.challengeData.questions.length,
        questionResults: questionResults || []
      } : {})
    });
  } catch (error) {
    console.log("Error in submitChallengeAnswer:", error.message);
    console.error("Full error:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// Reset daily challenges progress
router.post("/reset-daily", protectRoute, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    
    // Check if user has enough points (4 points required)
    if (user.points < 4) {
      return res.status(400).json({
        success: false,
        message: "Not enough points. You need 4 points to refresh daily challenges."
      });
    }
    
    // Deduct points first
    user.points -= 4;
    user.pointsSpent = (user.pointsSpent || 0) + 4; // Update pointsSpent for leaderboard
    user.pointsHistory = user.pointsHistory || [];
    user.pointsHistory.push({
      type: "spent",
      amount: -4,
      description: "Reset daily challenges",
      timestamp: new Date(),
    });
    await user.save();
    
    // Reset all daily challenges for this user
    await UserChallenge.updateMany(
      { 
        userId,
        type: "daily",
        completed: false 
      },
      { 
        $set: { 
          current: 0,
          updatedAt: new Date()
        } 
      }
    );
    
    // Get updated challenges
    const updatedChallenges = await UserChallenge.find({
      userId,
      type: "daily"
    });
    
    // Emit socket event to update points in real-time
    if (req.app.get("io")) {
      req.app.get("io").to(userId.toString()).emit("points-updated", { points: user.points });
    }
    
    res.status(200).json({
      success: true,
      message: "Daily challenges reset successfully",
      challenges: updatedChallenges,
      points: user.points
    });
    
  } catch (error) {
    console.error("Error resetting daily challenges:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reset daily challenges"
    });
  }
});

export default router;


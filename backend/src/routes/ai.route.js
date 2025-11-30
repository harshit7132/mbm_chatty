// import express from "express";
// import { protectRoute } from "../middleware/auth.middleware.js";

// const router = express.Router();

// // HuggingFace Inference API configuration
// // Updated to use the new router endpoint (old api-inference.huggingface.co is deprecated)
// const HUGGINGFACE_API_URL = "https://router.huggingface.co";
// // MiroThinker models - Qwen-based chat models
// // Model options:
// // - "miromind-ai/MiroThinker-v1.0-8B" (RECOMMENDED: Fast, efficient, 256K context, 600 tokens)
// // - "miromind-ai/MiroThinker-v1.0-30B" (More powerful but slower, 256K context, 600 tokens)
// // - "miromind-ai/MiroThinker-v1.0-72B" (Most powerful but slowest, 256K context, 600 tokens)
// const CHAT_MODEL = "miromind-ai/MiroThinker-v1.0-8B";

// // Chat with AI using HuggingFace Inference API
// router.post("/chat", protectRoute, async (req, res) => {
//   try {
//     const { message, conversationHistory } = req.body;
    
//     if (!message) {
//       return res.status(400).json({ message: "Message is required" });
//     }

//     // Check if HuggingFace API key is configured
//     if (!process.env.HUGGINGFACE_API_KEY) {
//       console.warn("HuggingFace API key not configured, using fallback response");
//       return res.status(200).json({ 
//         response: "HuggingFace API key is not configured. Please add HUGGINGFACE_API_KEY to your .env file." 
//       });
//     }

//     // Build messages array for chat template (MiroThinker/Qwen uses chat template format)
//     const messages = [];
    
//     // Add system message
//     messages.push({
//       role: "system",
//       content: "You are a helpful AI assistant in a chat application. Be friendly, concise, and helpful. Keep responses conversational and not too long."
//     });
    
//     // Add conversation history if provided
//     if (conversationHistory && Array.isArray(conversationHistory)) {
//       conversationHistory.forEach(msg => {
//         messages.push({
//           role: msg.role === "user" ? "user" : "assistant",
//           content: msg.content
//         });
//       });
//     }
    
//     // Add current user message
//     messages.push({
//       role: "user",
//       content: message
//     });

//     // Format as text using Qwen chat template format (since Inference API typically uses text input)
//     // Qwen models use <|im_start|> and <|im_end|> tags
//     let prompt = "<|im_start|>system\nYou are a helpful AI assistant in a chat application. Be friendly, concise, and helpful. Keep responses conversational and not too long.<|im_end|>\n";
    
//     // Add conversation history if provided
//     if (conversationHistory && Array.isArray(conversationHistory)) {
//       conversationHistory.forEach(msg => {
//         if (msg.role === "user") {
//           prompt += `<|im_start|>user\n${msg.content}<|im_end|>\n`;
//         } else {
//           prompt += `<|im_start|>assistant\n${msg.content}<|im_end|>\n`;
//         }
//       });
//     }
    
//     // Add current user message
//     prompt += `<|im_start|>user\n${message}<|im_end|>\n<|im_start|>assistant\n`;

//     // Call HuggingFace Inference API (using new router endpoint)
//     const response = await fetch(`${HUGGINGFACE_API_URL}/models/${CHAT_MODEL}`, {
//       method: "POST",
//       headers: {
//         "Authorization": `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         inputs: prompt,
//         parameters: {
//           max_new_tokens: 500,
//           temperature: 0.7,
//           return_full_text: false,
//           top_p: 0.9,
//         },
//       }),
//     });

//     if (!response.ok) {
//       const errorData = await response.json().catch(() => ({}));
//       console.error("HuggingFace API error:", response.status, errorData);
      
//       if (response.status === 401) {
//         return res.status(401).json({ message: "Invalid HuggingFace API key. Please check your .env file." });
//       } else if (response.status === 429) {
//         return res.status(429).json({ message: "HuggingFace API rate limit exceeded. Please try again later." });
//       } else if (response.status === 503) {
//         return res.status(503).json({ message: "Model is loading. Please wait a moment and try again." });
//       }
      
//       throw new Error(`HuggingFace API error: ${response.status} ${response.statusText}`);
//     }

//     const data = await response.json();
    
//     // Extract response text from HuggingFace response
//     let aiResponse = "";
//     if (Array.isArray(data) && data.length > 0) {
//       aiResponse = data[0].generated_text || "";
//     } else if (data.generated_text) {
//       aiResponse = data.generated_text;
//     } else if (typeof data === "string") {
//       aiResponse = data;
//     } else {
//       aiResponse = "I'm sorry, I couldn't generate a response. Please try again.";
//     }

//     // Clean up the response - remove Qwen formatting tags if present
//     aiResponse = aiResponse.trim();
//     // Remove any Qwen chat template tags that might be in the response
//     aiResponse = aiResponse.replace(/<\|im_start\|>.*?<\|im_end\|>/g, "").trim();
//     // Remove any remaining assistant tags
//     aiResponse = aiResponse.replace(/^assistant:\s*/i, "").trim();
    
//     res.status(200).json({ response: aiResponse });
//   } catch (error) {
//     console.error("Error in chatWithAI:", error.message);
//     console.error("Full error:", error);
    
//     res.status(500).json({ message: "Internal Server Error", error: error.message });
//   }
// });

//// export default router;
import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import AIChat from "../models/aiChat.model.js";
import User from "../models/user.model.js";

const router = express.Router();

const HF_API_URL = "https://router.huggingface.co/v1/chat/completions";

const CHAT_MODEL = "meta-llama/Llama-3.2-3B-Instruct";

// Get AI chat history for the current user
router.get("/history", protectRoute, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Fetch all AI chat messages for this user, sorted by creation date
    const messages = await AIChat.find({ userId })
      .sort({ createdAt: 1 }) // Oldest first
      .select("role content createdAt")
      .lean();

    res.status(200).json({ messages });
  } catch (error) {
    console.error("Error fetching AI chat history:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// Chat with AI and save messages to MongoDB
router.post("/chat", protectRoute, async (req, res) => {
  try {
    const { message, conversationHistory } = req.body;
    const userId = req.user._id;
    const POINTS_PER_MESSAGE = 3;
    const FREE_MESSAGES_LIMIT = 2;

    if (!message) {
      return res.status(400).json({ message: "Message is required" });
    }

    if (!process.env.HUGGINGFACE_API_KEY) {
      return res.status(500).json({ message: "Missing HUGGINGFACE_API_KEY" });
    }

    // Get user with latest data
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user has used free messages
    const freeMessagesUsed = user.freeAIMessagesUsed || 0;
    const userPoints = user.points || user.totalPoints || 0;

    // Check if user needs to pay
    if (freeMessagesUsed >= FREE_MESSAGES_LIMIT) {
      // User has used all free messages, check if they have points
      if (userPoints < POINTS_PER_MESSAGE) {
        // Delete the message we haven't saved yet (we save it after payment check)
        return res.status(402).json({
          message: "Insufficient chatty points",
          requiredPoints: POINTS_PER_MESSAGE,
          currentPoints: userPoints,
          freeMessagesUsed: freeMessagesUsed,
          freeMessagesLimit: FREE_MESSAGES_LIMIT,
        });
      }
    }

    // Save user message to MongoDB
    const userMessage = await AIChat.create({
      userId,
      role: "user",
      content: message,
    });

    // Deduct points if free messages are exhausted
    if (freeMessagesUsed >= FREE_MESSAGES_LIMIT) {
      const newPoints = userPoints - POINTS_PER_MESSAGE;
      user.points = newPoints;
      user.totalPoints = newPoints;
      user.pointsSpent = (user.pointsSpent || 0) + POINTS_PER_MESSAGE;

      // Add to points history
      user.pointsHistory.push({
        type: "spent",
        amount: POINTS_PER_MESSAGE,
        description: "AI chat message",
        timestamp: new Date(),
      });

      await user.save();
    } else {
      // Increment free messages used
      user.freeAIMessagesUsed = freeMessagesUsed + 1;
      await user.save();
    }

    // Build messages array for AI (fetch from DB if no conversationHistory provided)
    const messages = [
      { role: "system", content: "You are a helpful AI assistant." },
    ];

    // If conversationHistory is not provided, fetch from MongoDB
    let historyMessages = [];
    if (Array.isArray(conversationHistory) && conversationHistory.length > 0) {
      historyMessages = conversationHistory;
    } else {
      // Fetch last 10 messages from MongoDB for context
      const dbMessages = await AIChat.find({ userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .select("role content")
        .lean();
      historyMessages = dbMessages.reverse(); // Reverse to get chronological order
    }

    // Add conversation history
    historyMessages.forEach(msg => {
      messages.push({ role: msg.role, content: msg.content });
    });

    // Add current user message
    messages.push({ role: "user", content: message });

    // Call HuggingFace API
    const response = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages,
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // If AI call fails, delete the user message we just saved
      await AIChat.findByIdAndDelete(userMessage._id);
      return res.status(response.status).json({
        error: data.error || "HF Router API error",
      });
    }

    const aiResponse =
      data.choices?.[0]?.message?.content ??
      "I couldn't generate a response.";

    // Save AI response to MongoDB
    const aiMessage = await AIChat.create({
      userId,
      role: "assistant",
      content: aiResponse,
    });

    // Get updated user points
    const updatedUser = await User.findById(userId);
    const updatedPoints = updatedUser.points || updatedUser.totalPoints || 0;

    return res.status(200).json({ 
      response: aiResponse,
      userMessageId: userMessage._id,
      aiMessageId: aiMessage._id,
      pointsDeducted: freeMessagesUsed >= FREE_MESSAGES_LIMIT ? POINTS_PER_MESSAGE : 0,
      remainingPoints: updatedPoints,
      freeMessagesUsed: updatedUser.freeAIMessagesUsed || 0,
      freeMessagesLimit: FREE_MESSAGES_LIMIT,
    });

  } catch (error) {
    console.error("Chat error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

// Clear AI chat history for the current user
router.delete("/history", protectRoute, async (req, res) => {
  try {
    const userId = req.user._id;
    
    await AIChat.deleteMany({ userId });
    
    res.status(200).json({ message: "AI chat history cleared" });
  } catch (error) {
    console.error("Error clearing AI chat history:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
});

export default router;

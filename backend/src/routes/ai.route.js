import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

// Chat with AI
router.post("/chat", protectRoute, async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ message: "Message is required" });
    }

    // Placeholder - implement OpenAI integration
    // For now, return a simple response
    const response = `AI Response to: ${message}`;
    
    res.status(200).json({ response });
  } catch (error) {
    console.log("Error in chatWithAI:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;


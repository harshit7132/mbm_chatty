import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { sendCallRequestEmail } from "../lib/email.js";
import User from "../models/user.model.js";

const router = express.Router();

// Send email to offline user for call request
router.post("/send-email", protectRoute, async (req, res) => {
  try {
    const { targetUserId, targetUserEmail, targetUserName, callType, message, fromUserName } = req.body;

    if (!targetUserEmail || !message || !callType) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Verify target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Send email via Brevo
    await sendCallRequestEmail(
      targetUserEmail,
      targetUserName || "User",
      fromUserName || req.user.fullName || req.user.username || "Someone",
      callType,
      message
    );

    res.status(200).json({ message: "Email sent successfully" });
  } catch (error) {
    console.log("Error in sendCallRequestEmail:", error.message);
    res.status(500).json({ message: "Failed to send email" });
  }
});

export default router;


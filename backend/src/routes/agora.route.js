import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import pkg from "agora-token";
const { RtcTokenBuilder, RtcRole } = pkg;

const router = express.Router();

/**
 * Generate Agora RTC Token
 * This token is required for users to join Agora video/voice calls
 */
router.post("/generate-token", protectRoute, async (req, res) => {
  try {
    // Get Agora credentials from environment variables
    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;
    
    console.log("🔍 Checking Agora env variables...");
    console.log("   AGORA_APP_ID:", appId ? `✅ Set (${appId.substring(0, 10)}...)` : "❌ Missing");
    console.log("   AGORA_APP_CERTIFICATE:", appCertificate ? `✅ Set (${appCertificate.substring(0, 10)}...)` : "❌ Missing");
    
    // Validate Agora credentials
    if (!appId || !appCertificate) {
      console.error("❌ Missing Agora env variables.");
      return res.status(500).json({
        message: "Agora credentials not configured. Please add AGORA_APP_ID and AGORA_APP_CERTIFICATE to backend/.env file and restart the server.",
        error: "Missing environment variables"
      });
    }

    // Read front-end userId and channelName (roomId)
    const { userId, channelName } = req.body;
    console.log("📥 Backend received:", { userId, channelName, body: req.body });

    // Validate userId
    if (!userId || String(userId).trim() === "") {
      console.error("❌ Missing userId in request");
      return res.status(400).json({
        error: "userId is required"
      });
    }

    // Validate channelName (roomId)
    if (!channelName || String(channelName).trim() === "") {
      console.error("❌ Missing channelName in request");
      return res.status(400).json({
        error: "channelName is required"
      });
    }

    const normalizedUserId = String(userId).trim();
    const normalizedChannelName = String(channelName).trim();

    // Token expiration time (1 hour = 3600 seconds)
    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    console.log("🔧 Generating token with params:", {
      appId: appId.substring(0, 10) + "...",
      channelName: normalizedChannelName,
      uid: 0,
      privilegeExpiredTs
    });

    // Generate Agora RTC Token
    // RtcRole.PUBLISHER allows user to publish (send) audio/video
    let token;
    try {
      token = RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        normalizedChannelName,
        0, // uid: 0 means Agora will assign a random UID
        RtcRole.PUBLISHER,
        privilegeExpiredTs
      );
      console.log("✅ Token generated successfully, length:", token?.length || 0);
    } catch (tokenError) {
      console.error("❌ Token generation error:", tokenError);
      console.error("   Error details:", {
        message: tokenError.message,
        stack: tokenError.stack,
        name: tokenError.name
      });
      throw tokenError;
    }

    // Validate token
    if (!token || typeof token !== 'string' || token.trim() === '') {
      console.error("❌ Token generation failed - token is not a string");
      console.error("   Token value:", token);
      console.error("   Token type:", typeof token);
      return res.status(500).json({
        message: "Token generation failed - invalid token format",
        error: "Invalid token"
      });
    }

    console.log("✅ Agora token generated for", normalizedUserId, "channel:", normalizedChannelName, "token length:", token.length);

    // Final response to frontend
    res.status(200).json({
      token: String(token),
      appId: String(appId),
      channelName: String(normalizedChannelName),
      userId: String(normalizedUserId),
      uid: 0, // Agora will assign random UID
    });
  } catch (error) {
    console.error("❌ Error generating Agora token:", error);
    console.error("   Error stack:", error.stack);
    console.error("   Error name:", error.name);
    res.status(500).json({ 
      message: "Failed to generate token",
      error: error.message || "Unknown error"
    });
  }
});

export default router;


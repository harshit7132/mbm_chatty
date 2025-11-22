import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

// Get my avatars
router.get("/my-avatars", protectRoute, async (req, res) => {
  try {
    // Placeholder - implement when Avatar model is created
    res.status(200).json([]);
  } catch (error) {
    console.log("Error in getMyAvatars:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Create avatar
router.post("/create", protectRoute, async (req, res) => {
  try {
    // Placeholder - implement when Avatar model is created
    res.status(201).json({ message: "Avatar created", _id: "placeholder" });
  } catch (error) {
    console.log("Error in createAvatar:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;


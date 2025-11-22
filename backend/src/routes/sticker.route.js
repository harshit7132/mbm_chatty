import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

// Get my stickers
router.get("/my-stickers", protectRoute, async (req, res) => {
  try {
    // Placeholder - implement when Sticker model is created
    res.status(200).json([]);
  } catch (error) {
    console.log("Error in getMyStickers:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Create sticker
router.post("/create", protectRoute, async (req, res) => {
  try {
    // Placeholder - implement when Sticker model is created
    res.status(201).json({ message: "Sticker created", _id: "placeholder" });
  } catch (error) {
    console.log("Error in createSticker:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;


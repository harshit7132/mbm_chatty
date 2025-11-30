import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { refreshDailyChallenges } from "../controllers/challenge.controller.js";

const router = express.Router();

// Refresh daily challenges (costs 4 points)
router.post("/refresh-daily", protectRoute, refreshDailyChallenges);

export default router;

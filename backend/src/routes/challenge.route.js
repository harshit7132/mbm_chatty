import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import Challenge from "../models/challenge.model.js";
import User from "../models/user.model.js";

const router = express.Router();

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

// Get daily challenges
router.get("/daily", protectRoute, async (req, res) => {
  try {
    const challenges = await Challenge.find({
      type: "daily",
      isActive: true,
    })
      .populate("createdBy", "fullName username email")
      .sort({ createdAt: -1 });
    res.status(200).json(challenges);
  } catch (error) {
    console.log("Error in getDailyChallenges:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get my challenges
router.get("/my-challenges", protectRoute, async (req, res) => {
  try {
    const daily = await Challenge.find({
      type: "daily",
      isActive: true,
    })
      .populate("createdBy", "fullName username email")
      .sort({ createdAt: -1 });

    const lifetime = await Challenge.find({
      type: "lifetime",
      isActive: true,
    })
      .populate("createdBy", "fullName username email")
      .sort({ createdAt: -1 });

    res.status(200).json({ daily, lifetime });
  } catch (error) {
    console.log("Error in getMyChallenges:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
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
    const { title, description, type, points, target, category, startDate, endDate } = req.body;

    if (!title || !type || !points || !target) {
      return res.status(400).json({ message: "Title, type, points, and target are required" });
    }

    if (!["daily", "lifetime"].includes(type)) {
      return res.status(400).json({ message: "Type must be 'daily' or 'lifetime'" });
    }

    const challenge = new Challenge({
      title,
      description: description || "",
      type,
      points: Number(points),
      target: Number(target),
      category: category || "custom",
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
      createdBy: req.user._id,
      isActive: true,
    });

    await challenge.save();
    await challenge.populate("createdBy", "fullName username email");

    res.status(201).json(challenge);
  } catch (error) {
    console.log("Error in createChallenge:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Admin: Get all challenges
router.get("/all", protectRoute, isAdmin, async (req, res) => {
  try {
    const challenges = await Challenge.find()
      .populate("createdBy", "fullName username email")
      .sort({ createdAt: -1 });
    res.status(200).json(challenges);
  } catch (error) {
    console.log("Error in getAllChallenges:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Admin: Update challenge
router.put("/:challengeId", protectRoute, isAdmin, async (req, res) => {
  try {
    const { title, description, type, points, target, category, isActive, startDate, endDate } = req.body;
    const challenge = await Challenge.findById(req.params.challengeId);

    if (!challenge) {
      return res.status(404).json({ message: "Challenge not found" });
    }

    if (title) challenge.title = title;
    if (description !== undefined) challenge.description = description;
    if (type) challenge.type = type;
    if (points !== undefined) challenge.points = Number(points);
    if (target !== undefined) challenge.target = Number(target);
    if (category) challenge.category = category;
    if (isActive !== undefined) challenge.isActive = isActive;
    if (startDate) challenge.startDate = new Date(startDate);
    if (endDate !== undefined) challenge.endDate = endDate ? new Date(endDate) : null;

    await challenge.save();
    await challenge.populate("createdBy", "fullName username email");

    res.status(200).json(challenge);
  } catch (error) {
    console.log("Error in updateChallenge:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Admin: Delete challenge
router.delete("/:challengeId", protectRoute, isAdmin, async (req, res) => {
  try {
    const challenge = await Challenge.findById(req.params.challengeId);

    if (!challenge) {
      return res.status(404).json({ message: "Challenge not found" });
    }

    await Challenge.findByIdAndDelete(req.params.challengeId);
    res.status(200).json({ message: "Challenge deleted successfully" });
  } catch (error) {
    console.log("Error in deleteChallenge:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

export default router;


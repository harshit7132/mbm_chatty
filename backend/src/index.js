import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";

import path from "path";

import { connectDB } from "./lib/db.js";

import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import chatRoutes from "./routes/chat.route.js";
import pointsRoutes from "./routes/points.route.js";
import leaderboardRoutes from "./routes/leaderboard.route.js";
import groupRoutes from "./routes/group.route.js";
import challengeRoutes from "./routes/challenge.route.js";
import stickerRoutes from "./routes/sticker.route.js";
import avatarRoutes from "./routes/avatar.route.js";
import adminRoutes from "./routes/admin.route.js";
import aiRoutes from "./routes/ai.route.js";
import callRoutes from "./routes/call.route.js";
import friendRoutes from "./routes/friend.route.js";
import agoraRoutes from "./routes/agora.route.js";
import { app, server } from "./lib/socket.js";

dotenv.config();

const PORT = process.env.PORT;
const __dirname = path.resolve();

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: ["http://localhost:5173", "https://localhost:5173"],
    credentials: true,
  })
);

// Disable caching for API routes
app.use("/api", (req, res, next) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
    "Surrogate-Control": "no-store"
  });
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/points", pointsRoutes);
app.use("/api/leaderboard", leaderboardRoutes);
app.use("/api/group", groupRoutes);
app.use("/api/challenge", challengeRoutes);
app.use("/api/sticker", stickerRoutes);
app.use("/api/avatar", avatarRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/call", callRoutes);
app.use("/api/friend", friendRoutes);
app.use("/api/agora", agoraRoutes);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

server.listen(PORT, () => {
  console.log("server is running on PORT:" + PORT);
  connectDB();
});

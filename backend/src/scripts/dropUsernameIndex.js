import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/user.model.js";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function dropUsernameIndex() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    // Drop the existing username_1 index
    const collection = mongoose.connection.collection("users");
    const indexes = await collection.indexes();
    
    console.log("Current indexes:", indexes.map(idx => idx.name));
    
    // Check if username_1 index exists
    const usernameIndex = indexes.find(idx => idx.name === "username_1");
    
    if (usernameIndex) {
      await collection.dropIndex("username_1");
      console.log("✅ Dropped username_1 index");
    } else {
      console.log("ℹ️ username_1 index not found");
    }

    // The new sparse unique index will be created automatically when the model is used
    console.log("✅ Done! The new sparse unique index will be created on next user creation.");
    
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

dropUsernameIndex();


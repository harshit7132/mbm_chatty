import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Support both 'fullName' and 'username' for backward compatibility
    fullName: {
      type: String,
      trim: true,
    },
    username: {
      type: String,
      trim: true,
      // Removed unique constraint - username is optional and doesn't need to be unique
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    // Support both 'profilePic' and 'avatar' for backward compatibility
    profilePic: {
      type: String,
      default: "",
    },
    avatar: {
      type: String,
      default: "",
    },
    // Points system - support both 'points' and 'totalPoints'
    points: {
      type: Number,
      default: 0,
    },
    totalPoints: {
      type: Number,
      default: 0,
    },
    pointsSpent: {
      type: Number,
      default: 0,
    },
    pointsHistory: [
      {
        type: {
          type: String,
          enum: ["earned", "spent", "time-based", "challenge", "chat"],
        },
        amount: Number,
        description: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Badges system
    badges: [
      {
        type: String,
      },
    ],
    earlyUserBadge: {
      type: String,
    },
    // Chat statistics - support both 'chatCount' and 'totalChats'
    chatCount: {
      type: Number,
      default: 0,
    },
    totalChats: {
      type: Number,
      default: 0,
    },
    timeSpent: {
      type: Number,
      default: 0,
    },
    // Admin role
    isAdmin: {
      type: Boolean,
      default: false,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
    },
    // Friends list - users who have chatted with each other
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Friend requests - pending friend requests
    friendRequests: [
      {
        from: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        status: {
          type: String,
          enum: ["pending", "accepted", "rejected"],
          default: "pending",
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Sent friend requests
    sentFriendRequests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

// Virtual to get display name (fullName or username)
userSchema.virtual("displayName").get(function () {
  return this.fullName || this.username || this.email?.split("@")[0] || "User";
});

// Virtual to get profile picture (profilePic or avatar)
userSchema.virtual("displayPic").get(function () {
  return this.profilePic || this.avatar || "";
});

// Virtual to get points (points or totalPoints)
userSchema.virtual("displayPoints").get(function () {
  return this.points || this.totalPoints || 0;
});

// Virtual to get chat count (chatCount or totalChats)
userSchema.virtual("displayChatCount").get(function () {
  return this.chatCount || this.totalChats || 0;
});

// Ensure virtuals are included in JSON
userSchema.set("toJSON", { virtuals: true });
userSchema.set("toObject", { virtuals: true });

const User = mongoose.model("User", userSchema);

export default User;

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
          enum: ["earned", "spent", "time-based", "challenge", "chat", "challenge_attempt"],
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
    // AI Chat free messages tracking
    freeAIMessagesUsed: {
      type: Number,
      default: 0,
    },
    // Daily login and engagement tracking
    loginStreak: {
      type: Number,
      default: 0,
    },
    lastLoginDate: {
      type: Date,
      default: null,
    },
    totalLogins: {
      type: Number,
      default: 0,
    },
    consecutiveDaysActive: {
      type: Number,
      default: 0,
    },
    lastStreakRewardMilestone: {
      type: Number,
      default: 0, // Last milestone (5, 10, 15, etc.) for which user received reward
    },
    // Daily activity tracking - track which dates user was active (logged in or used app for 5+ min)
    dailyActivity: [
      {
        date: {
          type: Date,
          required: true,
        },
        loginTime: {
          type: Date,
          default: Date.now,
        },
        activeMinutes: {
          type: Number,
          default: 0,
        },
        isActive: {
          type: Boolean,
          default: true, // true if user logged in or was active for 5+ minutes
        },
      },
    ],
    // Referral system
    referralCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    referrals: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    referralPoints: {
      type: Number,
      default: 0,
    },
    // Achievement system
    achievements: [
      {
        achievementId: String,
        unlockedAt: {
          type: Date,
          default: Date.now,
        },
        progress: {
          type: Number,
          default: 0,
        },
        completed: {
          type: Boolean,
          default: false,
        },
      },
    ],
    // Activity multipliers (bonus points for activity)
    activityMultiplier: {
      type: Number,
      default: 1.0,
      min: 1.0,
      max: 3.0,
    },
    multiplierExpiresAt: {
      type: Date,
      default: null,
    },
    // Calendar claims - track which dates user has claimed rewards
    calendarClaims: [
      {
        date: {
          type: Date,
          required: true,
        },
        points: {
          type: Number,
          required: true,
        },
        eventId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "CalendarEvent",
        },
        claimedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
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
    // Privacy settings
    privacySettings: {
      // Profile visibility: "public" | "friends" | "private"
      profileVisibility: {
        type: String,
        enum: ["public", "friends", "private"],
        default: "public",
      },
      // Online status visibility: "everyone" | "friends" | "nobody"
      onlineStatusVisibility: {
        type: String,
        enum: ["everyone", "friends", "nobody"],
        default: "everyone",
      },
      // Last seen visibility: "everyone" | "friends" | "nobody"
      lastSeenVisibility: {
        type: String,
        enum: ["everyone", "friends", "nobody"],
        default: "everyone",
      },
      // Friend request privacy: "everyone" | "friends_of_friends" | "nobody"
      friendRequestPrivacy: {
        type: String,
        enum: ["everyone", "friends_of_friends", "nobody"],
        default: "everyone",
      },
      // Show in search: true | false
      showInSearch: {
        type: Boolean,
        default: true,
      },
      // Show in leaderboard: true | false
      showInLeaderboard: {
        type: Boolean,
        default: true,
      },
      // Show points publicly: true | false
      showPoints: {
        type: Boolean,
        default: true,
      },
      // Read receipts: true | false
      readReceipts: {
        type: Boolean,
        default: true,
      },
    },
    // Blocked users list
    blockedUsers: [
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

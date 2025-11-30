# Privacy Features for Chatty App

## 🔒 Comprehensive Privacy System

This document outlines all privacy features implemented to protect user data and control visibility.

## 📋 Privacy Settings Available

### 1. **Profile Visibility** (`profileVisibility`)
- **Options:**
  - `"public"` - Everyone can see your profile
  - `"friends"` - Only friends can see your profile
  - `"private"` - Profile is hidden from everyone
- **Default:** `"public"`

### 2. **Online Status Visibility** (`onlineStatusVisibility`)
- **Options:**
  - `"everyone"` - Everyone can see when you're online
  - `"friends"` - Only friends can see your online status
  - `"nobody"` - No one can see your online status
- **Default:** `"everyone"`

### 3. **Last Seen Visibility** (`lastSeenVisibility`)
- **Options:**
  - `"everyone"` - Everyone can see when you were last active
  - `"friends"` - Only friends can see your last seen
  - `"nobody"` - No one can see your last seen
- **Default:** `"everyone"`

### 4. **Friend Request Privacy** (`friendRequestPrivacy`)
- **Options:**
  - `"everyone"` - Anyone can send you friend requests
  - `"friends_of_friends"` - Only friends of your friends can send requests
  - `"nobody"` - No one can send you friend requests
- **Default:** `"everyone"`

### 5. **Show in Search** (`showInSearch`)
- **Options:**
  - `true` - Your profile appears in user search
  - `false` - Your profile is hidden from search
- **Default:** `true`

### 6. **Show in Leaderboard** (`showInLeaderboard`)
- **Options:**
  - `true` - Your stats appear in leaderboards
  - `false` - You're hidden from leaderboards
- **Default:** `true`

### 7. **Show Points** (`showPoints`)
- **Options:**
  - `true` - Your points are visible to others
  - `false` - Your points are hidden
- **Default:** `true`

### 8. **Read Receipts** (`readReceipts`)
- **Options:**
  - `true` - Others can see when you read their messages
  - `false` - Read receipts are disabled
- **Default:** `true`

## 🚫 Block User Feature

### Block a User
- Prevents blocked users from:
  - Sending you messages
  - Seeing your online status
  - Sending friend requests
  - Viewing your profile (if privacy allows)
- Automatically removes from friends list
- Removes pending friend requests

### Unblock a User
- Restores normal interaction (subject to privacy settings)

## 📡 API Endpoints

### Get Privacy Settings
```
GET /api/privacy/settings
Authorization: Bearer <token>
Response: { privacySettings: {...} }
```

### Update Privacy Settings
```
PUT /api/privacy/settings
Authorization: Bearer <token>
Body: {
  profileVisibility?: "public" | "friends" | "private",
  onlineStatusVisibility?: "everyone" | "friends" | "nobody",
  lastSeenVisibility?: "everyone" | "friends" | "nobody",
  friendRequestPrivacy?: "everyone" | "friends_of_friends" | "nobody",
  showInSearch?: boolean,
  showInLeaderboard?: boolean,
  showPoints?: boolean,
  readReceipts?: boolean
}
```

### Block User
```
POST /api/privacy/block/:userId
Authorization: Bearer <token>
Response: { message: "User blocked successfully" }
```

### Unblock User
```
POST /api/privacy/unblock/:userId
Authorization: Bearer <token>
Response: { message: "User unblocked successfully" }
```

### Get Blocked Users
```
GET /api/privacy/blocked
Authorization: Bearer <token>
Response: { blockedUsers: [...] }
```

## 🛡️ Privacy Enforcement

### Where Privacy is Enforced:

1. **User Search** - Respects `showInSearch` setting
2. **Leaderboard** - Respects `showInLeaderboard` setting
3. **Profile Viewing** - Respects `profileVisibility` setting
4. **Online Status** - Respects `onlineStatusVisibility` setting
5. **Last Seen** - Respects `lastSeenVisibility` setting
6. **Friend Requests** - Respects `friendRequestPrivacy` setting
7. **Points Display** - Respects `showPoints` setting
8. **Messages** - Blocked users cannot send messages
9. **Read Receipts** - Respects `readReceipts` setting

## 💾 Database Schema

Privacy settings are stored in MongoDB in the `User` model:

```javascript
privacySettings: {
  profileVisibility: String,
  onlineStatusVisibility: String,
  lastSeenVisibility: String,
  friendRequestPrivacy: String,
  showInSearch: Boolean,
  showInLeaderboard: Boolean,
  showPoints: Boolean,
  readReceipts: Boolean
},
blockedUsers: [ObjectId] // Array of blocked user IDs
```

## 🎯 Next Steps for Frontend

1. Create Privacy Settings UI component
2. Add privacy settings to Settings page
3. Add block/unblock buttons to user profiles
4. Update user search to respect privacy
5. Update leaderboard to respect privacy
6. Update online status display logic
7. Update last seen display logic
8. Add blocked users management page

## 🔐 Security Notes

- All privacy endpoints require authentication
- Users cannot block themselves
- Privacy settings are validated on the backend
- Blocked users are filtered from all queries
- Privacy settings default to most permissive (public) for better UX


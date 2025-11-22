# Data Setup Guide

## Current Status

The application is working correctly, but you need data in your database to see information displayed.

## What You Need:

### 1. **Users**
- Currently, if you're the only user, the users list will be empty (it excludes yourself)
- **Solution**: Create additional test users by:
  - Signing up with different email addresses
  - Or manually adding users to MongoDB

### 2. **Messages**
- Messages will appear once you start chatting with other users
- The chat functionality is working - just needs users to chat with

### 3. **Leaderboard**
- Will show data once users have:
  - Points (earned from activities)
  - Badges (earned from challenges)
  - Chat count (from sending messages)
- Currently returns empty if no users have these values

### 4. **Challenges & Groups**
- These are placeholder routes (returning empty arrays)
- Full implementation requires Challenge and Group models to be created
- This is expected behavior for now

## Quick Test:

1. **Create a second user account:**
   - Sign up with a different email
   - Log in with that account
   - You should now see the first user in your contacts

2. **Send a message:**
   - Select a user from the sidebar
   - Send a message
   - Messages should appear

3. **Check Leaderboard:**
   - Once users have points/badges, they'll appear in leaderboards
   - You can manually add points in MongoDB or wait for the points system to award them

## Database Structure:

Your MongoDB database should have these collections:
- `users` - User accounts
- `messages` - Chat messages
- `otps` - OTP codes (auto-expire)

## Next Steps:

1. Create test users
2. Send some messages
3. The UI will populate as data is added


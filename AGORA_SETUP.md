# Agora Video/Voice Call Setup

This guide explains how to configure Agora for video and voice calling in your application.

## Prerequisites

1. **Agora Account**: Sign up at https://www.agora.io/
2. **Get App Credentials**: 
   - Create a project in Agora Console
   - Get your `App ID` and `App Certificate`

## Environment Variables

### Backend (.env)

Add these variables to your `backend/.env` file:

```env
AGORA_APP_ID=cd40a19094fb4d2bb271ba29dbd6b0c7
AGORA_APP_CERTIFICATE=87db66a375924c2c97abf45c451a1412
```

**Your Agora Credentials:**
- App ID: `cd40a19094fb4d2bb271ba29dbd6b0c7`
- Primary Certificate: `87db66a375924c2c97abf45c451a1412`

**Important**: Keep your App Certificate secret and never expose it in the frontend!

## What Has Been Changed

1. ✅ **Packages Installed:**
   - `agora-rtc-sdk-ng` in frontend (for RTC client)
   - `agora-token` in backend (for token generation)

2. ✅ **Backend Route Created:**
   - `backend/src/routes/agora.route.js` - Token generation endpoint
   - Route: `/api/agora/generate-token`

3. ✅ **VideoCall Component Replaced:**
   - Removed all ZegoCloud code
   - New Agora RTC implementation
   - Supports both video and voice calls

4. ✅ **Route Registered:**
   - `/api/agora/generate-token` endpoint added to backend

5. ✅ **ZegoCloud Completely Removed:**
   - Removed ZegoCloud packages from frontend and backend
   - Removed ZegoCloud script from index.html
   - Removed ZegoCloud route (`zego.route.js`)
   - Removed ZegoCloud token library (`zegoToken.js`)
   - Deleted ZegoCloud SDK files (`frontend/src/dist_js/`)
   - Deleted ZegoCloud documentation files
   - Removed all ZegoCloud references from codebase

## How It Works

1. When a call is initiated, the frontend requests a token from `/api/agora/generate-token`
2. The backend generates a secure token using Agora's token builder
3. The frontend initializes Agora RTC client with the App ID and token
4. Both users join the same channel (channel name is based on user IDs)
5. Agora handles all WebRTC signaling, NAT traversal, and media streaming

## Testing

1. Make sure environment variables are set in `backend/.env`
2. Start backend server: `cd backend && npm run dev`
3. Start frontend server: `cd frontend && npm run dev`
4. Test video/voice calls between two users
5. Check browser console for any errors

## Features

- ✅ Video and voice calls
- ✅ Mute/unmute microphone
- ✅ Turn camera on/off (video calls)
- ✅ Automatic call ending when one user ends
- ✅ Clean resource cleanup
- ✅ Error handling with user-friendly messages

## Troubleshooting

1. **Token Generation Issues**: Ensure `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE` are correct
2. **Connection Issues**: Check Agora console for service status
3. **Video Not Showing**: Ensure camera/microphone permissions are granted
4. **Channel Name Conflicts**: Ensure unique channel names for each call

## Additional Resources

- [Agora Web SDK Docs](https://docs.agora.io/en/video-calling/get-started/get-started-sdk?platform=web)
- [Agora Console](https://console.agora.io/)
- [Agora Token Guide](https://docs.agora.io/en/video-calling/develop/integrate-token-generation)


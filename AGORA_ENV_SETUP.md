# Agora Environment Variables Setup

## ⚠️ IMPORTANT: Add These to `backend/.env`

The backend needs these environment variables to generate Agora tokens. Add them to your `backend/.env` file:

```env
# Agora Configuration
AGORA_APP_ID=cd40a19094fb4d2bb271ba29dbd6b0c7
AGORA_APP_CERTIFICATE=87db66a375924c2c97abf45c451a1412
```

## Steps to Fix the 500 Error

1. **Open or create `backend/.env` file**
   - If the file doesn't exist, create it in the `backend` folder

2. **Add the Agora variables:**
   ```env
   AGORA_APP_ID=cd40a19094fb4d2bb271ba29dbd6b0c7
   AGORA_APP_CERTIFICATE=87db66a375924c2c97abf45c451a1412
   ```

3. **Make sure your existing variables are still there:**
   ```env
   PORT=5001
   MONGODB_URI=your_mongodb_uri
   JWT_SECRET=your_jwt_secret
   # ... other existing variables
   ```

4. **Restart your backend server:**
   ```bash
   cd backend
   npm run dev
   ```

## Your Agora Credentials

- **App ID**: `cd40a19094fb4d2bb271ba29dbd6b0c7`
- **Primary Certificate**: `87db66a375924c2c97abf45c451a1412`

**Note**: Keep your App Certificate secret and never commit it to version control!

## Verify It's Working

After adding the variables and restarting, you should see:
- ✅ No more "❌ Missing Agora env variables" errors in backend logs
- ✅ Token generation should work when making a call


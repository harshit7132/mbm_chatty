# 📦 Complete Installation Guide - Chatty App

## Step-by-Step Setup Instructions

### Prerequisites
- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **MongoDB** (Local or Atlas) - [Download here](https://www.mongodb.com/try/download/community) or use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- **Git** (if cloning from repository)

---

## 🚀 Installation Steps

### Step 1: Check Node.js Installation
```bash
node --version
npm --version
```
**Expected output:** Node.js v18+ and npm v9+

If not installed, download from [nodejs.org](https://nodejs.org/)

---

### Step 2: Navigate to Project Directory
```bash
cd ChatiyApp-main
```
*(Or wherever you extracted/cloned the project)*

---

### Step 3: Install Backend Dependencies
```bash
cd backend
npm install
```
**Wait for installation to complete** (this may take 2-5 minutes)

---

### Step 4: Create Backend Environment File
```bash
# Create .env file in backend folder
# On Windows (PowerShell):
New-Item -Path .env -ItemType File

# On Mac/Linux:
touch .env
```

---

### Step 5: Configure Backend Environment Variables

Open `backend/.env` file and add these variables:

```env
# Server Configuration
PORT=5001

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/chatty_app
# OR if using MongoDB Atlas:
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/chatty_app?retryWrites=true&w=majority

# JWT Secret (generate a random string)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-12345

# Agora Video Calling (Required for video/voice calls)
AGORA_APP_ID=cd40a19094fb4d2bb271ba29dbd6b0c7
AGORA_APP_CERTIFICATE=87db66a375924c2c97abf45c451a1412

# Brevo Email Service (For OTP emails - Optional but recommended)
BREVO_API_KEY=your-brevo-api-key-here
BREVO_SENDER_EMAIL=noreply@yourdomain.com

# Cloudinary (For image uploads - Optional)
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret

# OpenAI (For AI chat feature - Optional)
OPENAI_API_KEY=your-openai-api-key-here
```

**⚠️ Important:** Replace placeholder values with your actual credentials!

---

### Step 6: Install Frontend Dependencies
```bash
cd ../frontend
npm install
```
**Wait for installation to complete** (this may take 3-5 minutes)

---

### Step 7: Start MongoDB

#### Option A: Local MongoDB
```bash
# Windows: Start MongoDB service
# Usually runs automatically, or start from Services

# Mac/Linux:
mongod
```

#### Option B: MongoDB Atlas (Cloud)
- No local setup needed
- Just use your Atlas connection string in `.env`

**Verify MongoDB is running:**
- Open [MongoDB Compass](https://www.mongodb.com/products/compass) and connect
- Or check: `mongosh` command should work

---

### Step 8: Start Backend Server

Open a **new terminal window** and run:
```bash
cd backend
npm run dev
```

**Expected output:**
```
✅ Server is running on PORT: 5001
✅ MongoDB connected: localhost:27017
```

**Keep this terminal open!** The backend must stay running.

---

### Step 9: Start Frontend Server

Open **another new terminal window** and run:
```bash
cd frontend
npm run dev
```

**Expected output:**
```
  VITE v7.x.x  ready in xxx ms

  ➜  Local:   https://localhost:5173/
  ➜  Network: use --host to expose
```

**Keep this terminal open too!**

---

### Step 10: Open the Application

Open your browser and go to:
```
https://localhost:5173
```

**Note:** You may see a security warning because it's using HTTPS locally. Click "Advanced" → "Proceed to localhost" (this is safe for local development).

---

## ✅ Verification Checklist

After installation, verify:

- [ ] Backend server running on port 5001
- [ ] Frontend server running on port 5173
- [ ] MongoDB connected (check backend console)
- [ ] Can access `https://localhost:5173` in browser
- [ ] Can see the login/signup page
- [ ] No errors in browser console (F12)

---

## 🎯 Quick Test

1. **Register a new account** on the app
2. **Check MongoDB Compass** → `chatty_app` → `users` collection
3. **You should see your new user!** ✅

---

## 📝 Common Commands Reference

### Start Backend
```bash
cd backend
npm run dev
```

### Start Frontend
```bash
cd frontend
npm run dev
```

### Install Dependencies (if needed)
```bash
# Backend
cd backend
npm install

# Frontend
cd frontend
npm install
```

---

## ⚠️ Troubleshooting

### "Port 5001 already in use"
```bash
# Windows: Find and kill process
netstat -ano | findstr :5001
taskkill /PID <PID> /F

# Mac/Linux:
lsof -ti:5001 | xargs kill
```

### "MongoDB connection error"
- ✅ Check MongoDB is running
- ✅ Verify `MONGODB_URI` in `.env` is correct
- ✅ For Atlas: Check IP whitelist and credentials

### "Module not found" errors
```bash
# Reinstall dependencies
cd backend && npm install
cd ../frontend && npm install
```

### "HTTPS certificate error"
- This is normal for local development
- Click "Advanced" → "Proceed to localhost"

### "AGORA_APP_ID missing" error
- Make sure you added Agora credentials to `backend/.env`
- Restart the backend server after adding env variables

---

## 🔧 Optional: Making Yourself Admin

1. **Register and login** to the app
2. **Open MongoDB Compass**
3. **Connect** to your database
4. **Select** `chatty_app` database
5. **Open** `users` collection
6. **Find** your user (by email)
7. **Edit** the document: Add `"isAdmin": true`
8. **Save** the document
9. **Logout and login** again
10. **Admin panel** will be accessible! 🎉

---

## 📚 Additional Resources

- **MongoDB Setup:** See `MONGODB_CONNECTION_GUIDE.md`
- **Agora Setup:** See `AGORA_SETUP.md`
- **Brevo Email Setup:** See `backend/BREVO_SETUP.md`
- **Quick Start:** See `QUICK_START.md`

---

## 🎉 You're All Set!

Your Chatty App should now be running! 

- **Frontend:** https://localhost:5173
- **Backend API:** http://localhost:5001
- **MongoDB:** Running locally or on Atlas

Happy coding! 🚀


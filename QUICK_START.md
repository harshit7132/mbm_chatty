# Quick Start Guide - Chatty App

## 🚀 Running the Application

### 1. Install Dependencies
```bash
# Frontend
cd frontend
npm install

# Backend (if you have it)
cd ../backend
npm install
```

### 2. Start Backend (Port 5001)
```bash
cd backend
npm run dev
```

### 3. Start Frontend (Port 5173)
```bash
cd frontend
npm run dev
```

### 4. Open Browser
```
http://localhost:5173
```

---

## 🔐 How to Access Admin Panel

### Method 1: Using MongoDB Compass (Easiest)

1. **Open MongoDB Compass**
2. **Connect** to your database (usually `mongodb://localhost:27017`)
3. **Select** the `chatty_app` database (or your database name)
4. **Open** the `users` collection
5. **Find** your user by email
6. **Edit** the document:
   - Add or change: `"isAdmin": true`
7. **Save** the document
8. **Logout and Login** again in the app
9. **Click the Shield icon** (🛡️) in the navbar to access Admin Panel

### Method 2: Using MongoDB Shell

```bash
# Open MongoDB shell
mongosh

# Switch to your database
use chatty_app

# Make user admin
db.users.updateOne(
  { email: "your-email@example.com" },
  { $set: { isAdmin: true } }
)

# Verify
db.users.findOne({ email: "your-email@example.com" })
```

### Method 3: If You're Already an Admin

1. Go to Admin Panel (`/admin`)
2. Find the user in the table
3. Click **"Make Admin"** button

---

## 📍 Admin Panel Access

**URL:** `http://localhost:5173/admin`

**Requirements:**
- ✅ Must be logged in
- ✅ User must have `isAdmin: true` in database

**Features:**
- 📊 Dashboard statistics
- 👥 View all users
- ⬆️ Promote users to admin
- 🗑️ Delete users

---

## 🎯 Quick Test Checklist

- [ ] Backend running on port 5001
- [ ] Frontend running on port 5173
- [ ] MongoDB connected
- [ ] User registered and logged in
- [ ] User has `isAdmin: true` in database
- [ ] Shield icon visible in navbar
- [ ] Can access `/admin` route

---

## ⚠️ Troubleshooting

**"Access Denied" message:**
- Check `isAdmin: true` in MongoDB
- Logout and login again
- Clear browser cache

**Admin button not showing:**
- Verify user is logged in
- Check `authUser.isAdmin` in browser console
- Ensure database update was saved

**Backend connection error:**
- Check backend is running on port 5001
- Verify MongoDB is running
- Check `.env` file configuration


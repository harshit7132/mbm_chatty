# How to Run the Application and Access Admin Panel

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or MongoDB Atlas)
- npm or yarn

## Step 1: Install Dependencies

### Frontend
```bash
cd frontend
npm install
```

### Backend (if you have backend folder)
```bash
cd backend
npm install
```

## Step 2: Set Up Environment Variables

### Backend `.env` file
Create a `.env` file in the `backend` folder:
```env
PORT=5001
MONGODB_URI=mongodb://localhost:27017/chatty_app
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
OPENAI_API_KEY=your-openai-api-key-here
```

### Frontend
The frontend is configured to connect to `http://localhost:5001` in development mode.

## Step 3: Start MongoDB

Make sure MongoDB is running:
```bash
# If using local MongoDB
mongod

# Or use MongoDB Compass to connect
```

## Step 4: Start the Backend Server

```bash
cd backend
npm run dev
```

The backend should start on `http://localhost:5001`

## Step 5: Start the Frontend

```bash
cd frontend
npm run dev
```

The frontend should start on `http://localhost:5173`

## Step 6: Access the Application

Open your browser and navigate to:
```
http://localhost:5173
```

## How to Access Admin Panel

### Option 1: Make Yourself Admin via MongoDB

1. **Using MongoDB Compass:**
   - Connect to your MongoDB database
   - Navigate to the `users` collection
   - Find your user document
   - Edit the document and set `isAdmin: true`
   - Save the changes

2. **Using MongoDB Shell:**
   ```bash
   mongosh
   use chatty_app
   db.users.updateOne(
     { email: "your-email@example.com" },
     { $set: { isAdmin: true } }
   )
   ```

3. **Using the Admin API (if you're already an admin):**
   - Go to Admin Panel
   - Find the user you want to make admin
   - Click "Make Admin" button

### Option 2: Create Admin User via Backend Seed Script

If you have a seed script, you can create an admin user directly:

```javascript
// Example seed script
const adminUser = {
  fullName: "Admin User",
  email: "admin@example.com",
  password: "hashedPassword",
  isAdmin: true
};
```

### Accessing the Admin Panel

Once you have admin privileges:

1. **Login** to the application with your admin account
2. **Click the "Admin" button** in the navbar (Shield icon)
   - Or navigate directly to: `http://localhost:5173/admin`
3. You'll see the **Admin Dashboard** with:
   - Total Users count
   - Total Messages count
   - Total Admins count
   - User management table

### Admin Panel Features

- **View Dashboard Stats**: See total users, messages, and admins
- **View All Users**: See a list of all registered users
- **Make Users Admin**: Promote any user to admin role
- **Delete Users**: Remove users from the system (except yourself)

### Troubleshooting

**If you see "Access Denied" when accessing `/admin`:**
- Make sure your user has `isAdmin: true` in the database
- Logout and login again to refresh your session
- Check the browser console for any errors

**If the backend is not running:**
- Make sure MongoDB is running
- Check that the PORT in `.env` matches the frontend configuration
- Verify all environment variables are set correctly

**If you can't see the Admin button in navbar:**
- Make sure you're logged in
- Verify your user has `isAdmin: true` in the database
- Clear browser cache and refresh

## Quick Test

1. Register a new user
2. Make that user admin via MongoDB
3. Logout and login again
4. You should see the Admin button (Shield icon) in the navbar
5. Click it to access the Admin Panel


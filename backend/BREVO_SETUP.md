# Brevo (Sendinblue) Setup Guide

## ✅ Yes! OTP emails are handled by Brevo

The backend implementation uses **Brevo** (formerly Sendinblue) to send OTP emails.

## 📦 Installation

Install the Brevo SDK:

```bash
cd backend
npm install @getbrevo/brevo
```

## 🔑 Get Your Brevo API Key

1. **Sign up/Login** to [Brevo](https://www.brevo.com/)
2. Go to **Settings** → **SMTP & API**
3. Click on **API Keys** tab
4. Create a new API key or use existing one
5. Copy your API key

## ⚙️ Environment Variables

Add these to your `backend/.env` file:

```env
# Brevo Configuration
BREVO_API_KEY=your-brevo-api-key-here
BREVO_SENDER_EMAIL=noreply@yourdomain.com

# Other existing variables
PORT=5001
MONGODB_URI=mongodb://localhost:27017/chatty_app
JWT_SECRET=your-jwt-secret
```

## 📧 Sender Email Setup

1. In Brevo dashboard, go to **Settings** → **Senders**
2. Add and verify your sender email address
3. Use this email in `BREVO_SENDER_EMAIL`

**Note:** For testing, you can use the default sender email provided by Brevo, but for production, you should verify your own domain.

## 🎯 Features Implemented

### 1. Send OTP Email
- **Endpoint**: `POST /api/auth/send-otp`
- **Body**: `{ email: "user@example.com" }`
- Sends a beautifully formatted HTML email with 6-digit OTP
- OTP expires in 10 minutes

### 2. Verify OTP
- **Endpoint**: `POST /api/auth/verify-otp`
- **Body**: `{ email: "user@example.com", otp: "123456" }`
- Verifies the OTP before allowing signup/login

### 3. Login with OTP
- **Endpoint**: `POST /api/auth/login-otp`
- **Body**: `{ email: "user@example.com", otp: "123456" }`
- Allows passwordless login

### 4. Welcome Email
- Automatically sent when user signs up
- Beautiful HTML template

## 📝 Email Templates

The emails are sent with:
- **HTML formatting** with styled templates
- **Responsive design** that works on all devices
- **Brand colors** matching your app theme
- **Clear call-to-action**

## 🔒 Security Features

- OTP expires in **10 minutes**
- Maximum **5 verification attempts**
- OTPs are **auto-deleted** after expiration
- One OTP per email (new OTP invalidates old one)

## 🧪 Testing

1. Make sure Brevo API key is set in `.env`
2. Start your backend server
3. Test the OTP flow:
   ```bash
   # Send OTP
   curl -X POST http://localhost:5001/api/auth/send-otp \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com"}'
   
   # Verify OTP (use the OTP from your email)
   curl -X POST http://localhost:5001/api/auth/verify-otp \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","otp":"123456"}'
   ```

## 📊 Brevo Dashboard

Monitor your emails in Brevo dashboard:
- **Statistics**: See delivery rates, opens, clicks
- **Logs**: View all sent emails
- **Analytics**: Track email performance

## 💰 Brevo Pricing

- **Free tier**: 300 emails/day
- Perfect for development and small apps
- Upgrade for higher limits

## 🚀 Production Tips

1. **Verify your domain** in Brevo for better deliverability
2. **Set up SPF/DKIM records** for your domain
3. **Monitor bounce rates** in Brevo dashboard
4. **Use transactional templates** for better organization
5. **Set up webhooks** for delivery status (optional)

## ⚠️ Troubleshooting

**Emails not sending?**
- Check API key is correct
- Verify sender email is verified in Brevo
- Check Brevo dashboard for error logs
- Ensure you haven't exceeded daily limit

**OTP not received?**
- Check spam folder
- Verify email address is correct
- Check Brevo dashboard for delivery status
- Ensure backend is running and connected

## 📚 Files Created

- `backend/src/lib/email.js` - Brevo email service
- `backend/src/models/otp.model.js` - OTP database model
- Updated `backend/src/controllers/auth.controller.js` - OTP controllers
- Updated `backend/src/routes/auth.route.js` - OTP routes

All set! Your OTP emails are now powered by Brevo! 🎉


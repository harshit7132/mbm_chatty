# HTTPS Setup for Camera/Microphone Access

## Why HTTPS is Required

Modern browsers require a **secure context** (HTTPS) to access camera and microphone for security reasons. This is a browser security feature that cannot be bypassed.

## Development Setup

The frontend is now configured to use HTTPS **ONLY** in development mode using `@vitejs/plugin-basic-ssl`. When you run `npm run dev`, Vite will:

1. **Automatically generate self-signed certificates** for HTTPS using the basic-ssl plugin
2. Start the dev server on `https://localhost:5173` **ONLY** (HTTP is disabled)
3. Certificates are stored in `node_modules/.vite-plugin-basic-ssl/`

⚠️ **IMPORTANT:** You **MUST** use `https://localhost:5173` - `http://localhost:5173` will **NOT** work and will show an error.

## First Time Setup

1. **Start the frontend:**
   ```bash
   cd frontend
   npm run dev
   ```

2. **Accept the browser security warning:**
   - When you first visit `https://localhost:5173`, your browser will show a warning about the self-signed certificate
   - This is **normal and safe** for local development
   - Click "Advanced" → "Proceed to localhost (unsafe)" or similar option
   - The exact wording varies by browser:
     - **Chrome/Edge:** "Advanced" → "Proceed to localhost (unsafe)"
     - **Firefox:** "Advanced" → "Accept the Risk and Continue"
     - **Safari:** "Show Details" → "visit this website"

3. **Backend remains on HTTP:**
   - The backend can stay on `http://localhost:5001`
   - Vite proxy forwards `/api` requests to the backend (avoids mixed content issues)
   - Socket.io connections go directly to `http://localhost:5001` (WebSocket connections are allowed from HTTPS to HTTP on localhost)
   - CORS is already configured to allow this

## Troubleshooting

### ERR_SSL_VERSION_OR_CIPHER_MISMATCH Error

If you see this error:
1. **Stop the dev server** (Ctrl+C)
2. **Delete the certificate cache:**
   ```bash
   # Windows PowerShell
   Remove-Item -Recurse -Force node_modules\.vite-plugin-basic-ssl
   
   # Or manually delete: frontend/node_modules/.vite-plugin-basic-ssl/
   ```
3. **Restart the dev server:**
   ```bash
   npm run dev
   ```
4. **Clear browser cache** and try again

### ERR_EMPTY_RESPONSE or "This page isn't working" Error

If you see this error when accessing `http://localhost:5173`:
- **This is expected!** The server only runs on HTTPS
- **Solution:** Use `https://localhost:5173` instead
- The server does NOT listen on HTTP port - only HTTPS is enabled

### Browser Shows "Not Secure" Warning

**This is NORMAL and EXPECTED!** The browser shows "Not Secure" because:
- The certificate is self-signed (not from a trusted Certificate Authority)
- This is **safe for local development** - your connection is still encrypted with HTTPS
- The app **WILL WORK** despite this warning
- Camera and microphone **WILL WORK** - the secure context is active

**What the warning means:**
- ✅ Your connection IS encrypted (HTTPS)
- ✅ Your data IS secure
- ⚠️ The certificate just isn't from a trusted CA (normal for local dev)

**To verify it's working:**
1. Click the lock/info icon in the address bar
2. You should see "Connection is secure" or "Certificate" info
3. The URL should show `https://` (not `http://`)
4. Camera/microphone permissions should work

**If you want to reduce the warning (optional):**
- You can install the certificate in your system's trusted root store (advanced)
- For development, it's fine to ignore the warning - just proceed
- The warning doesn't affect functionality

### Browser Still Shows "Not Secure" After Accepting Certificate

1. **Make sure you're using `https://` not `http://`**
   - The URL should be: `https://localhost:5173`
   - Not: `http://localhost:5173`
   - HTTP will show `ERR_EMPTY_RESPONSE` or "This page isn't working"

2. **Clear browser cache and reload**

3. **Check browser console for errors**

4. **Try incognito/private mode** to rule out cache issues

### Camera/Microphone Still Not Working

1. **Check browser permissions:**
   - Click the lock/info icon in the address bar
   - Ensure camera and microphone permissions are set to "Allow"

2. **Check if you're on localhost:**
   - The app allows HTTP on `localhost`, `127.0.0.1`, or `[::1]`
   - If accessing via IP address (e.g., `192.168.x.x`), you **must** use HTTPS

3. **Try a different browser:**
   - Some browsers have stricter security policies

## Production

For production, you should:
1. Use a proper SSL certificate (Let's Encrypt, Cloudflare, etc.)
2. Configure your web server (Nginx, Apache, etc.) to serve HTTPS
3. Redirect all HTTP traffic to HTTPS

## How It Works

### API Requests (HTTP)
- Frontend makes requests to `/api/*` (relative URL)
- Vite proxy intercepts these and forwards to `http://localhost:5001/api`
- Browser sees it as same-origin HTTPS request (no mixed content error)

### WebSocket (Socket.io)
- Socket.io connects directly to `http://localhost:5001`
- Browsers allow WebSocket connections from HTTPS to HTTP on localhost
- This is a special exception for localhost

## Alternative: Use HTTP on Localhost Only

If you prefer to keep using HTTP for development:
- The app will work on `http://localhost:5173` (localhost is considered secure)
- But it won't work if you access via IP address like `http://192.168.1.100:5173`
- HTTPS is recommended for consistency and to match production behavior


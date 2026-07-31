# Google OAuth 2.0 Setup Guide

This guide will help you set up Google Authentication for the AI Tourist Assistant application.

## Prerequisites

- Google Account
- MongoDB Atlas account (for production)
- Node.js and npm installed

## Step 1: Create Google OAuth 2.0 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** > **Credentials**
4. Click **+ Create Credentials** > **OAuth client ID**
5. If prompted, configure the OAuth consent screen:
   - Choose **External** user type
   - Fill in required fields (App name, User support email, etc.)
   - Add **Scopes**: `email`, `profile`, `openid`
   - Add test users (your email) for testing
   - Submit for verification (can use test mode during development)

## Step 2: Configure OAuth Client

1. Select **Web application** as application type
2. Name: `AI Tourist Assistant - Web`
3. **Authorized JavaScript origins**:
   - Development: `http://localhost:5173`
   - Production: `https://your-app.vercel.app`
4. **Authorized redirect URIs** (leave empty for Google Identity Services - it doesn't use redirects)
5. Click **Create**
6. Copy the **Client ID** (you'll need this for frontend)

## Step 3: Backend Configuration

### Update Backend `.env` File

Add the following to your backend `.env` file:

```env
# Existing variables
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key

# Google OAuth (optional - verification is done via tokeninfo endpoint)
# No additional backend variables needed for Google OAuth
```

### Backend is Already Configured

The backend already has Google OAuth support:
- `backend/routes/auth.js` - `/api/auth/social` endpoint
- `backend/models/User.js` - User schema with `profilePicture` and `name` fields
- Token verification via Google's tokeninfo endpoint

## Step 4: Frontend Configuration

### Create Frontend `.env` File

Create or update `frontend/.env` file:

```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id_here
```

Replace `your_google_client_id_here` with the Client ID from Step 2.

### Frontend is Already Configured

The frontend already has Google OAuth support:
- `frontend/src/components/LoginRegister.jsx` - Google Sign-In button
- `frontend/src/App.jsx` - Profile picture display in navbar
- Google Identity Services integration

## Step 5: Test the Setup

### Development Testing

1. Start the backend:
```bash
cd backend
npm install
npm run dev
```

2. Start the frontend:
```bash
cd frontend
npm install
npm run dev
```

3. Open `http://localhost:5173/login`
4. Click "Continue with Google" button
5. Sign in with your Google account
6. Verify:
   - Redirect to chatbot dashboard
   - Profile picture displayed in navbar
   - Username shown in navbar
   - Session persists after page refresh

### Production Deployment

For Vercel deployment:

1. Add environment variable in Vercel:
   - Key: `VITE_GOOGLE_CLIENT_ID`
   - Value: Your Google Client ID
   - Environment: Production + Preview + Development

2. Update Google Cloud Console:
   - Add your Vercel domain to Authorized JavaScript origins
   - Example: `https://your-app.vercel.app`

## Step 6: Google Cloud Console Production Setup

When ready for production:

1. Go to OAuth consent screen
2. Change from **Testing** to **Published**
3. Complete verification process:
   - Add privacy policy URL
   - Add terms of service URL
   - Provide app screenshots
   - Complete domain verification

## Features Implemented

### Backend
- ✅ Google ID token verification via tokeninfo endpoint
- ✅ Automatic user creation for new Google users
- ✅ Automatic login for existing Google users
- ✅ Profile picture and name storage
- ✅ JWT token generation after successful authentication
- ✅ User schema with `googleId`, `profilePicture`, and `name` fields

### Frontend
- ✅ Google Sign-In button with dark theme
- ✅ Profile picture display in navbar
- ✅ Persistent login session
- ✅ Secure token storage in localStorage
- ✅ Logout functionality
- ✅ Mobile responsive design

### Security
- ✅ No password storage for Google users
- ✅ Official Google OAuth 2.0 flow
- ✅ Token verification on backend
- ✅ JWT token for session management
- ✅ Protected routes

## Troubleshooting

### "Google token invalid" error
- Verify Client ID is correct in frontend `.env`
- Check that authorized JavaScript origins match your domain
- Ensure Google Cloud Console project is properly configured

### Profile picture not showing
- Check browser console for errors
- Verify Google token includes `picture` field
- Check localStorage for `profilePicture` key

### "Popup blocked" error
- Ensure popups are allowed for your domain
- Check browser popup blocker settings

### CORS issues
- Verify backend is running on correct port (5005)
- Check frontend proxy configuration in `vite.config.js`

## Environment Variables Summary

### Backend (.env)
```env
MONGO_URI=mongodb+srv://...
JWT_SECRET=your_secret_key
```

### Frontend (.env)
```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

## Additional Notes

- Google OAuth uses the Google Identity Services (GIS) library
- No redirect URIs needed for GIS (it uses popup flow)
- Token verification is done server-side via Google's tokeninfo endpoint
- Profile pictures are stored as URLs from Google
- Users can link Google account to existing local account
- Admin users should still use traditional login for security

## Support

For issues with:
- Google Cloud Console: https://cloud.google.com/support
- Google Identity Services: https://developers.google.com/identity/gsi/web
- This application: Check the code comments and documentation

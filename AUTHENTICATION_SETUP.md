# User and Admin Authentication System

This document provides a comprehensive guide to the separate User and Admin authentication system implemented in the AI Tourist Assistant.

## Overview

The application now has completely separate authentication flows for:
- **Regular Users** - Access the AI Chatbot and travel features
- **Administrators** - Access the Admin Dashboard for management

## Authentication Flow

### User Authentication

#### User Login (`/login`)
- **Email & Password login** - Traditional authentication
- **Google OAuth** - "Continue with Google" button
- **Forgot Password** - Link to password reset
- **Sign Up** - Link to registration page

**After successful login:**
- Redirects to AI Chatbot Dashboard (`/`)
- Users can access: Chatbot, Saved Chats, My Trips, Itinerary, Hotels, Transport, Booking, Weather, Maps, Reviews, Voice Assistant
- Users **CANNOT** access Admin Panel

#### User Registration (`/register`)
- Full Name
- Email
- Password (min 8 chars, uppercase, lowercase, number)
- Google OAuth option

#### User Forgot Password (`/forgot-password`)
- Enter email to receive reset link
- Email sent with secure token (valid for 1 hour)
- Reset via `/reset-password/:token`

### Admin Authentication

#### Admin Login (`/admin/login`)
- **Admin Email & Password only** - No social login for security
- Separate from user login for enhanced security
- Validates role = 'admin' before issuing token

**After successful login:**
- Redirects to Admin Dashboard (`/admin/dashboard`)
- Admins can access: User management, Destinations, Hotels, Transport, Bookings, Reviews, Hidden Gems approval, Feedback, Analytics
- Admins **CANNOT** access user features (Chatbot, etc.)

## Security Features

### Backend Security
- **JWT Authentication** - 7-day token expiration
- **Password Hashing** - bcrypt with salt rounds (10)
- **Admin Middleware** - `adminAuth.js` verifies admin role
- **User Middleware** - `auth.js` verifies any authenticated user
- **Role-Based Access Control** - Separate middleware for user vs admin routes
- **Password Reset Tokens** - Secure hashed tokens with expiration
- **Social Login Verification** - Google tokens verified via tokeninfo endpoint

### Frontend Security
- **Protected Routes** - `ProtectedRoute` for general auth
- **Admin Protected Routes** - `AdminProtectedRoute` for admin-only
- **User Protected Routes** - `UserProtectedRoute` for users only (prevents admin access)
- **Role-Based Redirects** - Automatic redirects based on user role
- **Token Storage** - Secure localStorage with role tracking
- **Session Management** - Auth change events for state updates

## User Roles

### User Role (`role: 'user'`)
- Default role for all new registrations
- Can access all travel features
- Cannot access admin dashboard
- Cannot manage other users or system data

### Admin Role (`role: 'admin'`)
- Must be manually assigned in database
- Can access admin dashboard
- Can manage users, destinations, bookings, etc.
- Cannot access user travel features (separated for security)

## API Endpoints

### User Authentication
```
POST /api/auth/register        - User registration
POST /api/auth/login           - User login (email/password)
POST /api/auth/social          - Social login (Google/Apple)
POST /api/auth/forgot-password - Request password reset
POST /api/auth/reset-password/:token - Reset password
GET  /api/auth/me              - Get current user info
```

### Admin Authentication
```
POST /api/auth/admin-login     - Admin login (email/password only)
```

### Admin Routes (Protected)
```
GET    /api/admin/stats              - Dashboard statistics
GET    /api/admin/analytics          - Usage analytics
GET    /api/admin/users              - List all users
DELETE /api/admin/users/:id          - Delete user
PATCH  /api/admin/users/:id/role     - Change user role
GET    /api/admin/bookings           - List all bookings
PATCH  /api/admin/bookings/:id/status - Update booking status
DELETE /api/admin/bookings/:id       - Delete booking
GET    /api/admin/destinations       - List destinations
POST   /api/admin/destinations       - Create destination
PATCH  /api/admin/destinations/:id   - Update destination
DELETE /api/admin/destinations/:id   - Delete destination
GET    /api/admin/reviews            - List reviews
PATCH  /api/admin/reviews/:id/approve - Approve review
DELETE /api/admin/reviews/:id        - Delete review
GET    /api/admin/transports         - List transports
POST   /api/admin/transports         - Create transport
PATCH  /api/admin/transports/:id     - Update transport
DELETE /api/admin/transports/:id     - Delete transport
GET    /api/admin/hidden-gems        - List hidden gems
PATCH  /api/admin/hidden-gems/:id/approve - Approve hidden gem
PATCH  /api/admin/hidden-gems/:id/reject   - Reject hidden gem
DELETE /api/admin/hidden-gems/:id         - Delete hidden gem
GET    /api/admin/recent-activity    - Recent user/bookings activity
```

## Frontend Components

### User Components
- **UserLogin.jsx** - User login page with email/password, Google OAuth, forgot password
- **UserRegister.jsx** - User registration with validation
- **UserForgotPassword.jsx** - Password reset request page

### Admin Components
- **AdminLogin.jsx** - Admin login page (separate, enhanced security)
- **AdminDashboard.jsx** - Main admin dashboard layout
- **AdminOverview.jsx** - Dashboard overview with stats
- **AdminUsers.jsx** - User management
- **AdminDestinations.jsx** - Destination management
- **AdminBookings.jsx** - Booking management
- **AdminReviews.jsx** - Review moderation
- **AdminTransport.jsx** - Transport management
- **AdminHiddenGems.jsx** - Hidden gems approval
- **AdminFeedbackDashboard.jsx** - Feedback viewing
- **AdminTripPlans.jsx** - Trip plan management

## Route Structure

### Public Routes
```
/login              - User login
/register           - User registration
/forgot-password    - Forgot password
/reset-password/:token - Password reset
/admin/login        - Admin login
/admin              - Redirects to /admin/login
```

### User Protected Routes (Users Only)
```
/                   - AI Chatbot (main dashboard)
/trips              - Trip management
/cart               - Booking cart
/success            - Booking success
/cancel             - Booking cancellation
/dashboard          - User profile dashboard
/mytrips            - My trips
```

### Admin Protected Routes (Admins Only)
```
/admin/dashboard              - Admin dashboard
/admin/dashboard/overview     - Dashboard overview
/admin/dashboard/users        - User management
/admin/dashboard/destinations - Destination management
/admin/dashboard/transport    - Transport management
/admin/dashboard/bookings     - Booking management
/admin/dashboard/reviews      - Review moderation
/admin/dashboard/hidden-gems  - Hidden gems approval
/admin/dashboard/feedback     - Feedback viewing
/admin/dashboard/tripplans    - Trip plan management
```

## Database Schema

### User Model
```javascript
{
    name: String,
    username: String (unique),
    email: String (unique),
    password: String (hashed),
    role: String (enum: ['admin', 'user'], default: 'user'),
    
    // Social login
    authProvider: String (enum: ['local', 'google', 'apple']),
    authProviderId: String,
    googleId: String,
    profilePicture: String,
    
    // Password reset
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    
    // Features
    chatHistory: Array,
    
    // Timestamps
    createdAt: Date,
    updatedAt: Date
}
```

## Environment Variables

### Backend (.env)
```env
MONGO_URI=mongodb+srv://...
JWT_SECRET=your_jwt_secret_key
EMAIL_USER=your_gmail_address
EMAIL_PASS=your_gmail_app_password
FRONTEND_URL=http://localhost:5173
```

### Frontend (.env)
```env
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

## Creating an Admin User

### Method 1: Direct Database Update
```javascript
// In MongoDB shell or MongoDB Compass
db.users.updateOne(
    { email: "admin@example.com" },
    { $set: { role: "admin" } }
)
```

### Method 2: Backend Script
Create a temporary script in backend:
```javascript
const User = require('./models/User');
const bcrypt = require('bcryptjs');

async function createAdmin() {
    const admin = new User({
        name: 'Admin User',
        username: 'admin',
        email: 'admin@example.com',
        password: 'SecurePassword123',
        role: 'admin',
        authProvider: 'local'
    });
    await admin.save();
    console.log('Admin created successfully');
    process.exit();
}

createAdmin();
```

## Testing the Authentication

### Test User Login
1. Navigate to `http://localhost:5173/login`
2. Enter user credentials or use Google OAuth
3. Verify redirect to Chatbot Dashboard
4. Verify profile picture appears in navbar
5. Try accessing `/admin/dashboard` - should redirect to login

### Test Admin Login
1. Navigate to `http://localhost:5173/admin/login`
2. Enter admin credentials
3. Verify redirect to Admin Dashboard
4. Verify access to all admin features
5. Try accessing `/` - should redirect to admin dashboard

### Test Role Separation
1. Login as user, try accessing admin routes - should be blocked
2. Login as admin, try accessing user routes - should be blocked
3. Verify each role can only access their designated features

## UI Design

### User Pages
- Full black background
- Dark blue glowing borders
- Glassmorphism design
- ChatGPT-style interface
- Mobile responsive
- Professional appearance

### Admin Pages
- Enhanced security design
- Shield icon for admin branding
- Separate visual identity
- Professional admin interface
- Data tables and management tools

## Password Requirements

- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 number
- Stored securely using bcrypt

## Google OAuth Integration

### Setup
1. Create Google OAuth 2.0 credentials in Google Cloud Console
2. Add authorized JavaScript origins (localhost:5173 for dev)
3. Set `VITE_GOOGLE_CLIENT_ID` in frontend .env
4. Users can register/login with Google account
5. Profile picture automatically imported

### Security
- Tokens verified via Google's tokeninfo endpoint
- No password storage for Google users
- Automatic account creation for new users
- Profile data (name, picture) automatically imported

## Password Reset Flow

1. User requests reset at `/forgot-password`
2. Backend generates secure token (hashed)
3. Email sent with reset link (valid for 1 hour)
4. User clicks link, redirected to `/reset-password/:token`
5. User sets new password (must meet requirements)
6. Token invalidated after successful reset

## Session Management

### Token Storage
- JWT token stored in localStorage
- Role stored in localStorage
- Profile data stored in localStorage
- Auth change events trigger state updates

### Session Expiration
- JWT tokens expire after 7 days
- Users must re-login after expiration
- Admin sessions also follow 7-day expiration

### Logout
- Clears all auth data from localStorage
- Triggers auth change event
- Redirects to appropriate login page

## Middleware Usage

### Backend Middleware
```javascript
// For any authenticated user
const auth = require('../middleware/auth');
router.get('/protected', auth, handler);

// For admin only
const adminAuth = require('../middleware/adminAuth');
router.get('/admin-only', adminAuth, handler);
```

### Frontend Route Protection
```javascript
// For any authenticated user
<ProtectedRoute token={token}>
  <Component />
</ProtectedRoute>

// For admin only
<AdminProtectedRoute>
  <AdminComponent />
</AdminProtectedRoute>

// For users only (not admin)
<UserProtectedRoute>
  <UserComponent />
</UserProtectedRoute>
```

## Troubleshooting

### User cannot login
- Verify email/password are correct
- Check if account uses social login
- Verify user role is 'user'
- Check browser console for errors

### Admin cannot login
- Verify admin credentials
- Check if user role is 'admin'
- Ensure using `/admin/login` not `/login`
- Verify admin middleware is working

### Role-based redirects not working
- Clear localStorage and try again
- Check role is stored correctly after login
- Verify ProtectedRoute components are used correctly
- Check browser console for routing errors

### Google OAuth not working
- Verify VITE_GOOGLE_CLIENT_ID is set
- Check Google Cloud Console configuration
- Ensure authorized JavaScript origins are correct
- Check browser console for Google API errors

### Password reset not working
- Verify EMAIL_USER and EMAIL_PASS are set
- Check email spam folder
- Verify reset token hasn't expired (1 hour)
- Check backend logs for email sending errors

## Security Best Practices

1. **Never store passwords in plain text** - Always use bcrypt
2. **Use HTTPS in production** - Protect tokens in transit
3. **Implement rate limiting** - Prevent brute force attacks
4. **Regular security audits** - Review dependencies and code
5. **Keep JWT secrets secure** - Never commit to version control
6. **Use environment variables** - Keep sensitive data secure
7. **Implement CSRF protection** - For form submissions
8. **Regular password updates** - Encourage users to update passwords
9. **Monitor suspicious activity** - Log and review auth attempts
10. **Keep dependencies updated** - Security patches

## Future Enhancements

- Two-factor authentication (2FA)
- Email verification for new registrations
- Session timeout with inactivity warning
- OAuth providers (GitHub, Facebook, etc.)
- Role-based permissions (granular access control)
- Audit logging for admin actions
- IP-based access restrictions
- Account lockout after failed attempts
- Password strength meter
- Biometric authentication (WebAuthn)

## Support

For issues or questions:
1. Check this documentation first
2. Review browser console for errors
3. Check backend logs for server errors
4. Verify environment variables are set correctly
5. Ensure database connection is working
6. Check MongoDB for user data integrity

## Summary

The authentication system now provides:
- ✅ Separate User and Admin login flows
- ✅ Role-based access control
- ✅ Google OAuth integration
- ✅ Password reset functionality
- ✅ Secure JWT authentication
- ✅ Protected routes for both user and admin
- ✅ Professional dark theme UI
- ✅ Mobile responsive design
- ✅ Complete separation of user and admin features
- ✅ Enhanced security with middleware
- ✅ Comprehensive error handling
- ✅ Persistent sessions with logout

All existing features remain intact while providing a secure, professional authentication system for both users and administrators.

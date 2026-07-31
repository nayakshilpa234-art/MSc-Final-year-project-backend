const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const auth = require('../middleware/auth');

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const MAX_GUEST_HISTORY = 40;

function normalizeGuestHistory(guestHistory) {
    if (!Array.isArray(guestHistory)) return [];
    return guestHistory.slice(-MAX_GUEST_HISTORY);
}

function signUserToken(res, user) {
    if (!process.env.JWT_SECRET) {
        return res.status(500).json({ msg: 'Server misconfigured (missing JWT secret)' });
    }
    const payload = { user: { id: user.id } };
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
        if (err) {
            console.error('JWT sign error:', err.message);
            return res.status(500).json({ msg: 'Could not create session' });
        }
        res.json({
            token,
            role: user.role || 'user',
            username: user.username || user.email?.split('@')[0],
            email: user.email,
            name: user.name,
            profilePicture: user.profilePicture,
        });
    });
}

// Email transporter factory (lazy — only fails at runtime if not configured)
function getMailTransporter() {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
}

// ─────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────
router.post('/register', async (req, res) => {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const guestHistory = normalizeGuestHistory(req.body.guestHistory);

    if (!email || !password) {
        return res.status(400).json({ msg: 'Email and password are required' });
    }
    if (!name) {
        return res.status(400).json({ msg: 'Full name is required' });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({ msg: 'Invalid email format' });
    }

    // Strong password: min 8 chars, uppercase, lowercase, number
    const strongPwd = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!strongPwd.test(password)) {
        return res.status(400).json({
            msg: 'Password must be at least 8 characters with uppercase, lowercase and a number'
        });
    }

    try {
        // Check duplicate email
        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(400).json({ msg: 'An account with this email already exists' });
        }

        // Build username from name (unique)
        let baseUsername = name.toLowerCase().replace(/\s+/g, '_');
        let finalUsername = baseUsername;
        let counter = 1;
        while (await User.findOne({ username: finalUsername })) {
            finalUsername = `${baseUsername}_${counter++}`;
        }

        const user = new User({
            name,
            username: finalUsername,
            email,
            password,
            role: 'user',
            chatHistory: guestHistory,
            authProvider: 'local',
        });
        await user.save();
        signUserToken(res, user);
    } catch (err) {
        console.error('Register error:', err);
        if (err.code === 11000) {
            return res.status(400).json({ msg: 'Email already registered' });
        }
        res.status(500).json({ msg: err.message || 'Server error' });
    }
});

// ─────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────
router.post('/login', async (req, res) => {
    // Accept email OR username for backward compatibility
    const emailOrUsername = String(req.body.email || req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const guestHistory = normalizeGuestHistory(req.body.guestHistory);

    if (!emailOrUsername || !password) {
        return res.status(400).json({ msg: 'Email and password are required' });
    }

    // Email format validation (only if it looks like an email)
    if (emailOrUsername.includes('@')) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailOrUsername)) {
            return res.status(400).json({ msg: 'Invalid email format' });
        }
    }

    try {
        // Try email first, then username
        const user = await User.findOne({
            $or: [{ email: emailOrUsername }, { username: emailOrUsername }]
        });

        if (!user) {
            return res.status(400).json({ msg: 'Invalid email or password' });
        }

        if (!user.password) {
            const provider = user.authProvider === 'google' ? 'Google' : 'social login';
            return res.status(400).json({ msg: `This account uses ${provider}. Please use that sign-in option.` });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid email or password' });

        // Merge guest history
        if (guestHistory.length > 0) {
            const existingKeys = new Set((user.chatHistory || []).map(m => `${m.sender}:${m.text}`));
            const unique = guestHistory.filter(m => !existingKeys.has(`${m.sender}:${m.text}`));
            user.chatHistory = [...(user.chatHistory || []), ...unique];
            await user.save();
        }

        signUserToken(res, user);
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ msg: err.message || 'Server error' });
    }
});

// ─────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────
router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password -resetPasswordToken -resetPasswordExpires');
        res.json(user);
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

// ─────────────────────────────────────────────
// GET /api/auth/wishlist
// ─────────────────────────────────────────────
router.get('/wishlist', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('wishlist');
        res.json(user.wishlist || []);
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

// ─────────────────────────────────────────────
// POST /api/auth/wishlist/:id
// ─────────────────────────────────────────────
router.post('/wishlist/:id', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const tripId = req.params.id;
        
        if (!user.wishlist) user.wishlist = [];
        
        const index = user.wishlist.indexOf(tripId);
        if (index > -1) {
            // Remove from wishlist
            user.wishlist.splice(index, 1);
        } else {
            // Add to wishlist
            user.wishlist.push(tripId);
        }
        await user.save();
        res.json(user.wishlist);
    } catch (error) {
        res.status(500).send('Server Error');
    }
});

// ─────────────────────────────────────────────
// POST /api/auth/social  (Google / Apple)
// ─────────────────────────────────────────────
router.post('/social', async (req, res) => {
    const { provider, token: socialToken, email, name, providerId, profilePicture } = req.body;

    try {
        if (provider === 'google') {
            const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${socialToken}`);
            if (!googleRes.ok) {
                return res.status(401).json({ msg: 'Invalid Google token' });
            }
            const googleData = await googleRes.json();
            if (!googleData.email) {
                return res.status(401).json({ msg: 'Google token missing email' });
            }
        } else if (provider === 'apple') {
            if (!email && !providerId) {
                return res.status(401).json({ msg: 'Apple sign-in data missing' });
            }
        } else {
            return res.status(400).json({ msg: 'Invalid auth provider' });
        }

        let user = await User.findOne({
            $or: [
                { authProvider: provider, authProviderId: providerId },
                { googleId: providerId },
                { email: email }
            ]
        });

        if (user) {
            if (user.authProvider === 'local') {
                user.authProvider = provider;
                user.authProviderId = providerId;
            }
            if (provider === 'google') user.googleId = providerId;
            if (profilePicture && !user.profilePicture) user.profilePicture = profilePicture;
            if (name && !user.name) user.name = name;
            await user.save();
        } else {
            // Auto-create account
            const baseUsername = (name || email.split('@')[0]).toLowerCase().replace(/\s+/g, '_');
            let finalUsername = baseUsername;
            let counter = 1;
            while (await User.findOne({ username: finalUsername })) {
                finalUsername = `${baseUsername}_${counter++}`;
            }
            user = new User({
                username: finalUsername,
                email,
                name,
                profilePicture,
                authProvider: provider,
                authProviderId: providerId,
                googleId: provider === 'google' ? providerId : undefined,
                role: 'user',
                chatHistory: [],
            });
            await user.save();
        }

        const payload = { user: { id: user.id } };
        jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
            if (err) throw err;
            res.json({
                token,
                role: user.role || 'user',
                username: user.username,
                email: user.email,
                name: user.name,
                profilePicture: user.profilePicture,
            });
        });
    } catch (err) {
        console.error('Social login error:', err);
        res.status(500).json({ msg: 'Social login failed' });
    }
});

// ─────────────────────────────────────────────
// POST /api/auth/forgot-password
// ─────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ msg: 'Email is required' });

    try {
        const user = await User.findOne({ email });

        // Always respond positively (security: don't reveal if email exists)
        if (!user) {
            return res.json({ msg: 'If this email is registered, a reset link has been sent.' });
        }

        if (!user.password && user.authProvider !== 'local') {
            return res.status(400).json({
                msg: `This account uses ${user.authProvider === 'google' ? 'Google' : 'social'} sign-in. Password reset is not applicable.`
            });
        }

        // Generate secure token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpires = Date.now() + 60 * 60 * 1000; // 1 hour
        await user.save({ validateBeforeSave: false });

        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;

        // Send email
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            // Dev mode: return token in response for testing
            console.warn('[DEV] Email not configured. Reset URL:', resetUrl);
            return res.json({
                msg: 'Reset link generated (email not configured — check server console)',
                devResetUrl: resetUrl,
            });
        }

        const transporter = getMailTransporter();
        await transporter.sendMail({
            from: `"AI Tourist Assistant" <${process.env.EMAIL_USER}>`,
            to: user.email,
            subject: 'Password Reset Request',
            html: `
                <div style="font-family: Inter, sans-serif; background: #000; color: #fff; padding: 40px; max-width: 560px; margin: 0 auto; border-radius: 16px; border: 1px solid rgba(0,85,255,0.4);">
                    <h2 style="color: #fff; margin-bottom: 8px;">Password Reset</h2>
                    <p style="color: #94a3b8; margin-bottom: 24px;">Hi ${user.name || user.username || 'there'},</p>
                    <p style="color: #cbd5e1; margin-bottom: 24px;">
                        You requested a password reset for your AI Tourist Assistant account.
                        Click the button below to set a new password. This link is valid for <strong>1 hour</strong>.
                    </p>
                    <a href="${resetUrl}"
                       style="display: inline-block; padding: 14px 32px; background: #0055ff; color: #fff;
                              border-radius: 24px; text-decoration: none; font-weight: 600; font-size: 15px;
                              margin-bottom: 24px;">
                        Reset Password
                    </a>
                    <p style="color: #64748b; font-size: 13px;">
                        If you didn't request this, you can safely ignore this email.
                        Your password will not change.
                    </p>
                    <hr style="border-color: rgba(0,85,255,0.2); margin: 24px 0;" />
                    <p style="color: #475569; font-size: 12px;">
                        Or copy this link: <a href="${resetUrl}" style="color: #0055ff;">${resetUrl}</a>
                    </p>
                </div>
            `,
        });

        res.json({ msg: 'Password reset link sent to your email.' });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ msg: 'Could not send reset email. Please try again later.' });
    }
});

// ─────────────────────────────────────────────
// POST /api/auth/reset-password/:token
// ─────────────────────────────────────────────
router.post('/reset-password/:token', async (req, res) => {
    const rawToken = req.params.token;
    const password = String(req.body.password || '');

    if (!password) return res.status(400).json({ msg: 'New password is required' });

    const strongPwd = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!strongPwd.test(password)) {
        return res.status(400).json({
            msg: 'Password must be at least 8 characters with uppercase, lowercase and a number'
        });
    }

    try {
        const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() },
        });

        if (!user) {
            return res.status(400).json({ msg: 'Reset link is invalid or has expired.' });
        }

        user.password = password; // pre-save hook will hash it
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.json({ msg: 'Password reset successful. You can now log in.' });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ msg: 'Server error. Please try again.' });
    }
});

// ─────────────────────────────────────────────
// POST /api/auth/admin-login
// Separate endpoint for Admin Login — validates role = 'admin' before issuing token
// ─────────────────────────────────────────────
router.post('/admin-login', async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    console.log('\n──────── ADMIN LOGIN ATTEMPT ────────');
    console.log('[Admin Login] Email received:', email);
    console.log('[Admin Login] Password length:', password.length);

    if (!email || !password) {
        console.log('[Admin Login] FAIL: Missing email or password');
        return res.status(400).json({ msg: 'Admin email and password are required' });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        console.log('[Admin Login] FAIL: Invalid email format');
        return res.status(400).json({ msg: 'Invalid email format' });
    }

    try {
        const user = await User.findOne({ email });
        console.log('[Admin Login] User found in DB:', user ? 'YES' : 'NO');

        if (!user) {
            console.log('[Admin Login] FAIL: No user with email:', email);
            return res.status(401).json({ msg: 'Invalid Admin Email or Password' });
        }

        console.log('[Admin Login] User role:', user.role);

        // Verify role
        if (user.role !== 'admin') {
            console.log('[Admin Login] FAIL: Role is not admin, role =', user.role);
            return res.status(403).json({ msg: 'Access denied. This account does not have admin privileges.' });
        }

        console.log('[Admin Login] Role validation: PASSED');

        if (!user.password) {
            console.log('[Admin Login] FAIL: No password set (social login account)');
            return res.status(400).json({ msg: 'This account uses social sign-in. Use regular login.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        console.log('[Admin Login] Password match result:', isMatch ? 'MATCH' : 'NO MATCH');

        if (!isMatch) {
            console.log('[Admin Login] FAIL: Password does not match');
            return res.status(401).json({ msg: 'Invalid Admin Email or Password' });
        }

        console.log('[Admin Login] SUCCESS: Generating JWT token...');
        signUserToken(res, user);
        console.log('[Admin Login] JWT token issued for admin:', email);
        console.log('────────────────────────────────────\n');
    } catch (err) {
        console.error('[Admin Login] ERROR:', err.message);
        console.error(err.stack);
        res.status(500).json({ msg: err.message || 'Server error during admin login' });
    }
});

// ─────────────────────────────────────────────
// GET /api/auth/compare
// Get compare list
// ─────────────────────────────────────────────
router.get('/compare', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).populate('compareList');
        res.json(user.compareList);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error fetching compare list' });
    }
});

// ─────────────────────────────────────────────
// POST /api/auth/compare
// Toggle item in compare list
// ─────────────────────────────────────────────
router.post('/compare', auth, async (req, res) => {
    try {
        const { tripId } = req.body;
        const user = await User.findById(req.user.id);
        
        const stringCompare = user.compareList.map(id => id.toString());
        if (stringCompare.includes(tripId)) {
            user.compareList = user.compareList.filter(id => id.toString() !== tripId);
        } else {
            if (user.compareList.length >= 3) {
                return res.status(400).json({ msg: 'You can only compare up to 3 packages at a time.' });
            }
            user.compareList.push(tripId);
        }
        await user.save();
        const populatedUser = await User.findById(req.user.id).populate('compareList');
        res.json(populatedUser.compareList);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error updating compare list' });
    }
});

// ─────────────────────────────────────────────
// DELETE /api/auth/compare
// Clear compare list
// ─────────────────────────────────────────────
router.delete('/compare', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        user.compareList = [];
        await user.save();
        res.json([]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error clearing compare list' });
    }
});

module.exports = router;

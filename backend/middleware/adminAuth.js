const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ── Admin-only middleware — requires role = 'admin'
module.exports = async function adminAuth(req, res, next) {
    const authHeader = req.header('Authorization');
    if (!authHeader) return res.status(401).json({ msg: 'No token, authorization denied' });

    const token = authHeader.replace('Bearer ', '');
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user;

        // Fetch full user to verify role
        const user = await User.findById(decoded.user.id).select('role');
        if (!user || user.role !== 'admin') {
            return res.status(403).json({ msg: 'Access denied: Admins only' });
        }

        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token is not valid' });
    }
};

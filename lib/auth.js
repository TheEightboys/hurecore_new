/**
 * HURE Core - Authentication Middleware
 * Protects SuperAdmin routes
 * 
 * NOTE: Set SKIP_AUTH=true in .env.local for development/testing
 */

const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '.env.local' });

const JWT_SECRET = process.env.JWT_SECRET || 'hure-dev-secret';
const SKIP_AUTH = process.env.SKIP_AUTH === 'true';

/**
 * Middleware to verify SuperAdmin JWT
 * In dev mode with SKIP_AUTH=true, allows all requests
 */
function requireSuperAdmin(req, res, next) {
    // Development mode - skip auth
    if (SKIP_AUTH) {
        req.user = {
            id: 'demo-superadmin',
            email: 'admin@hure.com',
            role: 'superadmin',
            name: 'Demo SuperAdmin'
        };
        return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);

        // Check if user has superadmin role
        if (decoded.role !== 'superadmin') {
            return res.status(403).json({ error: 'SuperAdmin access required' });
        }

        // Attach user info to request
        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role,
            name: decoded.name || 'SuperAdmin'
        };

        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        return res.status(401).json({ error: 'Invalid token' });
    }
}

/**
 * Generate a JWT token
 * Includes all properties passed in user object
 */
function generateToken(user) {
    return jwt.sign(
        {
            ...user, // Include all properties (id, staffId, clinicId, email, role, name, etc.)
            role: user.role || 'staff'
        },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
}

/**
 * Generate a first-login token for new clinic owners
 */
function generateFirstLoginToken(clinicId, email) {
    return jwt.sign(
        {
            type: 'first_login',
            clinicId,
            email
        },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
}

/**
 * Verify first-login token
 */
function verifyFirstLoginToken(token) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.type !== 'first_login') {
            return null;
        }
        return decoded;
    } catch (err) {
        return null;
    }
}

/**
 * Verify a general JWT token
 * Returns decoded payload or null if invalid
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (err) {
        return null;
    }
}

module.exports = {
    requireSuperAdmin,
    generateToken,
    generateFirstLoginToken,
    verifyFirstLoginToken,
    verifyToken
};

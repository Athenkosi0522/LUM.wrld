// middleware/auth.js
// Simple API key middleware to protect admin-only routes
// Add ADMIN_API_KEY=your-secret-key to your .env file

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'lw-admin-secret-change-me';

/**
 * Protects routes that should only be accessible by the admin dashboard.
 * Checks for x-admin-key header or ?key= query param.
 */
function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'] || req.query.key;

  if (!key || key !== ADMIN_API_KEY) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized — admin access required'
    });
  }

  next();
}

/**
 * Public routes — no auth needed (customers can access)
 * Only allows GET requests through without a key
 */
function publicReadOnly(req, res, next) {
  if (req.method === 'GET') return next();

  // For write operations, require admin key
  const key = req.headers['x-admin-key'] || req.query.key;
  if (!key || key !== ADMIN_API_KEY) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized — admin access required'
    });
  }

  next();
}

module.exports = { requireAdmin, publicReadOnly };
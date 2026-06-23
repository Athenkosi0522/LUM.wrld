// middleware/auth.js
// Secure API key middleware to protect admin-only routes
// ADMIN_API_KEY must be set in .env — server will refuse to start without it

const crypto = require('crypto');

// ─── GUARD: fail hard if key not set ───
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
if (!ADMIN_API_KEY) {
  throw new Error(
    '❌ ADMIN_API_KEY is not set in .env — server cannot start safely. Add it now.'
  );
}

// ─── CONSTANT TIME COMPARISON ───
function safeCompare(a, b) {
  if (!a || !b) return false;
  try {
    const bufA = Buffer.from(String(a));
    const bufB = Buffer.from(String(b));
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

// ─── REQUIRE ADMIN ───
function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'] || req.query.key;
  if (!safeCompare(key, ADMIN_API_KEY)) {
    console.warn(`⚠️  Unauthorized admin access attempt — IP: ${req.ip} — Path: ${req.path}`);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized — admin access required'
    });
  }
  next();
}

// ─── PUBLIC READ ONLY ───
function publicReadOnly(req, res, next) {
  if (req.method === 'GET') return next();
  const key = req.headers['x-admin-key'] || req.query.key;
  if (!safeCompare(key, ADMIN_API_KEY)) {
    console.warn(`⚠️  Unauthorized write attempt — IP: ${req.ip} — ${req.method} ${req.path}`);
    return res.status(401).json({
      success: false,
      error: 'Unauthorized — admin access required'
    });
  }
  next();
}

// ─── VERIFY ADMIN SESSION TOKEN ───
function requireAdminToken(req, res, next) {
  const token = req.headers['x-admin-token'] || req.body?.token;
  const sessions = req.app.locals.adminSessions || new Set();
  if (!token || !sessions.has(token)) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized — invalid or expired session'
    });
  }
  next();
}

module.exports = { requireAdmin, publicReadOnly, requireAdminToken };
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const paymentRoutes = require('./routes/payments');
const preorderRoutes = require('./routes/preorders');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── RATE LIMITING ───
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { success: false, error: 'Too many requests — slow down' }
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5, // only 5 magic link requests per minute per IP
  message: { success: false, error: 'Too many login attempts — try again in a minute' }
});

const checkoutLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many checkout attempts — slow down' }
});

// ─── MIDDLEWARE ───
const allowedOrigins = (process.env.ALLOWED_ORIGIN || '').split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, Postman, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    console.warn(`⚠️  CORS blocked request from: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Apply general rate limit to all API routes
app.use('/api/', generalLimiter);

// ─── ROUTES ───
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', checkoutLimiter, orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/preorders', preorderRoutes);

// ─── HEALTH CHECK ───
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', brand: 'lum.wrld', timestamp: new Date().toISOString() });
});

// ─── ERROR HANDLER ───
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  res.status(err.status || 500).json({ success: false, error: err.message || 'Server error' });
});

// ─── CATCH ALL ───
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🔥 lum.wrld server running on http://localhost:${PORT}`);
});

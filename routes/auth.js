const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const supabase = require('../lib/supabase');
const { sendMagicLink } = require('../lib/email');

// POST /api/auth/magic-link — request a magic link
router.post('/magic-link', async (req, res) => {
  try {
    const { email, name, phone } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Valid email is required' });
    }

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Check if customer already exists
    const { data: existing } = await supabase
      .from('customers')
      .select('id, name, email')
      .eq('email', email.toLowerCase().trim())
      .single();

    let customer;

    if (existing) {
      // Update token for existing customer
      const { data, error } = await supabase
        .from('customers')
        .update({
          magic_token: token,
          magic_token_expires: expires.toISOString()
        })
        .eq('email', email.toLowerCase().trim())
        .select()
        .single();

      if (error) throw error;
      customer = data;
    } else {
      // Create new customer
      const { data, error } = await supabase
        .from('customers')
        .insert([{
          name: name || email.split('@')[0], // use email prefix as fallback name
          email: email.toLowerCase().trim(),
          phone: phone || null,
          magic_token: token,
          magic_token_expires: expires.toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      customer = data;
    }

    // Send magic link email
    const magicUrl = `${process.env.APP_URL}/api/auth/verify?token=${token}&email=${encodeURIComponent(email)}`;
    await sendMagicLink(customer, magicUrl);

    console.log(`🔗 Magic link sent → ${email}`);
    res.json({ success: true, message: 'Magic link sent — check your email' });
  } catch (err) {
    console.error('POST /auth/magic-link error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to send magic link' });
  }
});

// GET /api/auth/verify — verify magic link token
router.get('/verify', async (req, res) => {
  try {
    const { token, email } = req.query;

    if (!token || !email) {
      return res.redirect(`${process.env.APP_URL}?auth=invalid`);
    }

    // Find customer with matching token
    const { data: customer, error } = await supabase
      .from('customers')
      .select('*')
      .eq('email', decodeURIComponent(email).toLowerCase().trim())
      .eq('magic_token', token)
      .single();

    if (error || !customer) {
      return res.redirect(`${process.env.APP_URL}?auth=invalid`);
    }

    // Check token expiry
    if (new Date() > new Date(customer.magic_token_expires)) {
      return res.redirect(`${process.env.APP_URL}?auth=expired`);
    }

    // Clear token and update last login
    await supabase
      .from('customers')
      .update({
        magic_token: null,
        magic_token_expires: null,
        last_login: new Date().toISOString()
      })
      .eq('id', customer.id);

    // Generate session token
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const sessionExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Store session in DB
    await supabase
      .from('customers')
      .update({
        magic_token: sessionToken, // reuse field for session
        magic_token_expires: sessionExpires.toISOString()
      })
      .eq('id', customer.id);

    // Redirect back to site with session token
    res.redirect(
      `${process.env.APP_URL}?auth=success&session=${sessionToken}&customer_id=${customer.id}&name=${encodeURIComponent(customer.name)}`
    );
  } catch (err) {
    console.error('GET /auth/verify error:', err.message);
    res.redirect(`${process.env.APP_URL}?auth=error`);
  }
});

// POST /api/auth/validate — validate session token (called by frontend on load)
router.post('/validate', async (req, res) => {
  try {
    const { session_token, customer_id } = req.body;

    if (!session_token || !customer_id) {
      return res.status(401).json({ success: false, error: 'No session' });
    }

    const { data: customer, error } = await supabase
      .from('customers')
      .select('id, name, email, phone, address')
      .eq('id', customer_id)
      .eq('magic_token', session_token)
      .single();

    if (error || !customer) {
      return res.status(401).json({ success: false, error: 'Invalid session' });
    }

    // Check session expiry
    const { data: full } = await supabase
      .from('customers')
      .select('magic_token_expires')
      .eq('id', customer_id)
      .single();

    if (new Date() > new Date(full?.magic_token_expires)) {
      return res.status(401).json({ success: false, error: 'Session expired' });
    }

    res.json({ success: true, customer });
  } catch (err) {
    console.error('POST /auth/validate error:', err.message);
    res.status(401).json({ success: false, error: 'Invalid session' });
  }
});

// POST /api/auth/logout — clear session
router.post('/logout', async (req, res) => {
  try {
    const { customer_id } = req.body;
    if (customer_id) {
      await supabase
        .from('customers')
        .update({ magic_token: null, magic_token_expires: null })
        .eq('id', customer_id);
    }
    res.json({ success: true });
  } catch (err) {
    res.json({ success: true }); // always succeed on logout
  }
});

// GET /api/auth/me — get current customer profile + order history
router.get('/me', async (req, res) => {
  try {
    const { session_token, customer_id } = req.query;

    if (!session_token || !customer_id) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    // Validate session
    const { data: customer, error } = await supabase
      .from('customers')
      .select('id, name, email, phone, address, last_login, magic_token_expires')
      .eq('id', customer_id)
      .eq('magic_token', session_token)
      .single();

    if (error || !customer) {
      return res.status(401).json({ success: false, error: 'Invalid session' });
    }

    if (new Date() > new Date(customer.magic_token_expires)) {
      return res.status(401).json({ success: false, error: 'Session expired' });
    }

    // Get order history
    const { data: orders } = await supabase
      .from('orders')
      .select('id, items, total_amount, status, created_at, tracking_number')
      .eq('customer_id', customer_id)
      .order('created_at', { ascending: false });

    res.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        last_login: customer.last_login
      },
      orders: orders || []
    });
  } catch (err) {
    console.error('GET /auth/me error:', err.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// ─── ADMIN AUTH ───────────────────────────────────────

// POST /api/auth/admin-login
router.post('/admin-login', async (req, res) => {
  const { username, password } = req.body;

  const validUser = process.env.ADMIN_USERNAME;
  const validPass = process.env.ADMIN_PASSWORD;

  if (!validUser || !validPass) {
    return res.status(500).json({ success: false, error: 'Admin credentials not configured' });
  }

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Missing credentials' });
  }

  // Always wait 800ms — prevents timing attacks
  await new Promise(r => setTimeout(r, 800));

  const userMatch = crypto.timingSafeEqual(
    Buffer.from(username.padEnd(64)),
    Buffer.from(validUser.padEnd(64))
  );
  const passMatch = crypto.timingSafeEqual(
    Buffer.from(password.padEnd(64)),
    Buffer.from(validPass.padEnd(64))
  );

  if (!userMatch || !passMatch) {
    console.warn(`⚠️  Failed admin login attempt — IP: ${req.ip}`);
    return res.status(401).json({ success: false, error: 'Invalid credentials' });
  }

  // Generate session token
  const token = crypto.randomBytes(32).toString('hex');
  req.app.locals.adminSessions = req.app.locals.adminSessions || new Set();
  req.app.locals.adminSessions.add(token);

  console.log(`✅ Admin login successful — IP: ${req.ip}`);
  res.json({ success: true, token, username });
});

// POST /api/auth/admin-verify
router.post('/admin-verify', (req, res) => {
  const { token } = req.body;
  const sessions = req.app.locals.adminSessions || new Set();
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ success: false });
  }
  res.json({ success: true });
});

// POST /api/auth/admin-logout
router.post('/admin-logout', (req, res) => {
  const { token } = req.body;
  const sessions = req.app.locals.adminSessions || new Set();
  sessions.delete(token);
  console.log(`👋 Admin logged out — IP: ${req.ip}`);
  res.json({ success: true });
});

// POST /api/auth/admin-change-password
router.post('/admin-change-password', async (req, res) => {
  const { token, currentPassword, newPassword } = req.body;

  // Verify session first
  const sessions = req.app.locals.adminSessions || new Set();
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, error: 'Missing fields' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, error: 'Password must be 8+ characters' });
  }

  const validPass = process.env.ADMIN_PASSWORD;
  await new Promise(r => setTimeout(r, 400));

  const passMatch = crypto.timingSafeEqual(
    Buffer.from(currentPassword.padEnd(64)),
    Buffer.from(validPass.padEnd(64))
  );

  if (!passMatch) {
    return res.status(401).json({ success: false, error: 'Current password incorrect' });
  }

  // Note: In production you'd update this in a database or secrets manager
  // For now we update the in-memory env (lasts until server restart)
  process.env.ADMIN_PASSWORD = newPassword;
  console.log(`🔑 Admin password changed — IP: ${req.ip}`);
  res.json({ success: true });
});

// POST /api/auth/admin-change-username
router.post('/admin-change-username', async (req, res) => {
  const { token, newUsername, password } = req.body;

  // Verify session first
  const sessions = req.app.locals.adminSessions || new Set();
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  if (!newUsername || !password) {
    return res.status(400).json({ success: false, error: 'Missing fields' });
  }

  const validPass = process.env.ADMIN_PASSWORD;
  await new Promise(r => setTimeout(r, 400));

  const passMatch = crypto.timingSafeEqual(
    Buffer.from(password.padEnd(64)),
    Buffer.from(validPass.padEnd(64))
  );

  if (!passMatch) {
    return res.status(401).json({ success: false, error: 'Password incorrect' });
  }

  process.env.ADMIN_USERNAME = newUsername;
  console.log(`👤 Admin username changed — IP: ${req.ip}`);
  res.json({ success: true });
});
module.exports = router;

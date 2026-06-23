const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { sendOrderConfirmation } = require('../lib/email');

const YOCO_API_URL = 'https://payments.yoco.com/api/checkouts';

// ─── POST /api/payments/initiate ───
// Called by the frontend after an order is created.
// Creates a Yoco hosted checkout and returns the redirect URL.
router.post('/initiate', async (req, res) => {
  try {
    const { order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({ success: false, error: 'order_id is required' });
    }

    // Fetch order from DB
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', order_id)
      .single();

    if (error || !order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Order already processed' });
    }

    // Yoco expects amount in CENTS (integer)
    const amountInCents = Math.round(order.total_amount * 100);

    const yocoPayload = {
      amount: amountInCents,
      currency: 'ZAR',
      successUrl: `${process.env.APP_URL}?order_id=${order.id}`,
      cancelUrl: `${process.env.APP_URL}?cancelled=true&order_id=${order.id}`,
      failureUrl: `${process.env.APP_URL}?failed=true&order_id=${order.id}`,
      metadata: {
        orderId: order.id,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
      },
    };

    const yocoRes = await fetch(YOCO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.YOCO_SECRET_KEY}`,
      },
      body: JSON.stringify(yocoPayload),
    });

    const yocoData = await yocoRes.json();

    if (!yocoRes.ok || !yocoData.redirectUrl) {
      console.error('Yoco checkout error:', yocoData);
      return res.status(502).json({ success: false, error: 'Failed to create Yoco checkout' });
    }

    // Save the Yoco checkout ID on the order so we can verify it on the webhook
    await supabase
      .from('orders')
      .update({ yoco_checkout_id: yocoData.id })
      .eq('id', order.id);

    res.json({
      success: true,
      redirect_url: yocoData.redirectUrl,
    });
  } catch (err) {
    console.error('POST /payments/initiate error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to initiate payment' });
  }
});

// ─── POST /api/payments/notify ───
// Yoco calls this webhook server-to-server when a payment event occurs.
// Set this URL in your Yoco dashboard under Developers → Webhooks.
// Expected value: https://yourdomain.com/api/payments/notify
router.post('/notify', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // ─── SIGNATURE VERIFICATION ───
    const signature = req.headers['webhook-signature'];
    const webhookSecret = process.env.YOCO_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('❌ YOCO_WEBHOOK_SECRET not set in .env');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    if (!signature) {
      console.warn('⚠️  Yoco webhook received with no signature — rejected');
      return res.status(401).json({ error: 'Missing signature' });
    }

    const crypto = require('crypto');
    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(req.body)
      .digest('hex');

    let sigValid = false;
    try {
      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expectedSig);
      sigValid = sigBuf.length === expBuf.length &&
        crypto.timingSafeEqual(sigBuf, expBuf);
    } catch {
      sigValid = false;
    }

    if (!sigValid) {
      console.warn('⚠️  Yoco webhook signature mismatch — rejected');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse raw body into event object
    const event = JSON.parse(req.body.toString());

    // Only handle successful payment events
    if (event.type !== 'payment.succeeded') {
      return res.status(200).json({ received: true });
    }

    const checkoutId = event.payload?.metadata?.checkoutId || event.payload?.checkoutId;
    const orderId    = event.payload?.metadata?.orderId;

    if (!orderId && !checkoutId) {
      console.error('Yoco webhook: no orderId or checkoutId in payload');
      return res.status(400).json({ error: 'Missing order reference' });
    }

    // Find the order — prefer orderId from metadata, fall back to yoco_checkout_id column
    let query = supabase.from('orders').select('*');
    if (orderId) {
      query = query.eq('id', orderId);
    } else {
      query = query.eq('yoco_checkout_id', checkoutId);
    }
    const { data: order, error } = await query.single();

    if (error || !order) {
      console.error('Yoco webhook: order not found', { orderId, checkoutId });
      return res.status(404).json({ error: 'Order not found' });
    }

    // Idempotency — ignore if already paid
    if (order.status === 'paid') {
      return res.status(200).json({ received: true });
    }

    // Verify the amount paid matches what we expect (in cents)
    const paidAmountCents = event.payload?.amount;
    const expectedCents   = Math.round(order.total_amount * 100);

    if (paidAmountCents !== undefined && Math.abs(paidAmountCents - expectedCents) > 1) {
      console.error('Yoco webhook: amount mismatch', { paidAmountCents, expectedCents });
      return res.status(400).json({ error: 'Amount mismatch' });
    }

    // Mark the order as paid
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'paid',
        yoco_payment_id: event.payload?.id || null,
        paid_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    if (updateError) throw updateError;

    // Deduct stock for each ordered item
    for (const item of order.items) {
      await supabase.rpc('decrement_stock', {
        p_product_id: item.product_id,
        p_quantity: item.quantity,
      });
    }

    // Send order confirmation email to customer
    await sendOrderConfirmation(order);

    console.log(`✅ Yoco payment confirmed — Order ${order.id} · R${order.total_amount}`);
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('POST /payments/notify error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
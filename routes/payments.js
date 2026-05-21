const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const supabase = require('../lib/supabase');
const { sendOrderConfirmation } = require('../lib/email');

const SANDBOX = process.env.PAYFAST_SANDBOX === 'true';
const PAYFAST_URL = SANDBOX
  ? 'https://sandbox.payfast.co.za/eng/process'
  : 'https://www.payfast.co.za/eng/process';

// Build PayFast signature
function buildSignature(data, passphrase) {
  let pfOutput = '';
  for (const key in data) {
    if (data[key] !== '') {
      pfOutput += `${key}=${encodeURIComponent(data[key].trim()).replace(/%20/g, '+')}&`;
    }
  }
  if (passphrase) {
    pfOutput += `passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`;
  } else {
    pfOutput = pfOutput.slice(0, -1);
  }
  return crypto.createHash('md5').update(pfOutput).digest('hex');
}

// POST /api/payments/initiate — generate PayFast payment data for an order
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

    const itemSummary = order.items
      .map(i => `${i.product_name} x${i.quantity}`)
      .join(', ');

    const pfData = {
      merchant_id: process.env.PAYFAST_MERCHANT_ID,
      merchant_key: process.env.PAYFAST_MERCHANT_KEY,
      return_url: `${process.env.PAYFAST_RETURN_URL}?order_id=${order.id}`,
      cancel_url: `${process.env.PAYFAST_CANCEL_URL}?order_id=${order.id}`,
      notify_url: process.env.PAYFAST_NOTIFY_URL,
      name_first: order.customer_name.split(' ')[0],
      name_last: order.customer_name.split(' ').slice(1).join(' ') || '-',
      email_address: order.customer_email,
      m_payment_id: order.id,
      amount: order.total_amount.toFixed(2),
      item_name: `lum.wrld Order #${order.id.slice(0, 8)}`,
      item_description: itemSummary.substring(0, 255),
    };

    pfData.signature = buildSignature(pfData, process.env.PAYFAST_PASSPHRASE);

    res.json({
      success: true,
      payfast_url: PAYFAST_URL,
      payment_data: pfData
    });
  } catch (err) {
    console.error('POST /payments/initiate error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to initiate payment' });
  }
});

// POST /api/payments/notify — PayFast ITN (Instant Transaction Notification)
// PayFast calls this server-to-server when a payment is completed
router.post('/notify', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    const pfData = req.body;

    // Step 1: Verify signature
    const receivedSig = pfData.signature;
    const dataToVerify = { ...pfData };
    delete dataToVerify.signature;
    const expectedSig = buildSignature(dataToVerify, process.env.PAYFAST_PASSPHRASE);

    if (receivedSig !== expectedSig) {
      console.error('PayFast ITN: Invalid signature');
      return res.status(400).send('Invalid signature');
    }

    // Step 2: Verify payment status
    const paymentStatus = pfData.payment_status;
    const orderId = pfData.m_payment_id;

    if (!orderId) {
      return res.status(400).send('Missing order ID');
    }

    // Step 3: Fetch order
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      console.error('PayFast ITN: Order not found', orderId);
      return res.status(404).send('Order not found');
    }

    // Step 4: Verify amount matches
    const paidAmount = parseFloat(pfData.amount_gross);
    if (Math.abs(paidAmount - order.total_amount) > 0.01) {
      console.error('PayFast ITN: Amount mismatch', paidAmount, order.total_amount);
      return res.status(400).send('Amount mismatch');
    }

    // Step 5: Update order status
    if (paymentStatus === 'COMPLETE') {
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'paid',
          payfast_payment_id: pfData.pf_payment_id,
          paid_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (updateError) throw updateError;

      // Step 6: Deduct stock for each item
      for (const item of order.items) {
        await supabase.rpc('decrement_stock', {
          p_product_id: item.product_id,
          p_quantity: item.quantity
        });
      }

      // Step 7: Send confirmation email
      await sendOrderConfirmation(order);

      console.log(`✅ Order ${orderId} paid — R${order.total_amount}`);
    } else if (paymentStatus === 'CANCELLED') {
      await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId);
    }

    res.status(200).send('OK');
  } catch (err) {
    console.error('POST /payments/notify error:', err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;

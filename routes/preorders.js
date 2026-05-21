const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { sendPreorderConfirmation, sendRestockNotification } = require('../lib/email');

// POST /api/preorders — customer submits a preorder for an out-of-stock product
router.post('/', async (req, res) => {
  try {
    const { product_id, customer_name, customer_email, size } = req.body;

    if (!product_id || !customer_name || !customer_email) {
      return res.status(400).json({ success: false, error: 'Product ID, name and email are required' });
    }

    // Verify product exists and is actually out of stock
    const { data: product, error: prodError } = await supabase
      .from('products')
      .select('id, name, stock, price')
      .eq('id', product_id)
      .single();

    if (prodError || !product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    if (product.stock > 0) {
      return res.status(400).json({ success: false, error: 'Product is in stock — no preorder needed' });
    }

    // Check if this customer already preordered this product+size combo
    const { data: existing } = await supabase
      .from('preorders')
      .select('id')
      .eq('product_id', product_id)
      .eq('customer_email', customer_email)
      .eq('size', size || 'N/A')
      .eq('status', 'waiting')
      .single();

    if (existing) {
      return res.status(409).json({ success: false, error: 'You already have a preorder for this item' });
    }

    // Save preorder
    const { data: preorder, error } = await supabase
      .from('preorders')
      .insert([{
        product_id,
        product_name: product.name,
        product_price: product.price,
        customer_name,
        customer_email,
        size: size || 'N/A',
        status: 'waiting'
      }])
      .select()
      .single();

    if (error) throw error;

    // Send confirmation email to customer
    await sendPreorderConfirmation({ ...preorder, product });

    console.log(`📋 Preorder: ${customer_name} → ${product.name} (${size})`);
    res.status(201).json({ success: true, preorder_id: preorder.id });
  } catch (err) {
    console.error('POST /preorders error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to create preorder' });
  }
});

// GET /api/preorders — get all preorders, grouped by product (admin)
router.get('/', async (req, res) => {
  try {
    const { product_id, status } = req.query;

    let query = supabase
      .from('preorders')
      .select('*')
      .order('created_at', { ascending: false });

    if (product_id) query = query.eq('product_id', product_id);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    // Group by product for easy dashboard display
    const grouped = data.reduce((acc, p) => {
      const key = p.product_id;
      if (!acc[key]) {
        acc[key] = {
          product_id: p.product_id,
          product_name: p.product_name,
          product_price: p.product_price,
          count: 0,
          preorders: []
        };
      }
      acc[key].count++;
      acc[key].preorders.push(p);
      return acc;
    }, {});

    res.json({
      success: true,
      total: data.length,
      grouped: Object.values(grouped),
      preorders: data
    });
  } catch (err) {
    console.error('GET /preorders error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch preorders' });
  }
});

// POST /api/preorders/notify/:productId — admin restocked a product, notify all waiting customers
router.post('/notify/:productId', async (req, res) => {
  try {
    const { productId } = req.params;

    // Get product details
    const { data: product, error: prodError } = await supabase
      .from('products')
      .select('id, name, stock, price')
      .eq('id', productId)
      .single();

    if (prodError || !product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    if (product.stock === 0) {
      return res.status(400).json({ success: false, error: 'Product is still out of stock' });
    }

    // Get all waiting preorders for this product
    const { data: preorders, error } = await supabase
      .from('preorders')
      .select('*')
      .eq('product_id', productId)
      .eq('status', 'waiting');

    if (error) throw error;

    if (preorders.length === 0) {
      return res.json({ success: true, notified: 0, message: 'No waiting preorders for this product' });
    }

    // Send notification emails and mark as notified
    let notified = 0;
    for (const preorder of preorders) {
      await sendRestockNotification(preorder, product);
      notified++;
    }

    // Mark all as notified
    await supabase
      .from('preorders')
      .update({ status: 'notified', notified_at: new Date().toISOString() })
      .eq('product_id', productId)
      .eq('status', 'waiting');

    console.log(`📢 Notified ${notified} customers — ${product.name} back in stock`);
    res.json({ success: true, notified, product_name: product.name });
  } catch (err) {
    console.error('POST /preorders/notify error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to send notifications' });
  }
});

// DELETE /api/preorders/:id — remove a single preorder (admin)
router.delete('/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('preorders')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /preorders/:id error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to delete preorder' });
  }
});

module.exports = router;

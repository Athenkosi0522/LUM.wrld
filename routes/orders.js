const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');
const { sendOrderConfirmation } = require('../lib/email');
const { requireAdmin } = require('../middleware/auth');

// POST /api/orders — create a new order (public — customers place orders)
router.post('/', async (req, res) => {
  try {
    const { customer, items } = req.body;

    // Validate
    if (!customer?.email || !customer?.name || !items?.length) {
      return res.status(400).json({
        success: false,
        error: 'Customer info and items are required'
      });
    }

    // Calculate total from DB prices (never trust client-side prices)
    const productIds = items.map(i => i.product_id);
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('id, name, price, stock')
      .in('id', productIds);

    if (prodError) throw prodError;

    let total = 0;
    const orderItems = items.map(item => {
      const product = products.find(p => p.id === item.product_id);
      if (!product) throw new Error(`Product ${item.product_id} not found`);
      if (product.stock < item.quantity) throw new Error(`${product.name} is out of stock`);
      total += product.price * item.quantity;
      return {
        product_id: product.id,
        product_name: product.name,
        size: item.size,
        quantity: item.quantity,
        unit_price: product.price,
        subtotal: product.price * item.quantity
      };
    });

    // Create order in Supabase
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([{
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone || null,
        customer_address: customer.address || null,
        items: orderItems,
        total_amount: total,
        status: 'pending'
      }])
      .select()
      .single();

    if (orderError) throw orderError;

    res.status(201).json({ success: true, order_id: order.id, total });
  } catch (err) {
    console.error('POST /orders error:', err.message);
    res.status(500).json({ success: false, error: err.message || 'Failed to create order' });
  }
});

// GET /api/orders/:id — get single order by ID (public — customers can check their order)
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    res.json({ success: true, order: data });
  } catch (err) {
    console.error('GET /orders/:id error:', err.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// PATCH /api/orders/:id — update order status (admin only)
router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'paid', 'packed', 'shipped', 'delivered', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, order: data });
  } catch (err) {
    console.error('PATCH /orders/:id error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to update order' });
  }
});

// GET /api/orders — get all orders (admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { status, limit = 50 } = req.query;

    let query = supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, orders: data });
  } catch (err) {
    console.error('GET /orders error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

module.exports = router;
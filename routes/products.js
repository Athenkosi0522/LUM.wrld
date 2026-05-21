const express = require('express');
const router = express.Router();
const supabase = require('../lib/supabase');

router.get('/', async (req, res) => {
  try {
    const { category, in_stock } = req.query;
    let query = supabase.from('products').select('*').order('created_at', { ascending: false });
    if (category && category !== 'all') query = query.contains('categories', [category]);
    if (in_stock === 'true') query = query.gt('stock', 0);
    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, products: data });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch products' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('products').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ success: false, error: 'Product not found' });
    res.json({ success: true, product: data });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, description, price, sizes, categories, image_url, stock, tag } = req.body;
    if (!name || !price) return res.status(400).json({ success: false, error: 'Name and price required' });
    const { data, error } = await supabase.from('products').insert([{ name, description, price, sizes, categories, image_url, stock: stock || 0, tag }]).select().single();
    if (error) throw error;
    res.status(201).json({ success: true, product: data });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to create product' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const allowed = ['name', 'description', 'price', 'sizes', 'categories', 'image_url', 'stock', 'tag'];
    const updates = {};
    for (const key of allowed) { if (req.body[key] !== undefined) updates[key] = req.body[key]; }
    const { data, error } = await supabase.from('products').update(updates).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ success: true, product: data });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update product' });
  }
});

router.patch('/:id/stock', async (req, res) => {
  try {
    const { quantity } = req.body;
    const { data, error } = await supabase.from('products').update({ stock: quantity }).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ success: true, product: data });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update stock' });
  }
});

// DELETE /api/products/:id
router.delete('/:id', async (req, res) => {
  try {
    const { data: product, error: fetchError } = await supabase.from('products').select('id, name').eq('id', req.params.id).single();
    if (fetchError || !product) return res.status(404).json({ success: false, error: 'Product not found' });

    // Cancel waiting preorders for this product
    await supabase.from('preorders').update({ status: 'cancelled' }).eq('product_id', req.params.id).eq('status', 'waiting');

    const { error } = await supabase.from('products').delete().eq('id', req.params.id);
    if (error) throw error;

    console.log(`Deleted product: ${product.name}`);
    res.json({ success: true, message: `${product.name} removed` });
  } catch (err) {
    console.error('DELETE /products/:id error:', err.message);
    res.status(500).json({ success: false, error: 'Failed to delete product' });
  }
});

module.exports = router;

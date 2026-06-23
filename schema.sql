-- ============================================
-- lum.wrld — Supabase Database Schema
-- Run this in: Supabase → SQL Editor → New Query
-- ============================================

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10, 2) NOT NULL,
  sizes TEXT[] DEFAULT '{"XS","S","M","L","XL","XXL"}',
  categories TEXT[] DEFAULT '{"all"}',
  image_url TEXT,
  stock INTEGER DEFAULT 0,
  tag TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  customer_address TEXT,
  items JSONB NOT NULL,
  total_amount NUMERIC(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled')),
  yoco_payment_id TEXT,
  paid_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  tracking_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Decrement stock function (called after payment)
CREATE OR REPLACE FUNCTION decrement_stock(p_product_id UUID, p_quantity INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET stock = GREATEST(stock - p_quantity, 0)
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Seed initial products (your existing catalog)
-- ============================================
INSERT INTO products (name, description, price, sizes, categories, image_url, stock, tag) VALUES
(
  '4PF Shorts',
  'The iconic LUMW x 4PF shorts. Bold print on premium heavyweight cotton with zip pockets. Elastic waist with drawstring.',
  350.00,
  ARRAY['XS','S','M','L','XL','XXL'],
  ARRAY['all','boujee'],
  'https://raw.githubusercontent.com/justforher-code/lum.wrld/main/LUM.Wrld/4pf%20shorts.jpg',
  20,
  'New Drop'
),
(
  'LUMW Graphic Tee',
  'The signature LUMW tee with bold lightning graphic. Oversized fit on premium heavyweight cotton — built for the streets.',
  350.00,
  ARRAY['XS','S','M','L','XL','XXL'],
  ARRAY['all','tees','boujee'],
  'https://raw.githubusercontent.com/justforher-code/lum.wrld/main/LUM.Wrld/lumw%20graphic%20tee.jpg',
  30,
  'Boujee'
),
(
  'LUMW Snapback Cap',
  'Clean black snapback with embroidered LUMW logo front and globe emblem on the back. One size fits all.',
  250.00,
  ARRAY['One Size'],
  ARRAY['all','caps','boujee'],
  'https://raw.githubusercontent.com/justforher-code/lum.wrld/main/LUM.Wrld/lumw%20fitted%20cap.jpg',
  15,
  'New'
),
(
  'Angry Youth Tee',
  'Angry Youth Elite graphic tee. Heavy print on premium black cotton. Statement piece for the culture.',
  350.00,
  ARRAY['XS','S','M','L','XL','XXL'],
  ARRAY['all','tees','boujee'],
  'https://raw.githubusercontent.com/justforher-code/lum.wrld/main/LUM.Wrld/angry%20youth%20tee.jpg',
  25,
  'Heat'
),
(
  'Scott 02 Tee',
  'The Scott 02 tee. LUMW wordmark with portrait graphic. Premium heavy cotton, oversized fit. light up my wrld even when everything burns.',
  350.00,
  ARRAY['XS','S','M','L','XL','XXL'],
  ARRAY['all','tees','preorder'],
  'https://raw.githubusercontent.com/justforher-code/lum.wrld/main/LUM.Wrld/scott%2002%20tee%20x%20lumw%20(front).jpg',
  10,
  'New Drop'
);

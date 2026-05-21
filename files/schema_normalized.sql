-- ============================================================
-- lum.wrld — Normalized Database Schema (3NF)
-- Run in: Supabase → SQL Editor → New Query
-- Drop old tables first if migrating from the old schema
-- ============================================================

-- ── 1. CUSTOMERS (extracted from orders — no more duplication) ──
CREATE TABLE IF NOT EXISTS customers (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE,
  phone        TEXT,
  address      TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. PRODUCTS (core fields only — no arrays) ──
CREATE TABLE IF NOT EXISTS products (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  price        NUMERIC(10,2) NOT NULL CHECK (price > 0),
  image_url    TEXT,
  stock        INTEGER DEFAULT 0 CHECK (stock >= 0),
  tag          TEXT,
  is_active    BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. PRODUCT SIZES (1NF — no more arrays in products.sizes) ──
CREATE TABLE IF NOT EXISTS product_sizes (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size         TEXT NOT NULL,
  sort_order   INTEGER DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_sizes_unique ON product_sizes(product_id, size);

-- ── 4. PRODUCT CATEGORIES (1NF — no more arrays in products.categories) ──
CREATE TABLE IF NOT EXISTS product_categories (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  category     TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_categories_unique ON product_categories(product_id, category);

-- ── 5. ORDERS (references customer_id — no more duplicated customer fields) ──
CREATE TABLE IF NOT EXISTS orders (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id         UUID REFERENCES customers(id) ON DELETE SET NULL,
  total_amount        NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
  status              TEXT DEFAULT 'pending' CHECK (
                        status IN ('pending','paid','packed','shipped','delivered','cancelled')
                      ),
  payfast_payment_id  TEXT,
  paid_at             TIMESTAMPTZ,
  shipped_at          TIMESTAMPTZ,
  tracking_number     TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── 6. ORDER ITEMS (extracted from orders.items JSONB — proper 2NF) ──
CREATE TABLE IF NOT EXISTS order_items (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id              UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id            UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name_snapshot TEXT NOT NULL,  -- snapshot in case product is later deleted
  size                  TEXT NOT NULL,
  quantity              INTEGER NOT NULL CHECK (quantity > 0),
  unit_price            NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
  subtotal              NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

-- ── 7. PREORDERS (references customer_id and product_id — no duplicated fields) ──
CREATE TABLE IF NOT EXISTS preorders (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id   UUID REFERENCES products(id) ON DELETE CASCADE,
  customer_id  UUID REFERENCES customers(id) ON DELETE CASCADE,
  size         TEXT DEFAULT 'N/A',
  status       TEXT DEFAULT 'waiting' CHECK (
                 status IN ('waiting','notified','purchased','cancelled')
               ),
  notified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_preorders_unique
  ON preorders(product_id, customer_id, size)
  WHERE status = 'waiting';

-- ============================================================
-- INDEXES (for performance)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_customer_id    ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status         ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id  ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_preorders_product_id  ON preorders(product_id);
CREATE INDEX IF NOT EXISTS idx_preorders_customer_id ON preorders(customer_id);
CREATE INDEX IF NOT EXISTS idx_preorders_status      ON preorders(status);
CREATE INDEX IF NOT EXISTS idx_customers_email       ON customers(email);
CREATE INDEX IF NOT EXISTS idx_product_sizes_pid     ON product_sizes(product_id);
CREATE INDEX IF NOT EXISTS idx_product_cats_pid      ON product_categories(product_id);

-- ============================================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_products_updated_at   BEFORE UPDATE ON products   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_orders_updated_at     BEFORE UPDATE ON orders     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_customers_updated_at  BEFORE UPDATE ON customers  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- DECREMENT STOCK FUNCTION (called after confirmed payment)
-- ============================================================
CREATE OR REPLACE FUNCTION decrement_stock(p_product_id UUID, p_quantity INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE products SET stock = GREATEST(stock - p_quantity, 0) WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- USEFUL VIEWS (denormalize for easy reading — no duplication in storage)
-- ============================================================

-- orders_full: joins orders + customers for easy dashboard queries
CREATE OR REPLACE VIEW orders_full AS
SELECT
  o.id,
  o.total_amount,
  o.status,
  o.payfast_payment_id,
  o.paid_at,
  o.shipped_at,
  o.tracking_number,
  o.notes,
  o.created_at,
  o.updated_at,
  c.id           AS customer_id,
  c.name         AS customer_name,
  c.email        AS customer_email,
  c.phone        AS customer_phone,
  c.address      AS customer_address
FROM orders o
LEFT JOIN customers c ON c.id = o.customer_id;

-- order_items_full: joins order items with product info
CREATE OR REPLACE VIEW order_items_full AS
SELECT
  oi.id,
  oi.order_id,
  oi.product_name_snapshot AS product_name,
  oi.size,
  oi.quantity,
  oi.unit_price,
  oi.subtotal,
  p.id        AS product_id,
  p.image_url AS product_image
FROM order_items oi
LEFT JOIN products p ON p.id = oi.product_id;

-- products_full: joins product with its sizes and categories
CREATE OR REPLACE VIEW products_full AS
SELECT
  p.*,
  ARRAY_AGG(DISTINCT ps.size ORDER BY ps.sort_order) FILTER (WHERE ps.size IS NOT NULL) AS sizes,
  ARRAY_AGG(DISTINCT pc.category)                    FILTER (WHERE pc.category IS NOT NULL) AS categories
FROM products p
LEFT JOIN product_sizes ps ON ps.product_id = p.id
LEFT JOIN product_categories pc ON pc.product_id = p.id
GROUP BY p.id;

-- preorders_full: joins preorders with customer and product info
CREATE OR REPLACE VIEW preorders_full AS
SELECT
  pr.id,
  pr.size,
  pr.status,
  pr.notified_at,
  pr.created_at,
  p.id    AS product_id,
  p.name  AS product_name,
  p.price AS product_price,
  p.stock AS product_stock,
  c.id    AS customer_id,
  c.name  AS customer_name,
  c.email AS customer_email,
  c.phone AS customer_phone
FROM preorders pr
LEFT JOIN products  p ON p.id = pr.product_id
LEFT JOIN customers c ON c.id = pr.customer_id;

-- ============================================================
-- SEED PRODUCTS
-- ============================================================
WITH inserted_products AS (
  INSERT INTO products (name, description, price, image_url, stock, tag) VALUES
  ('4PF Shorts',           'Bold print on premium heavyweight cotton with zip pockets. Elastic waist with drawstring.',    350.00, 'https://raw.githubusercontent.com/justforher-code/lum.wrld/main/LUM.Wrld/4pf%20shorts.jpg',              20, 'New Drop'),
  ('LUMW Graphic Tee',     'The signature LUMW tee with bold lightning graphic. Oversized fit on premium heavyweight cotton.', 350.00, 'https://raw.githubusercontent.com/justforher-code/lum.wrld/main/LUM.Wrld/lumw%20graphic%20tee.jpg',     30, 'Boujee'),
  ('LUMW Snapback Cap',    'Clean black snapback with embroidered LUMW logo. One size fits all.',                          250.00, 'https://raw.githubusercontent.com/justforher-code/lum.wrld/main/LUM.Wrld/lumw%20fitted%20cap.jpg',       15, 'New'),
  ('Angry Youth Tee',      'Angry Youth Elite graphic tee. Heavy print on premium black cotton.',                         350.00, 'https://raw.githubusercontent.com/justforher-code/lum.wrld/main/LUM.Wrld/angry%20youth%20tee.jpg',        25, 'Heat'),
  ('Scott 02 Tee',         'LUMW wordmark with portrait graphic. Premium heavy cotton, oversized fit.',                   350.00, 'https://raw.githubusercontent.com/justforher-code/lum.wrld/main/LUM.Wrld/scott%2002%20tee%20x%20lumw%20(front).jpg', 10, 'New Drop')
  RETURNING id, name
)
-- Sizes
INSERT INTO product_sizes (product_id, size, sort_order)
SELECT id, size, idx FROM inserted_products
CROSS JOIN (VALUES ('XS',0),('S',1),('M',2),('L',3),('XL',4),('XXL',5)) AS s(size, idx)
WHERE name IN ('4PF Shorts','LUMW Graphic Tee','Angry Youth Tee','Scott 02 Tee')
UNION ALL
SELECT id, 'One Size', 0 FROM inserted_products WHERE name = 'LUMW Snapback Cap';

-- Categories
WITH prods AS (SELECT id, name FROM products)
INSERT INTO product_categories (product_id, category)
SELECT id, cat FROM prods
CROSS JOIN (VALUES ('all')) AS c(cat)
UNION ALL
SELECT id, 'boujee' FROM prods
UNION ALL
SELECT id, 'tees'   FROM prods WHERE name IN ('LUMW Graphic Tee','Angry Youth Tee','Scott 02 Tee')
UNION ALL
SELECT id, 'caps'   FROM prods WHERE name = 'LUMW Snapback Cap'
UNION ALL
SELECT id, 'preorder' FROM prods WHERE name = 'Scott 02 Tee';

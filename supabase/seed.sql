-- Popup Hub — Seed Data
-- Run after migrations to populate categories

INSERT INTO categories (id, name, icon_url) VALUES
  (gen_random_uuid(), 'Jewelry & Accessories', NULL),
  (gen_random_uuid(), 'Candles & Home Fragrance', NULL),
  (gen_random_uuid(), 'Clothing & Apparel', NULL),
  (gen_random_uuid(), 'Art & Photography', NULL),
  (gen_random_uuid(), 'Produce & Farm Fresh', NULL),
  (gen_random_uuid(), 'Baked Goods & Sweets', NULL),
  (gen_random_uuid(), 'Plants & Florals', NULL),
  (gen_random_uuid(), 'Handmade Crafts', NULL),
  (gen_random_uuid(), 'Health & Beauty', NULL),
  (gen_random_uuid(), 'Pet Products', NULL),
  (gen_random_uuid(), 'Vintage & Antiques', NULL),
  (gen_random_uuid(), 'Food & Beverage', NULL),
  (gen_random_uuid(), 'Kids & Baby', NULL),
  (gen_random_uuid(), 'Books & Paper Goods', NULL),
  (gen_random_uuid(), 'Woodworking', NULL)
ON CONFLICT (name) DO NOTHING;

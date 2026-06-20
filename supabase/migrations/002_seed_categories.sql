-- Seed default market categories
insert into public.categories (name, sort_order) values
  ('Artisan Crafts',    1),
  ('Candles & Soaps',   2),
  ('Clothing & Apparel',3),
  ('Food & Beverage',   4),
  ('Fresh Produce',     5),
  ('Home Decor',        6),
  ('Jewelry',           7),
  ('Pet Products',      8),
  ('Plants & Flowers',  9),
  ('Pottery & Ceramics',10),
  ('Vintage & Antiques',11),
  ('Woodworking',       12),
  ('Health & Wellness', 13),
  ('Books & Art',       14),
  ('Kids & Toys',       15),
  ('Games',             16)
on conflict (name) do nothing;

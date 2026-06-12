-- Broad product category for direct-sales / MLM vendors (generic, not brand-specific)

INSERT INTO public.categories (name, sort_order, is_mlm, is_broad, requires_documentation) VALUES
  ('Multi Level Marketer (MLM)', 39, true, true, false)
ON CONFLICT (name) DO UPDATE SET
  sort_order = EXCLUDED.sort_order,
  is_mlm = EXCLUDED.is_mlm,
  is_broad = EXCLUDED.is_broad,
  requires_documentation = EXCLUDED.requires_documentation;

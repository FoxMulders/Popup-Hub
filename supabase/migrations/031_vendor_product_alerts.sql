-- Vendor product alert notification types

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'vendor_flash_sale';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'vendor_sold_out';

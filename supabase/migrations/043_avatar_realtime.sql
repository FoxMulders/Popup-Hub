-- Enable live avatar sync when profile photos or passport logos change

ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE vendor_passports;

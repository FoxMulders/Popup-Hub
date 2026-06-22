-- Application status notifications are sent from app routes
-- (notify-vendor-application-status.ts) so messages can include payment
-- context and decline copy. Drop the DB trigger to avoid duplicate rows.

DROP TRIGGER IF EXISTS trg_application_status_notify ON booth_applications;

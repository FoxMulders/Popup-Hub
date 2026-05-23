-- One-off local QA: promote test account to vendor for passport workflows.
-- Safe to skip in production if this email does not exist.

UPDATE public.profiles
SET role = 'vendor'::user_role
WHERE id = (SELECT id FROM auth.users WHERE email = 'thetipsyfoxyeg@gmail.com');

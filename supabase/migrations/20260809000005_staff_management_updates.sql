-- 1. Add is_active and last_login to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login timestamptz;

-- 2. Function to handle last_login trigger from auth.users
CREATE OR REPLACE FUNCTION public.sync_last_sign_in_at()
RETURNS trigger AS $$
BEGIN
  IF NEW.last_sign_in_at IS NOT NULL AND (OLD.last_sign_in_at IS NULL OR NEW.last_sign_in_at != OLD.last_sign_in_at) THEN
    UPDATE public.profiles
    SET last_login = NEW.last_sign_in_at
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create Trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
CREATE TRIGGER on_auth_user_login
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.sync_last_sign_in_at();

-- 4. Backfill last_login for existing profiles
UPDATE public.profiles p
SET last_login = u.last_sign_in_at
FROM auth.users u
WHERE p.id = u.id AND u.last_sign_in_at IS NOT NULL;

-- 5. RPC for Force Logout
CREATE OR REPLACE FUNCTION public.force_logout_all_staff()
RETURNS void AS $$
DECLARE
  v_role text;
BEGIN
  -- Verify caller is owner
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role != 'owner' THEN
    RAISE EXCEPTION 'Unauthorized: only owner can force logout staff.';
  END IF;

  -- Delete sessions for staff roles
  DELETE FROM auth.sessions 
  WHERE user_id IN (SELECT id FROM public.profiles WHERE role IN ('waiter', 'cook', 'manager'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

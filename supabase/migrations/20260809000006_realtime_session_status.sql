-- 1. Add is_logged_in to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_logged_in boolean DEFAULT false;

-- 2. Update trigger function to also set is_logged_in = true on sign in
CREATE OR REPLACE FUNCTION public.sync_last_sign_in_at()
RETURNS trigger AS $$
BEGIN
  IF NEW.last_sign_in_at IS NOT NULL AND (OLD.last_sign_in_at IS NULL OR NEW.last_sign_in_at != OLD.last_sign_in_at) THEN
    UPDATE public.profiles
    SET last_login = NEW.last_sign_in_at,
        is_logged_in = true
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Backfill is_logged_in for currently active sessions (within 48 hours)
UPDATE public.profiles 
SET is_logged_in = true 
WHERE last_login > (now() - interval '48 hours');

-- 4. Update RPC for Force Logout to also set is_logged_in = false
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

  -- Mark them as logged out
  UPDATE public.profiles 
  SET is_logged_in = false 
  WHERE role IN ('waiter', 'cook', 'manager');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Add RLS policy to allow users to update their own profiles (required for client-side logout hook)
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

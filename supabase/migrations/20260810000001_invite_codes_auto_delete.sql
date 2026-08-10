-- 1. Create a function to auto-delete the oldest 10 used invite codes when count reaches 10
CREATE OR REPLACE FUNCTION public.auto_delete_used_invite_codes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if we have 10 or more used codes
  IF (SELECT count(*) FROM public.invite_codes WHERE status = 'used') >= 10 THEN
    -- Delete the oldest 10 used codes
    DELETE FROM public.invite_codes 
    WHERE id IN (
      SELECT id 
      FROM public.invite_codes 
      WHERE status = 'used' 
      ORDER BY created_at ASC 
      LIMIT 10
    );
  END IF;
  
  RETURN NULL;
END;
$$;

-- 2. Create the trigger to fire AFTER UPDATE
DROP TRIGGER IF EXISTS trigger_auto_delete_used_invite_codes ON public.invite_codes;

CREATE TRIGGER trigger_auto_delete_used_invite_codes
AFTER UPDATE ON public.invite_codes
FOR EACH STATEMENT
EXECUTE FUNCTION public.auto_delete_used_invite_codes();

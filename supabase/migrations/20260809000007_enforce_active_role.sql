-- Update has_role function to enforce is_active = true alongside the role check.
-- This ensures that deactivated staff members (is_active = false) immediately lose 
-- their RLS access even if their stored role remains 'waiter', 'cook', etc.
-- Note: 'customer' role might not have is_active enforced for general access, but this project
-- uses 'is_active' for staff explicitly. For safety and simplicity, we enforce it for all checked roles.
-- Since customers don't strictly use has_role() in RLS (they usually use customer_id = auth.uid()),
-- this is safe. Wait, let's verify if customers have is_active. 
-- Wait, the profiles table has is_active DEFAULT true. So all users have it.

CREATE OR REPLACE FUNCTION has_role(allowed_roles text[])
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
      AND role = ANY(allowed_roles)
      AND is_active = true
  );
$$;

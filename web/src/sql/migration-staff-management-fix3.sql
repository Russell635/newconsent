-- Fix: Replace recursive manager insert policy with a security definer function

-- Helper function that bypasses RLS to check manager permissions
CREATE OR REPLACE FUNCTION is_manager_with_staff_permission(check_surgeon_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff_assignments
    WHERE staff_user_id = auth.uid()
      AND surgeon_id = check_surgeon_id
      AND is_active = true
      AND invitation_status = 'accepted'
      AND staff_role = 'manager'
      AND 'manage_staff' = ANY(permissions)
  );
$$;

-- Drop the recursive policy
DROP POLICY IF EXISTS "staff_assignments_insert_manager" ON staff_assignments;

-- Recreate using the security definer function
CREATE POLICY "staff_assignments_insert_manager"
  ON staff_assignments FOR INSERT
  WITH CHECK (
    is_manager_with_staff_permission(surgeon_id)
  );

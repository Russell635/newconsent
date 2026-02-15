-- Fix: Replace all staff_assignments INSERT policies with a single non-recursive function

-- Drop ALL insert policies on staff_assignments
DROP POLICY IF EXISTS "staff_assignments_insert_surgeon" ON staff_assignments;
DROP POLICY IF EXISTS "staff_assignments_insert_manager" ON staff_assignments;
DROP POLICY IF EXISTS "nurse_assignments_insert" ON staff_assignments;

-- Single function that checks if the current user can create a staff assignment
-- Runs as definer to bypass RLS and avoid recursion
CREATE OR REPLACE FUNCTION can_insert_staff_assignment(target_surgeon_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT (
    -- Surgeon inserting for their own practice
    EXISTS (
      SELECT 1 FROM surgeon_profiles
      WHERE id = target_surgeon_id
        AND user_id = auth.uid()
    )
    OR
    -- Admin
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid()
        AND role = 'admin'
    )
    OR
    -- Manager with manage_staff permission
    EXISTS (
      SELECT 1 FROM staff_assignments
      WHERE staff_user_id = auth.uid()
        AND surgeon_id = target_surgeon_id
        AND is_active = true
        AND invitation_status = 'accepted'
        AND staff_role = 'manager'
        AND 'manage_staff' = ANY(permissions)
    )
  );
$$;

-- Single clean INSERT policy
CREATE POLICY "staff_assignments_insert"
  ON staff_assignments FOR INSERT
  WITH CHECK (
    can_insert_staff_assignment(surgeon_id)
  );

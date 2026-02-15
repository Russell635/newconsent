-- Fix: Drop old nurse_assignments policies (correct names) and add notifications INSERT policy

-- Drop the old policies by their actual names
DROP POLICY IF EXISTS "nurse_assignments_select" ON staff_assignments;
DROP POLICY IF EXISTS "nurse_assignments_insert" ON staff_assignments;
DROP POLICY IF EXISTS "nurse_assignments_update" ON staff_assignments;
DROP POLICY IF EXISTS "nurse_assignments_delete" ON staff_assignments;

-- Allow surgeons to insert notifications for staff (invitations, permission changes, revocations)
CREATE POLICY "notifications_insert_surgeon"
  ON notifications FOR INSERT
  WITH CHECK (
    get_user_role(auth.uid()) = 'surgeon'
  );

-- Allow managers with manage_staff to insert notifications (nurse invitations)
CREATE POLICY "notifications_insert_manager"
  ON notifications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_assignments
      WHERE staff_user_id = auth.uid()
        AND is_active = true
        AND invitation_status = 'accepted'
        AND staff_role = 'manager'
        AND 'manage_staff' = ANY(permissions)
    )
  );

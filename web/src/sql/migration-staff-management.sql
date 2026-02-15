-- Migration: Staff Management
-- Prerequisite: Run migration-staff-management-step1-enums.sql first (and commit)

-- =============================================================
-- 1. Rename nurse_surgeon_assignments → staff_assignments
-- =============================================================

ALTER TABLE IF EXISTS nurse_surgeon_assignments RENAME TO staff_assignments;

-- Rename nurse_user_id → staff_user_id
ALTER TABLE staff_assignments RENAME COLUMN nurse_user_id TO staff_user_id;

-- Add new columns
ALTER TABLE staff_assignments
  ADD COLUMN IF NOT EXISTS staff_role TEXT NOT NULL DEFAULT 'nurse' CHECK (staff_role IN ('manager', 'nurse')),
  ADD COLUMN IF NOT EXISTS permissions TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS invitation_status TEXT NOT NULL DEFAULT 'accepted' CHECK (invitation_status IN ('pending', 'accepted', 'declined', 'expired')),
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Backfill existing rows as accepted nurses
UPDATE staff_assignments
SET staff_role = 'nurse',
    invitation_status = 'accepted',
    accepted_at = created_at
WHERE invitation_status = 'accepted'
  AND accepted_at IS NULL;

-- Add unique constraint on (staff_user_id, surgeon_id)
ALTER TABLE staff_assignments
  DROP CONSTRAINT IF EXISTS staff_assignments_staff_surgeon_unique;
ALTER TABLE staff_assignments
  ADD CONSTRAINT staff_assignments_staff_surgeon_unique UNIQUE (staff_user_id, surgeon_id);

-- =============================================================
-- 2. Update notifications table with action fields
-- =============================================================

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS action_type TEXT,
  ADD COLUMN IF NOT EXISTS action_data JSONB,
  ADD COLUMN IF NOT EXISTS action_taken BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS action_taken_at TIMESTAMPTZ;

-- =============================================================
-- 3. RLS policies for staff_assignments
-- =============================================================

-- Drop old policies if they exist (original names from migration-consent-flow.sql)
DROP POLICY IF EXISTS "nurse_assignments_select" ON staff_assignments;
DROP POLICY IF EXISTS "nurse_assignments_insert" ON staff_assignments;
DROP POLICY IF EXISTS "nurse_assignments_update" ON staff_assignments;
DROP POLICY IF EXISTS "nurse_assignments_delete" ON staff_assignments;

ALTER TABLE staff_assignments ENABLE ROW LEVEL SECURITY;

-- Staff can see their own assignments
CREATE POLICY "staff_assignments_select_own"
  ON staff_assignments FOR SELECT
  USING (staff_user_id = auth.uid());

-- Surgeons can see assignments to them
CREATE POLICY "staff_assignments_select_surgeon"
  ON staff_assignments FOR SELECT
  USING (
    surgeon_id IN (
      SELECT id FROM surgeon_profiles WHERE user_id = auth.uid()
    )
  );

-- Surgeons can create assignments (invitations)
CREATE POLICY "staff_assignments_insert_surgeon"
  ON staff_assignments FOR INSERT
  WITH CHECK (
    surgeon_id IN (
      SELECT id FROM surgeon_profiles WHERE user_id = auth.uid()
    )
  );

-- Helper function to check manager permissions without recursion
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

-- Managers with manage_staff can create assignments on behalf of surgeon
CREATE POLICY "staff_assignments_insert_manager"
  ON staff_assignments FOR INSERT
  WITH CHECK (
    is_manager_with_staff_permission(surgeon_id)
  );

-- Staff can update their own assignments (accept/decline invitations)
CREATE POLICY "staff_assignments_update_own"
  ON staff_assignments FOR UPDATE
  USING (staff_user_id = auth.uid())
  WITH CHECK (staff_user_id = auth.uid());

-- Surgeons can update assignments to them (edit permissions, revoke)
CREATE POLICY "staff_assignments_update_surgeon"
  ON staff_assignments FOR UPDATE
  USING (
    surgeon_id IN (
      SELECT id FROM surgeon_profiles WHERE user_id = auth.uid()
    )
  );

-- =============================================================
-- 4. RLS policies for staff access to surgeon data tables
-- =============================================================

-- Staff access to patients (via surgeon's patient_consents)
CREATE POLICY "patients_select_staff"
  ON patients FOR SELECT
  USING (
    created_by IN (
      SELECT sp.user_id FROM surgeon_profiles sp
      INNER JOIN staff_assignments sa ON sa.surgeon_id = sp.id
      WHERE sa.staff_user_id = auth.uid()
        AND sa.is_active = true
        AND sa.invitation_status = 'accepted'
    )
  );

-- Staff access to patient_consents
CREATE POLICY "patient_consents_select_staff"
  ON patient_consents FOR SELECT
  USING (
    surgeon_id IN (
      SELECT surgeon_id FROM staff_assignments
      WHERE staff_user_id = auth.uid()
        AND is_active = true
        AND invitation_status = 'accepted'
    )
  );

-- Staff access to surgeon_procedures (read only)
CREATE POLICY "surgeon_procedures_select_staff"
  ON surgeon_procedures FOR SELECT
  USING (
    surgeon_id IN (
      SELECT surgeon_id FROM staff_assignments
      WHERE staff_user_id = auth.uid()
        AND is_active = true
        AND invitation_status = 'accepted'
    )
  );

-- =============================================================
-- 5. Allow user profile lookup for staff invitations
-- =============================================================

-- Surgeons can look up any user profile (needed for staff invitations)
CREATE POLICY "user_profiles_select_surgeon"
  ON user_profiles FOR SELECT
  USING (
    get_user_role(auth.uid()) = 'surgeon'
  );

-- Managers with manage_staff can look up user profiles (for nurse invitations)
CREATE POLICY "user_profiles_select_manager_staff"
  ON user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff_assignments
      WHERE staff_user_id = auth.uid()
        AND is_active = true
        AND invitation_status = 'accepted'
        AND staff_role = 'manager'
        AND 'manage_staff' = ANY(permissions)
    )
  );

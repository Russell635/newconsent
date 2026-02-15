-- Fix: Allow surgeons and managers to look up user profiles for staff invitations
-- The existing "user_profiles_select_own" policy only allows users to see their own profile.
-- Surgeons and managers with manage_staff need to look up users by email to send invitations.

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

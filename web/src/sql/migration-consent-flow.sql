-- ============================================
-- CONSENT FLOW MIGRATION
-- Run this AFTER the base migration.sql
--
-- IMPORTANT: Run in TWO steps due to PostgreSQL enum limitation.
--   STEP 1: Run migration-consent-flow-step1-enums.sql (enum additions must commit first)
--   STEP 2: Run this file from section 3 onwards (everything below)
--
-- Adds tables and modifications for:
--   - QR form pages
--   - Nurse/assistant role & assignments
--   - Chat system
--   - Surgery location templates
--   - Consent review tracking
--   - Patient profiles (mobile app)
--   - Consent session enhancements
-- ============================================

-- Sections 1 & 2 (enum additions) have been moved to migration-consent-flow-step1-enums.sql
-- Run that file FIRST and let it commit before running this file.

-- ============================================
-- 3. MODIFY EXISTING TABLES
-- ============================================

-- patient_consents: add consent flow fields
ALTER TABLE patient_consents ADD COLUMN IF NOT EXISTS scanned_at timestamptz;
ALTER TABLE patient_consents ADD COLUMN IF NOT EXISTS patient_completed_at timestamptz;
ALTER TABLE patient_consents ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE patient_consents ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users;
ALTER TABLE patient_consents ADD COLUMN IF NOT EXISTS consent_version integer;
ALTER TABLE patient_consents ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- surgeon_profiles: add consent settings
ALTER TABLE surgeon_profiles ADD COLUMN IF NOT EXISTS default_consent_expiry_months integer DEFAULT 3;
ALTER TABLE surgeon_profiles ADD COLUMN IF NOT EXISTS no_scan_warning_weeks integer DEFAULT 2;

-- patients: make date_of_birth nullable (surgeons may add patients without DOB)
ALTER TABLE patients ALTER COLUMN date_of_birth DROP NOT NULL;

-- ============================================
-- 4. PATIENT PROFILES (MOBILE APP)
-- ============================================
CREATE TABLE IF NOT EXISTS patient_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  medicare_number TEXT,
  medicare_format TEXT, -- 'standard', 'dva', 'private_health'
  photo_url TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relationship TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE patient_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patient_profiles_select_own" ON patient_profiles
  FOR SELECT USING (user_id = auth.uid() OR get_user_role(auth.uid()) IN ('admin', 'surgeon', 'nurse'));
CREATE POLICY "patient_profiles_insert_own" ON patient_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "patient_profiles_update_own" ON patient_profiles
  FOR UPDATE USING (user_id = auth.uid());

-- ============================================
-- 5. QR FORM PAGES
-- ============================================
CREATE TABLE IF NOT EXISTS qr_form_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgeon_id UUID NOT NULL REFERENCES surgeon_profiles ON DELETE CASCADE,
  title TEXT NOT NULL,
  procedure_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE qr_form_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qr_form_pages_select" ON qr_form_pages
  FOR SELECT USING (
    surgeon_id IN (SELECT id FROM surgeon_profiles WHERE user_id = auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );
CREATE POLICY "qr_form_pages_insert" ON qr_form_pages
  FOR INSERT WITH CHECK (
    surgeon_id IN (SELECT id FROM surgeon_profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "qr_form_pages_update" ON qr_form_pages
  FOR UPDATE USING (
    surgeon_id IN (SELECT id FROM surgeon_profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "qr_form_pages_delete" ON qr_form_pages
  FOR DELETE USING (
    surgeon_id IN (SELECT id FROM surgeon_profiles WHERE user_id = auth.uid())
  );

-- ============================================
-- 6. NURSE-SURGEON ASSIGNMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS nurse_surgeon_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nurse_user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  surgeon_id UUID NOT NULL REFERENCES surgeon_profiles ON DELETE CASCADE,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  -- Valid permissions: 'handle_consent_sections', 'prepare_documents', 'validate_consent', 'answer_questions'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(nurse_user_id, surgeon_id)
);

ALTER TABLE nurse_surgeon_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nurse_assignments_select" ON nurse_surgeon_assignments
  FOR SELECT USING (
    nurse_user_id = auth.uid()
    OR surgeon_id IN (SELECT id FROM surgeon_profiles WHERE user_id = auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );
CREATE POLICY "nurse_assignments_insert" ON nurse_surgeon_assignments
  FOR INSERT WITH CHECK (
    surgeon_id IN (SELECT id FROM surgeon_profiles WHERE user_id = auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );
CREATE POLICY "nurse_assignments_update" ON nurse_surgeon_assignments
  FOR UPDATE USING (
    surgeon_id IN (SELECT id FROM surgeon_profiles WHERE user_id = auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );
CREATE POLICY "nurse_assignments_delete" ON nurse_surgeon_assignments
  FOR DELETE USING (
    surgeon_id IN (SELECT id FROM surgeon_profiles WHERE user_id = auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );

-- ============================================
-- 7. CONSENT CHAT SESSIONS
-- ============================================
CREATE TABLE IF NOT EXISTS consent_chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_id UUID NOT NULL REFERENCES patient_consents ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users,
  reviewed_at TIMESTAMPTZ
);

ALTER TABLE consent_chat_sessions ENABLE ROW LEVEL SECURITY;

-- Patients can see their own chat sessions; surgeons/nurses can see chats for their consents
CREATE POLICY "chat_sessions_select" ON consent_chat_sessions
  FOR SELECT USING (
    consent_id IN (
      SELECT id FROM patient_consents
      WHERE patient_id IN (SELECT id FROM patient_profiles WHERE user_id = auth.uid())
      OR surgeon_id IN (SELECT id FROM surgeon_profiles WHERE user_id = auth.uid())
    )
    OR get_user_role(auth.uid()) = 'admin'
  );
CREATE POLICY "chat_sessions_insert" ON consent_chat_sessions
  FOR INSERT WITH CHECK (
    consent_id IN (
      SELECT id FROM patient_consents
      WHERE patient_id IN (SELECT id FROM patient_profiles WHERE user_id = auth.uid())
    )
  );
CREATE POLICY "chat_sessions_update" ON consent_chat_sessions
  FOR UPDATE USING (
    consent_id IN (
      SELECT id FROM patient_consents
      WHERE surgeon_id IN (SELECT id FROM surgeon_profiles WHERE user_id = auth.uid())
    )
    OR get_user_role(auth.uid()) = 'admin'
  );

-- ============================================
-- 8. CONSENT CHAT MESSAGES
-- ============================================
CREATE TABLE IF NOT EXISTS consent_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_session_id UUID NOT NULL REFERENCES consent_chat_sessions ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('patient', 'surgeon', 'nurse')),
  message TEXT NOT NULL,
  audio_url TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE consent_chat_messages ENABLE ROW LEVEL SECURITY;

-- Same access as chat sessions
CREATE POLICY "chat_messages_select" ON consent_chat_messages
  FOR SELECT USING (
    chat_session_id IN (
      SELECT cs.id FROM consent_chat_sessions cs
      JOIN patient_consents pc ON cs.consent_id = pc.id
      WHERE pc.patient_id IN (SELECT id FROM patient_profiles WHERE user_id = auth.uid())
      OR pc.surgeon_id IN (SELECT id FROM surgeon_profiles WHERE user_id = auth.uid())
    )
    OR get_user_role(auth.uid()) = 'admin'
  );
CREATE POLICY "chat_messages_insert" ON consent_chat_messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

-- ============================================
-- 9. SURGERY LOCATION TEMPLATES
-- ============================================
CREATE TABLE IF NOT EXISTS surgery_location_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgeon_id UUID NOT NULL REFERENCES surgeon_profiles ON DELETE CASCADE,
  surgeon_procedure_id UUID REFERENCES surgeon_procedures ON DELETE SET NULL,
  location_name TEXT NOT NULL,
  location_address TEXT,
  transport_info TEXT,
  fasting_instructions TEXT,
  pre_op_instructions TEXT,
  post_op_care TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE surgery_location_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "location_templates_select" ON surgery_location_templates
  FOR SELECT USING (
    surgeon_id IN (SELECT id FROM surgeon_profiles WHERE user_id = auth.uid())
    OR get_user_role(auth.uid()) = 'admin'
  );
CREATE POLICY "location_templates_insert" ON surgery_location_templates
  FOR INSERT WITH CHECK (
    surgeon_id IN (SELECT id FROM surgeon_profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "location_templates_update" ON surgery_location_templates
  FOR UPDATE USING (
    surgeon_id IN (SELECT id FROM surgeon_profiles WHERE user_id = auth.uid())
  );
CREATE POLICY "location_templates_delete" ON surgery_location_templates
  FOR DELETE USING (
    surgeon_id IN (SELECT id FROM surgeon_profiles WHERE user_id = auth.uid())
  );

-- Add FK from patient_consents to surgery_location_templates
ALTER TABLE patient_consents ADD COLUMN IF NOT EXISTS surgery_location_id UUID REFERENCES surgery_location_templates;

-- ============================================
-- 10. CONSENT REVIEW TRACKING
-- ============================================
CREATE TABLE IF NOT EXISTS consent_review_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_id UUID NOT NULL REFERENCES patient_consents ON DELETE CASCADE,
  review_area TEXT NOT NULL,
  -- e.g., 'section:risks', 'section:benefits', 'quiz', 'chat:{session_id}', 'acknowledgments', 'signature'
  reviewed_by UUID NOT NULL REFERENCES auth.users,
  reviewed_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE consent_review_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_items_select" ON consent_review_items
  FOR SELECT USING (
    consent_id IN (
      SELECT id FROM patient_consents
      WHERE surgeon_id IN (SELECT id FROM surgeon_profiles WHERE user_id = auth.uid())
    )
    OR get_user_role(auth.uid()) = 'admin'
  );
CREATE POLICY "review_items_insert" ON consent_review_items
  FOR INSERT WITH CHECK (
    consent_id IN (
      SELECT id FROM patient_consents
      WHERE surgeon_id IN (SELECT id FROM surgeon_profiles WHERE user_id = auth.uid())
    )
    OR reviewed_by = auth.uid()
  );

-- ============================================
-- 11. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_patient_profiles_user_id ON patient_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_patient_profiles_medicare ON patient_profiles(medicare_number) WHERE medicare_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_qr_form_pages_surgeon ON qr_form_pages(surgeon_id);
CREATE INDEX IF NOT EXISTS idx_nurse_assignments_nurse ON nurse_surgeon_assignments(nurse_user_id);
CREATE INDEX IF NOT EXISTS idx_nurse_assignments_surgeon ON nurse_surgeon_assignments(surgeon_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_consent ON consent_chat_sessions(consent_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON consent_chat_messages(chat_session_id);
CREATE INDEX IF NOT EXISTS idx_location_templates_surgeon ON surgery_location_templates(surgeon_id);
CREATE INDEX IF NOT EXISTS idx_review_items_consent ON consent_review_items(consent_id);
CREATE INDEX IF NOT EXISTS idx_patient_consents_scanned ON patient_consents(scanned_at);
CREATE INDEX IF NOT EXISTS idx_patient_consents_status ON patient_consents(status);

-- ============================================
-- 12. ENABLE REALTIME FOR CHAT
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE consent_chat_messages;

-- ============================================
-- 13. UPDATE TRIGGER FOR TIMESTAMPS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_patient_profiles_updated_at BEFORE UPDATE ON patient_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_qr_form_pages_updated_at BEFORE UPDATE ON qr_form_pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_nurse_assignments_updated_at BEFORE UPDATE ON nurse_surgeon_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_location_templates_updated_at BEFORE UPDATE ON surgery_location_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

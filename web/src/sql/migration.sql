-- ConsentMaker V1 Database Migration
-- Run this in your Supabase SQL Editor

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE user_role AS ENUM ('admin', 'surgeon');
CREATE TYPE consent_status AS ENUM ('assigned', 'in_progress', 'quiz_failed', 'completed', 'withdrawn');
CREATE TYPE section_type AS ENUM ('description', 'risks', 'benefits', 'alternatives', 'before_during_after', 'recovery', 'custom');
CREATE TYPE media_type AS ENUM ('image', 'video', 'audio', 'pdf');
CREATE TYPE question_type AS ENUM ('multiple_choice', 'true_false');
CREATE TYPE signer_type AS ENUM ('patient', 'guardian');

-- ============================================
-- SPECIALTIES & MASTER PROCEDURES
-- ============================================

CREATE TABLE specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE master_procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialty_id UUID NOT NULL REFERENCES specialties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  duration_minutes INTEGER,
  recovery_time TEXT,
  risks TEXT[] NOT NULL DEFAULT '{}',
  benefits TEXT[] NOT NULL DEFAULT '{}',
  alternatives TEXT[] NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE procedure_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_procedure_id UUID NOT NULL REFERENCES master_procedures(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  duration_minutes INTEGER,
  recovery_time TEXT,
  risks TEXT[] NOT NULL DEFAULT '{}',
  benefits TEXT[] NOT NULL DEFAULT '{}',
  alternatives TEXT[] NOT NULL DEFAULT '{}',
  changed_by UUID REFERENCES auth.users(id),
  changed_by_email TEXT,
  change_reason TEXT,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger to auto-archive on update
CREATE OR REPLACE FUNCTION archive_procedure_version()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO procedure_versions (
    master_procedure_id, version, name, description,
    duration_minutes, recovery_time, risks, benefits, alternatives,
    changed_by, changed_by_email
  ) VALUES (
    OLD.id, OLD.version, OLD.name, OLD.description,
    OLD.duration_minutes, OLD.recovery_time, OLD.risks, OLD.benefits, OLD.alternatives,
    OLD.updated_by, (SELECT email FROM auth.users WHERE id = OLD.updated_by)
  );
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_archive_procedure
  BEFORE UPDATE ON master_procedures
  FOR EACH ROW
  WHEN (OLD.name IS DISTINCT FROM NEW.name
    OR OLD.description IS DISTINCT FROM NEW.description
    OR OLD.risks IS DISTINCT FROM NEW.risks
    OR OLD.benefits IS DISTINCT FROM NEW.benefits
    OR OLD.alternatives IS DISTINCT FROM NEW.alternatives
    OR OLD.duration_minutes IS DISTINCT FROM NEW.duration_minutes
    OR OLD.recovery_time IS DISTINCT FROM NEW.recovery_time)
  EXECUTE FUNCTION archive_procedure_version();

-- ============================================
-- USER PROFILES
-- ============================================

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'surgeon',
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role_val user_role;
BEGIN
  -- Safely determine role with fallback
  BEGIN
    user_role_val := (NEW.raw_user_meta_data->>'role')::user_role;
  EXCEPTION WHEN OTHERS THEN
    user_role_val := 'surgeon';
  END;

  INSERT INTO public.user_profiles (user_id, role, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(user_role_val, 'surgeon'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.email, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- SURGEON PROFILES & GROUPS
-- ============================================

CREATE TABLE surgeon_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE surgeon_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  qualifications TEXT,
  specialty_id UUID REFERENCES specialties(id),
  practice_name TEXT,
  phone TEXT,
  email TEXT NOT NULL,
  group_id UUID REFERENCES surgeon_groups(id),
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- SURGEON PROCEDURES (personal list)
-- ============================================

CREATE TABLE surgeon_procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgeon_id UUID NOT NULL REFERENCES surgeon_profiles(id) ON DELETE CASCADE,
  group_id UUID REFERENCES surgeon_groups(id),
  master_procedure_id UUID REFERENCES master_procedures(id),
  imported_version INTEGER,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  duration_minutes INTEGER,
  recovery_time TEXT,
  risks TEXT[] NOT NULL DEFAULT '{}',
  benefits TEXT[] NOT NULL DEFAULT '{}',
  alternatives TEXT[] NOT NULL DEFAULT '{}',
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- CONSENT CONTENT
-- ============================================

CREATE TABLE consent_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgeon_procedure_id UUID NOT NULL REFERENCES surgeon_procedures(id) ON DELETE CASCADE,
  section_type section_type NOT NULL,
  title TEXT NOT NULL,
  content_html TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE consent_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consent_section_id UUID NOT NULL REFERENCES consent_sections(id) ON DELETE CASCADE,
  media_type media_type NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgeon_procedure_id UUID NOT NULL REFERENCES surgeon_procedures(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type question_type NOT NULL DEFAULT 'multiple_choice',
  options JSONB NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE consent_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  surgeon_procedure_id UUID NOT NULL REFERENCES surgeon_procedures(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT true
);

-- ============================================
-- PATIENTS
-- ============================================

CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  medicare_number TEXT,
  insurance_number TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relationship TEXT,
  is_minor BOOLEAN NOT NULL DEFAULT false,
  guardian_name TEXT,
  guardian_relationship TEXT,
  guardian_phone TEXT,
  guardian_email TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- CONSENT RECORDS
-- ============================================

CREATE TABLE patient_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  surgeon_id UUID NOT NULL REFERENCES surgeon_profiles(id),
  surgeon_procedure_id UUID NOT NULL REFERENCES surgeon_procedures(id),
  procedure_version_snapshot JSONB NOT NULL DEFAULT '{}',
  status consent_status NOT NULL DEFAULT 'assigned',
  qr_code_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  withdrawal_reason TEXT,
  withdrawn_by UUID REFERENCES auth.users(id),
  is_locked BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE consent_section_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_consent_id UUID NOT NULL REFERENCES patient_consents(id) ON DELETE CASCADE,
  consent_section_id UUID NOT NULL REFERENCES consent_sections(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  flagged_too_fast BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_consent_id UUID NOT NULL REFERENCES patient_consents(id) ON DELETE CASCADE,
  score_percent NUMERIC NOT NULL DEFAULT 0,
  passed BOOLEAN NOT NULL DEFAULT false,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE quiz_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_attempt_id UUID NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES quiz_questions(id),
  selected_option JSONB,
  is_correct BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE consent_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_consent_id UUID NOT NULL REFERENCES patient_consents(id) ON DELETE CASCADE,
  signature_image_url TEXT NOT NULL,
  signer_type signer_type NOT NULL DEFAULT 'patient',
  signer_name TEXT NOT NULL,
  signer_relationship TEXT,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  device_info TEXT,
  ip_address TEXT
);

CREATE TABLE patient_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_consent_id UUID NOT NULL REFERENCES patient_consents(id) ON DELETE CASCADE,
  acknowledgment_id UUID NOT NULL REFERENCES consent_acknowledgments(id),
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_at TIMESTAMPTZ
);

CREATE TABLE consent_pdfs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_consent_id UUID NOT NULL REFERENCES patient_consents(id) ON DELETE CASCADE,
  pdf_url TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  document_hash TEXT
);

-- ============================================
-- NOTIFICATIONS & AUDIT
-- ============================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_master_procedures_specialty ON master_procedures(specialty_id);
CREATE INDEX idx_procedure_versions_procedure ON procedure_versions(master_procedure_id);
CREATE INDEX idx_surgeon_profiles_user ON surgeon_profiles(user_id);
CREATE INDEX idx_surgeon_profiles_group ON surgeon_profiles(group_id);
CREATE INDEX idx_surgeon_procedures_surgeon ON surgeon_procedures(surgeon_id);
CREATE INDEX idx_surgeon_procedures_master ON surgeon_procedures(master_procedure_id);
CREATE INDEX idx_consent_sections_procedure ON consent_sections(surgeon_procedure_id);
CREATE INDEX idx_quiz_questions_procedure ON quiz_questions(surgeon_procedure_id);
CREATE INDEX idx_patients_created_by ON patients(created_by);
CREATE INDEX idx_patient_consents_patient ON patient_consents(patient_id);
CREATE INDEX idx_patient_consents_surgeon ON patient_consents(surgeon_id);
CREATE INDEX idx_patient_consents_qr ON patient_consents(qr_code_token);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedure_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgeon_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgeon_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgeon_procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_acknowledgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_section_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_acknowledgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_pdfs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Helper function: get user role
CREATE OR REPLACE FUNCTION get_user_role(uid UUID)
RETURNS user_role AS $$
  SELECT role FROM user_profiles WHERE user_id = uid;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: get surgeon profile id
CREATE OR REPLACE FUNCTION get_surgeon_id(uid UUID)
RETURNS UUID AS $$
  SELECT id FROM surgeon_profiles WHERE user_id = uid;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- SPECIALTIES: everyone can read, admin can write
CREATE POLICY "specialties_select" ON specialties FOR SELECT USING (true);
CREATE POLICY "specialties_admin_insert" ON specialties FOR INSERT WITH CHECK (get_user_role(auth.uid()) = 'admin');
CREATE POLICY "specialties_admin_update" ON specialties FOR UPDATE USING (get_user_role(auth.uid()) = 'admin');
CREATE POLICY "specialties_admin_delete" ON specialties FOR DELETE USING (get_user_role(auth.uid()) = 'admin');

-- MASTER PROCEDURES: everyone can read, admin can write
CREATE POLICY "master_procedures_select" ON master_procedures FOR SELECT USING (true);
CREATE POLICY "master_procedures_admin_insert" ON master_procedures FOR INSERT WITH CHECK (get_user_role(auth.uid()) = 'admin');
CREATE POLICY "master_procedures_admin_update" ON master_procedures FOR UPDATE USING (get_user_role(auth.uid()) = 'admin');
CREATE POLICY "master_procedures_admin_delete" ON master_procedures FOR DELETE USING (get_user_role(auth.uid()) = 'admin');

-- PROCEDURE VERSIONS: everyone can read
CREATE POLICY "procedure_versions_select" ON procedure_versions FOR SELECT USING (true);

-- USER PROFILES: users see own, admin sees all
CREATE POLICY "user_profiles_select_own" ON user_profiles FOR SELECT USING (user_id = auth.uid() OR get_user_role(auth.uid()) = 'admin');
CREATE POLICY "user_profiles_update_own" ON user_profiles FOR UPDATE USING (user_id = auth.uid() OR get_user_role(auth.uid()) = 'admin');

-- SURGEON PROFILES: surgeon sees own + group members, admin sees all
-- Note: avoid circular subquery on surgeon_profiles itself; use direct user_id check
CREATE POLICY "surgeon_profiles_select" ON surgeon_profiles FOR SELECT USING (
  user_id = auth.uid()
  OR get_user_role(auth.uid()) = 'admin'
);
CREATE POLICY "surgeon_profiles_insert" ON surgeon_profiles FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "surgeon_profiles_update" ON surgeon_profiles FOR UPDATE USING (user_id = auth.uid() OR get_user_role(auth.uid()) = 'admin');

-- SURGEON GROUPS: members can read, creator can update
CREATE POLICY "surgeon_groups_select" ON surgeon_groups FOR SELECT USING (
  id IN (SELECT group_id FROM surgeon_profiles WHERE user_id = auth.uid())
  OR get_user_role(auth.uid()) = 'admin'
);
CREATE POLICY "surgeon_groups_insert" ON surgeon_groups FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "surgeon_groups_update" ON surgeon_groups FOR UPDATE USING (created_by = auth.uid() OR get_user_role(auth.uid()) = 'admin');

-- SURGEON PROCEDURES: surgeon sees own + group shared
CREATE POLICY "surgeon_procedures_select" ON surgeon_procedures FOR SELECT USING (
  surgeon_id = get_surgeon_id(auth.uid())
  OR group_id IN (SELECT group_id FROM surgeon_profiles WHERE user_id = auth.uid())
  OR get_user_role(auth.uid()) = 'admin'
);
CREATE POLICY "surgeon_procedures_insert" ON surgeon_procedures FOR INSERT WITH CHECK (
  surgeon_id IN (SELECT id FROM surgeon_profiles WHERE user_id = auth.uid())
);
CREATE POLICY "surgeon_procedures_update" ON surgeon_procedures FOR UPDATE USING (
  surgeon_id IN (SELECT id FROM surgeon_profiles WHERE user_id = auth.uid())
);
CREATE POLICY "surgeon_procedures_delete" ON surgeon_procedures FOR DELETE USING (
  surgeon_id IN (SELECT id FROM surgeon_profiles WHERE user_id = auth.uid())
);

-- CONSENT SECTIONS: tied to surgeon_procedures access
CREATE POLICY "consent_sections_select" ON consent_sections FOR SELECT USING (
  surgeon_procedure_id IN (
    SELECT id FROM surgeon_procedures WHERE surgeon_id = get_surgeon_id(auth.uid())
    UNION SELECT id FROM surgeon_procedures WHERE group_id IN (SELECT group_id FROM surgeon_profiles WHERE user_id = auth.uid())
  ) OR get_user_role(auth.uid()) = 'admin'
);
CREATE POLICY "consent_sections_insert" ON consent_sections FOR INSERT WITH CHECK (
  surgeon_procedure_id IN (SELECT id FROM surgeon_procedures WHERE surgeon_id = get_surgeon_id(auth.uid()))
);
CREATE POLICY "consent_sections_update" ON consent_sections FOR UPDATE USING (
  surgeon_procedure_id IN (SELECT id FROM surgeon_procedures WHERE surgeon_id = get_surgeon_id(auth.uid()))
);
CREATE POLICY "consent_sections_delete" ON consent_sections FOR DELETE USING (
  surgeon_procedure_id IN (SELECT id FROM surgeon_procedures WHERE surgeon_id = get_surgeon_id(auth.uid()))
);

-- CONSENT MEDIA: same as sections
CREATE POLICY "consent_media_select" ON consent_media FOR SELECT USING (
  consent_section_id IN (
    SELECT cs.id FROM consent_sections cs
    JOIN surgeon_procedures sp ON cs.surgeon_procedure_id = sp.id
    WHERE sp.surgeon_id = get_surgeon_id(auth.uid())
  ) OR get_user_role(auth.uid()) = 'admin'
);
CREATE POLICY "consent_media_insert" ON consent_media FOR INSERT WITH CHECK (
  consent_section_id IN (
    SELECT cs.id FROM consent_sections cs
    JOIN surgeon_procedures sp ON cs.surgeon_procedure_id = sp.id
    WHERE sp.surgeon_id = get_surgeon_id(auth.uid())
  )
);
CREATE POLICY "consent_media_delete" ON consent_media FOR DELETE USING (
  consent_section_id IN (
    SELECT cs.id FROM consent_sections cs
    JOIN surgeon_procedures sp ON cs.surgeon_procedure_id = sp.id
    WHERE sp.surgeon_id = get_surgeon_id(auth.uid())
  )
);

-- QUIZ QUESTIONS: same pattern
CREATE POLICY "quiz_questions_select" ON quiz_questions FOR SELECT USING (
  surgeon_procedure_id IN (
    SELECT id FROM surgeon_procedures WHERE surgeon_id = get_surgeon_id(auth.uid())
  ) OR get_user_role(auth.uid()) = 'admin'
);
CREATE POLICY "quiz_questions_insert" ON quiz_questions FOR INSERT WITH CHECK (
  surgeon_procedure_id IN (SELECT id FROM surgeon_procedures WHERE surgeon_id = get_surgeon_id(auth.uid()))
);
CREATE POLICY "quiz_questions_update" ON quiz_questions FOR UPDATE USING (
  surgeon_procedure_id IN (SELECT id FROM surgeon_procedures WHERE surgeon_id = get_surgeon_id(auth.uid()))
);
CREATE POLICY "quiz_questions_delete" ON quiz_questions FOR DELETE USING (
  surgeon_procedure_id IN (SELECT id FROM surgeon_procedures WHERE surgeon_id = get_surgeon_id(auth.uid()))
);

-- CONSENT ACKNOWLEDGMENTS: same pattern
CREATE POLICY "consent_ack_select" ON consent_acknowledgments FOR SELECT USING (
  surgeon_procedure_id IN (
    SELECT id FROM surgeon_procedures WHERE surgeon_id = get_surgeon_id(auth.uid())
  ) OR get_user_role(auth.uid()) = 'admin'
);
CREATE POLICY "consent_ack_insert" ON consent_acknowledgments FOR INSERT WITH CHECK (
  surgeon_procedure_id IN (SELECT id FROM surgeon_procedures WHERE surgeon_id = get_surgeon_id(auth.uid()))
);
CREATE POLICY "consent_ack_update" ON consent_acknowledgments FOR UPDATE USING (
  surgeon_procedure_id IN (SELECT id FROM surgeon_procedures WHERE surgeon_id = get_surgeon_id(auth.uid()))
);
CREATE POLICY "consent_ack_delete" ON consent_acknowledgments FOR DELETE USING (
  surgeon_procedure_id IN (SELECT id FROM surgeon_procedures WHERE surgeon_id = get_surgeon_id(auth.uid()))
);

-- PATIENTS: surgeon sees patients they created
CREATE POLICY "patients_select" ON patients FOR SELECT USING (created_by = auth.uid() OR get_user_role(auth.uid()) = 'admin');
CREATE POLICY "patients_insert" ON patients FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "patients_update" ON patients FOR UPDATE USING (created_by = auth.uid() OR get_user_role(auth.uid()) = 'admin');

-- PATIENT CONSENTS: surgeon sees own, locked records cannot be updated
CREATE POLICY "patient_consents_select" ON patient_consents FOR SELECT USING (
  surgeon_id = get_surgeon_id(auth.uid()) OR get_user_role(auth.uid()) = 'admin'
);
CREATE POLICY "patient_consents_insert" ON patient_consents FOR INSERT WITH CHECK (
  surgeon_id = get_surgeon_id(auth.uid())
);
CREATE POLICY "patient_consents_update" ON patient_consents FOR UPDATE USING (
  surgeon_id = get_surgeon_id(auth.uid()) AND is_locked = false
);

-- CONSENT SECTION PROGRESS: tied to consent access
CREATE POLICY "section_progress_select" ON consent_section_progress FOR SELECT USING (
  patient_consent_id IN (SELECT id FROM patient_consents WHERE surgeon_id = get_surgeon_id(auth.uid()))
  OR get_user_role(auth.uid()) = 'admin'
);

-- QUIZ ATTEMPTS: tied to consent access
CREATE POLICY "quiz_attempts_select" ON quiz_attempts FOR SELECT USING (
  patient_consent_id IN (SELECT id FROM patient_consents WHERE surgeon_id = get_surgeon_id(auth.uid()))
  OR get_user_role(auth.uid()) = 'admin'
);

-- QUIZ RESPONSES: tied to attempt access
CREATE POLICY "quiz_responses_select" ON quiz_responses FOR SELECT USING (
  quiz_attempt_id IN (
    SELECT qa.id FROM quiz_attempts qa
    JOIN patient_consents pc ON qa.patient_consent_id = pc.id
    WHERE pc.surgeon_id = get_surgeon_id(auth.uid())
  ) OR get_user_role(auth.uid()) = 'admin'
);

-- SIGNATURES: tied to consent access
CREATE POLICY "signatures_select" ON consent_signatures FOR SELECT USING (
  patient_consent_id IN (SELECT id FROM patient_consents WHERE surgeon_id = get_surgeon_id(auth.uid()))
  OR get_user_role(auth.uid()) = 'admin'
);

-- PATIENT ACKNOWLEDGMENTS: tied to consent access
CREATE POLICY "patient_ack_select" ON patient_acknowledgments FOR SELECT USING (
  patient_consent_id IN (SELECT id FROM patient_consents WHERE surgeon_id = get_surgeon_id(auth.uid()))
  OR get_user_role(auth.uid()) = 'admin'
);

-- CONSENT PDFS: tied to consent access
CREATE POLICY "consent_pdfs_select" ON consent_pdfs FOR SELECT USING (
  patient_consent_id IN (SELECT id FROM patient_consents WHERE surgeon_id = get_surgeon_id(auth.uid()))
  OR get_user_role(auth.uid()) = 'admin'
);

-- NOTIFICATIONS: user sees own
CREATE POLICY "notifications_select" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications_update" ON notifications FOR UPDATE USING (user_id = auth.uid());

-- AUDIT LOG: admin only
CREATE POLICY "audit_log_select" ON audit_log FOR SELECT USING (get_user_role(auth.uid()) = 'admin');
CREATE POLICY "audit_log_insert" ON audit_log FOR INSERT WITH CHECK (true);

-- ============================================
-- SEED DATA: Specialties & Operations
-- ============================================

INSERT INTO specialties (name, description, sort_order) VALUES
  ('General Surgery', 'Surgical procedures involving the abdomen, digestive tract, endocrine system, and soft tissues', 1),
  ('Cardiac Surgery', 'Surgical procedures on the heart and great vessels', 2),
  ('Orthopaedic Surgery', 'Surgical procedures on the musculoskeletal system', 3),
  ('Breast and Endocrine Surgery', 'Surgical procedures on the breast, thyroid, parathyroid, and adrenal glands', 4),
  ('Urologic Surgery', 'Surgical procedures on the urinary tract and male reproductive system', 5);

-- General Surgery
INSERT INTO master_procedures (specialty_id, name, description, duration_minutes, recovery_time, risks, benefits, alternatives) VALUES
  ((SELECT id FROM specialties WHERE name = 'General Surgery'), 'Appendectomy', 'Surgical removal of the appendix, typically performed for acute appendicitis.', 60, '2-4 weeks', ARRAY['Bleeding', 'Infection', 'Injury to nearby organs', 'Abscess formation', 'Wound dehiscence'], ARRAY['Resolution of appendicitis', 'Prevention of perforation and peritonitis', 'Rapid return to normal activities'], ARRAY['Antibiotic therapy alone (selected cases)', 'Interval appendectomy']),
  ((SELECT id FROM specialties WHERE name = 'General Surgery'), 'Open Cholecystectomy', 'Surgical removal of the gallbladder through an open abdominal incision.', 90, '4-6 weeks', ARRAY['Bleeding', 'Infection', 'Bile duct injury', 'Bile leak', 'DVT/PE', 'Retained bile duct stones'], ARRAY['Definitive treatment of gallstone disease', 'Relief of biliary symptoms', 'Prevention of complications'], ARRAY['Laparoscopic cholecystectomy', 'Endoscopic stone removal', 'Conservative management']),
  ((SELECT id FROM specialties WHERE name = 'General Surgery'), 'Laparoscopic Cholecystectomy', 'Minimally invasive surgical removal of the gallbladder using a laparoscope.', 60, '1-2 weeks', ARRAY['Bleeding', 'Infection', 'Bile duct injury', 'Bile leak', 'Conversion to open surgery', 'Port-site hernia'], ARRAY['Smaller incisions and less scarring', 'Faster recovery', 'Less postoperative pain', 'Shorter hospital stay'], ARRAY['Open cholecystectomy', 'Endoscopic stone removal', 'Conservative management']),
  ((SELECT id FROM specialties WHERE name = 'General Surgery'), 'Hernia Repair (Inguinal)', 'Surgical repair of an inguinal hernia, either open or laparoscopic approach.', 75, '2-4 weeks', ARRAY['Bleeding', 'Infection', 'Chronic pain', 'Recurrence', 'Mesh infection', 'Nerve damage', 'Urinary retention'], ARRAY['Relief of pain and discomfort', 'Prevention of incarceration and strangulation', 'Return to normal activities'], ARRAY['Watchful waiting', 'Truss support', 'Laparoscopic vs open approach']),
  ((SELECT id FROM specialties WHERE name = 'General Surgery'), 'Colon Resection', 'Surgical removal of a portion of the colon, performed for cancer, diverticular disease, or other conditions.', 180, '6-8 weeks', ARRAY['Bleeding', 'Infection', 'Anastomotic leak', 'Ileus', 'DVT/PE', 'Wound dehiscence', 'Stoma formation'], ARRAY['Removal of diseased segment', 'Cancer treatment or prevention', 'Resolution of symptoms'], ARRAY['Endoscopic management', 'Radiation therapy', 'Chemotherapy', 'Conservative management']),
  ((SELECT id FROM specialties WHERE name = 'General Surgery'), 'Thyroidectomy', 'Surgical removal of all or part of the thyroid gland.', 120, '2-3 weeks', ARRAY['Bleeding', 'Infection', 'Recurrent laryngeal nerve injury', 'Hypoparathyroidism', 'Hypothyroidism', 'Voice changes', 'Scarring'], ARRAY['Definitive treatment of thyroid disease', 'Cancer removal', 'Relief of compressive symptoms'], ARRAY['Radioactive iodine therapy', 'Medication management', 'Active surveillance']);

-- Cardiac Surgery
INSERT INTO master_procedures (specialty_id, name, description, duration_minutes, recovery_time, risks, benefits, alternatives) VALUES
  ((SELECT id FROM specialties WHERE name = 'Cardiac Surgery'), 'Coronary Artery Bypass Grafting (CABG)', 'Surgical procedure to improve blood flow to the heart using grafted blood vessels to bypass blocked coronary arteries.', 240, '6-12 weeks', ARRAY['Bleeding', 'Infection', 'Stroke', 'Heart attack', 'Arrhythmia', 'Kidney failure', 'Graft failure', 'Sternal wound complications'], ARRAY['Improved blood flow to the heart', 'Relief of angina', 'Improved survival in severe disease', 'Improved quality of life'], ARRAY['Percutaneous coronary intervention (PCI/stent)', 'Medical management', 'Lifestyle modification']),
  ((SELECT id FROM specialties WHERE name = 'Cardiac Surgery'), 'Heart Valve Replacement', 'Surgical replacement of a diseased heart valve with a mechanical or biological prosthetic valve.', 210, '8-12 weeks', ARRAY['Bleeding', 'Infection', 'Stroke', 'Valve thrombosis', 'Endocarditis', 'Heart block requiring pacemaker', 'Paravalvular leak'], ARRAY['Restoration of normal valve function', 'Relief of symptoms', 'Prevention of heart failure', 'Improved survival'], ARRAY['Valve repair', 'Transcatheter valve replacement (TAVR)', 'Medical management']),
  ((SELECT id FROM specialties WHERE name = 'Cardiac Surgery'), 'Aortic Aneurysm Repair', 'Surgical repair of a dilated section of the aorta to prevent rupture.', 240, '8-12 weeks', ARRAY['Bleeding', 'Infection', 'Stroke', 'Paraplegia', 'Kidney failure', 'Graft infection', 'Endoleak'], ARRAY['Prevention of aortic rupture', 'Elimination of aneurysm', 'Life-saving in emergency setting'], ARRAY['Endovascular repair (EVAR)', 'Surveillance monitoring', 'Medical management']),
  ((SELECT id FROM specialties WHERE name = 'Cardiac Surgery'), 'Atrial Septal Defect (ASD) Repair', 'Surgical closure of an abnormal opening between the upper chambers of the heart.', 150, '4-6 weeks', ARRAY['Bleeding', 'Infection', 'Arrhythmia', 'Residual shunt', 'Pericardial effusion', 'Heart block'], ARRAY['Closure of heart defect', 'Prevention of right heart failure', 'Reduction of stroke risk', 'Improved exercise tolerance'], ARRAY['Transcatheter closure', 'Medical management and monitoring']),
  ((SELECT id FROM specialties WHERE name = 'Cardiac Surgery'), 'Pacemaker Implantation', 'Surgical implantation of a device that uses electrical impulses to regulate heart rhythm.', 60, '2-4 weeks', ARRAY['Bleeding', 'Infection', 'Pneumothorax', 'Lead displacement', 'Device malfunction', 'Cardiac perforation', 'Venous thrombosis'], ARRAY['Restoration of normal heart rhythm', 'Prevention of syncope', 'Improved quality of life', 'Life-saving in complete heart block'], ARRAY['Medication management', 'Implantable cardioverter-defibrillator (ICD)', 'Watchful waiting']);

-- Orthopaedic Surgery
INSERT INTO master_procedures (specialty_id, name, description, duration_minutes, recovery_time, risks, benefits, alternatives) VALUES
  ((SELECT id FROM specialties WHERE name = 'Orthopaedic Surgery'), 'Total Hip Replacement', 'Surgical replacement of the hip joint with an artificial prosthesis.', 120, '6-12 weeks', ARRAY['Bleeding', 'Infection', 'DVT/PE', 'Dislocation', 'Leg length discrepancy', 'Nerve damage', 'Implant loosening', 'Fracture'], ARRAY['Pain relief', 'Improved mobility', 'Improved quality of life', 'Restoration of function'], ARRAY['Conservative management (physiotherapy)', 'Pain medication', 'Hip resurfacing', 'Partial hip replacement']),
  ((SELECT id FROM specialties WHERE name = 'Orthopaedic Surgery'), 'Total Knee Replacement', 'Surgical replacement of the knee joint with an artificial prosthesis.', 120, '6-12 weeks', ARRAY['Bleeding', 'Infection', 'DVT/PE', 'Stiffness', 'Nerve damage', 'Implant loosening', 'Instability', 'Persistent pain'], ARRAY['Pain relief', 'Improved mobility and function', 'Correction of deformity', 'Improved quality of life'], ARRAY['Conservative management', 'Partial knee replacement', 'Osteotomy', 'Arthroscopic surgery']),
  ((SELECT id FROM specialties WHERE name = 'Orthopaedic Surgery'), 'ACL Reconstruction', 'Surgical reconstruction of the anterior cruciate ligament using a graft.', 90, '6-9 months', ARRAY['Bleeding', 'Infection', 'Graft failure', 'Stiffness', 'DVT/PE', 'Nerve damage', 'Donor site morbidity', 'Residual instability'], ARRAY['Restoration of knee stability', 'Return to sport', 'Prevention of further meniscal damage', 'Improved function'], ARRAY['Conservative management and rehabilitation', 'Activity modification', 'Knee brace']),
  ((SELECT id FROM specialties WHERE name = 'Orthopaedic Surgery'), 'Spinal Fusion', 'Surgical procedure to permanently connect two or more vertebrae to eliminate motion between them.', 180, '3-6 months', ARRAY['Bleeding', 'Infection', 'Nerve damage', 'Non-union (pseudarthrosis)', 'Hardware failure', 'Adjacent segment disease', 'DVT/PE', 'Dural tear'], ARRAY['Pain relief', 'Spinal stability', 'Correction of deformity', 'Prevention of neurological deterioration'], ARRAY['Conservative management', 'Spinal injections', 'Physiotherapy', 'Disc replacement']),
  ((SELECT id FROM specialties WHERE name = 'Orthopaedic Surgery'), 'Rotator Cuff Repair', 'Surgical repair of torn tendons in the shoulder rotator cuff.', 90, '4-6 months', ARRAY['Bleeding', 'Infection', 'Stiffness', 'Re-tear', 'Nerve damage', 'DVT/PE', 'Anchor failure'], ARRAY['Pain relief', 'Restoration of strength', 'Improved range of motion', 'Return to activities'], ARRAY['Conservative management', 'Physiotherapy', 'Corticosteroid injections', 'Partial repair']);

-- Breast and Endocrine Surgery
INSERT INTO master_procedures (specialty_id, name, description, duration_minutes, recovery_time, risks, benefits, alternatives) VALUES
  ((SELECT id FROM specialties WHERE name = 'Breast and Endocrine Surgery'), 'Lumpectomy', 'Surgical removal of a breast lump and surrounding margin of tissue, typically for breast cancer.', 60, '2-3 weeks', ARRAY['Bleeding', 'Infection', 'Seroma', 'Changes in breast shape', 'Positive margins requiring re-excision', 'Lymphoedema', 'Numbness'], ARRAY['Breast conservation', 'Cancer removal with tissue preservation', 'Comparable survival to mastectomy with radiation', 'Better cosmetic outcome'], ARRAY['Mastectomy', 'Active surveillance', 'Neoadjuvant chemotherapy']),
  ((SELECT id FROM specialties WHERE name = 'Breast and Endocrine Surgery'), 'Mastectomy', 'Surgical removal of the entire breast, typically for breast cancer treatment or risk reduction.', 120, '4-6 weeks', ARRAY['Bleeding', 'Infection', 'Seroma', 'Phantom breast sensation', 'Lymphoedema', 'Skin flap necrosis', 'Chronic pain', 'Psychological impact'], ARRAY['Complete removal of breast tissue', 'Reduced local recurrence risk', 'Definitive treatment', 'Option for immediate reconstruction'], ARRAY['Lumpectomy with radiation', 'Neoadjuvant chemotherapy', 'Active surveillance']),
  ((SELECT id FROM specialties WHERE name = 'Breast and Endocrine Surgery'), 'Parathyroidectomy', 'Surgical removal of one or more parathyroid glands for hyperparathyroidism.', 90, '1-2 weeks', ARRAY['Bleeding', 'Infection', 'Recurrent laryngeal nerve injury', 'Hypocalcaemia', 'Persistent hyperparathyroidism', 'Haematoma'], ARRAY['Normalisation of calcium levels', 'Prevention of osteoporosis and kidney stones', 'Symptom relief', 'Prevention of complications'], ARRAY['Medical management (cinacalcet)', 'Monitoring and surveillance']),
  ((SELECT id FROM specialties WHERE name = 'Breast and Endocrine Surgery'), 'Sentinel Lymph Node Biopsy', 'Surgical identification and removal of the first lymph node(s) to which cancer is likely to spread.', 45, '1-2 weeks', ARRAY['Bleeding', 'Infection', 'Lymphoedema', 'Allergic reaction to dye', 'Seroma', 'Nerve damage', 'False negative result'], ARRAY['Accurate staging of cancer', 'Avoidance of full axillary dissection', 'Lower morbidity than full dissection', 'Guides treatment decisions'], ARRAY['Axillary lymph node dissection', 'Clinical observation', 'Imaging surveillance']),
  ((SELECT id FROM specialties WHERE name = 'Breast and Endocrine Surgery'), 'Adrenalectomy', 'Surgical removal of one or both adrenal glands, often performed laparoscopically.', 120, '2-4 weeks', ARRAY['Bleeding', 'Infection', 'Adrenal insufficiency', 'Injury to surrounding organs', 'DVT/PE', 'Conversion to open surgery'], ARRAY['Removal of adrenal tumour', 'Resolution of hormonal excess', 'Cancer treatment', 'Prevention of complications'], ARRAY['Medical management', 'Active surveillance', 'Radiation therapy']);

-- Urologic Surgery
INSERT INTO master_procedures (specialty_id, name, description, duration_minutes, recovery_time, risks, benefits, alternatives) VALUES
  ((SELECT id FROM specialties WHERE name = 'Urologic Surgery'), 'Transurethral Resection of Prostate (TURP)', 'Endoscopic surgical procedure to remove obstructing prostate tissue causing urinary symptoms.', 60, '2-4 weeks', ARRAY['Bleeding', 'Infection', 'TUR syndrome', 'Retrograde ejaculation', 'Urinary incontinence', 'Urethral stricture', 'Bladder neck contracture'], ARRAY['Improved urinary flow', 'Relief of obstruction', 'Reduced urinary symptoms', 'No external incision'], ARRAY['Medication (alpha-blockers, 5-ARI)', 'Laser prostatectomy', 'UroLift', 'Rezum therapy', 'Open prostatectomy']),
  ((SELECT id FROM specialties WHERE name = 'Urologic Surgery'), 'Radical Prostatectomy', 'Surgical removal of the entire prostate gland and seminal vesicles for prostate cancer.', 180, '4-6 weeks', ARRAY['Bleeding', 'Infection', 'Urinary incontinence', 'Erectile dysfunction', 'Bladder neck contracture', 'DVT/PE', 'Lymphocele', 'Rectal injury'], ARRAY['Cancer removal', 'Accurate pathological staging', 'Potential cure for localised cancer', 'Elimination of PSA'], ARRAY['Active surveillance', 'Radiation therapy', 'Hormone therapy', 'Focal therapy']),
  ((SELECT id FROM specialties WHERE name = 'Urologic Surgery'), 'Nephrectomy', 'Surgical removal of a kidney, either partial or radical, for cancer or other conditions.', 150, '4-6 weeks', ARRAY['Bleeding', 'Infection', 'DVT/PE', 'Injury to adjacent organs', 'Urine leak (partial)', 'Renal insufficiency', 'Pneumothorax'], ARRAY['Cancer removal', 'Preservation of renal function (partial)', 'Definitive treatment', 'Relief of symptoms'], ARRAY['Active surveillance', 'Ablation therapy', 'Partial nephrectomy vs radical']),
  ((SELECT id FROM specialties WHERE name = 'Urologic Surgery'), 'Cystectomy', 'Surgical removal of the bladder, typically for invasive bladder cancer, with urinary diversion.', 300, '6-8 weeks', ARRAY['Bleeding', 'Infection', 'DVT/PE', 'Ileus', 'Ureteric stricture', 'Stomal complications', 'Sexual dysfunction', 'Metabolic complications'], ARRAY['Cancer removal', 'Potential cure for invasive cancer', 'Multiple reconstruction options', 'Improved survival'], ARRAY['Chemoradiation (bladder-sparing)', 'Intravesical therapy', 'Partial cystectomy']),
  ((SELECT id FROM specialties WHERE name = 'Urologic Surgery'), 'Ureteroscopy with Laser Lithotripsy', 'Endoscopic procedure to fragment and remove kidney or ureteric stones using laser energy.', 60, '1-2 weeks', ARRAY['Bleeding', 'Infection', 'Ureteric injury', 'Ureteric stricture', 'Stone migration', 'Stent discomfort', 'Incomplete stone clearance'], ARRAY['Stone removal without incision', 'High success rate', 'Treatment of stones in any location', 'Same-day procedure'], ARRAY['Extracorporeal shock wave lithotripsy (ESWL)', 'Percutaneous nephrolithotomy', 'Medical expulsive therapy', 'Observation']);

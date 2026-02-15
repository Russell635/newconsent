export type UserRole = 'admin' | 'surgeon' | 'manager' | 'nurse';
export type ProcedureStatus = 'active' | 'archived';
export type ConsentStatus = 'assigned' | 'not_started' | 'in_progress' | 'patient_completed' | 'under_review' | 'quiz_failed' | 'completed' | 'valid' | 'withdrawn';
export type SectionType = 'description' | 'risks' | 'benefits' | 'alternatives' | 'before_during_after' | 'recovery' | 'custom';
export type MediaType = 'image' | 'video' | 'audio' | 'pdf';
export type QuestionType = 'multiple_choice' | 'true_false';
export type SignerType = 'patient' | 'guardian';
export type StaffRole = 'manager' | 'nurse';
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export type ManagerPermission =
  | 'manage_staff'
  | 'manage_patients'
  | 'manage_locations'
  | 'view_consents'
  | 'prepare_documents'
  | 'answer_questions'
  | 'validate_consent';

export type NursePermission =
  | 'handle_consent_sections'
  | 'prepare_documents'
  | 'validate_consent'
  | 'answer_questions';

export type StaffPermission = ManagerPermission | NursePermission;

export interface Specialty {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface MasterProcedure {
  id: string;
  specialty_id: string;
  name: string;
  description: string;
  duration_minutes: number | null;
  recovery_time: string | null;
  risks: string[];
  benefits: string[];
  alternatives: string[];
  version: number;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  // joined
  specialty?: Specialty;
}

export interface ProcedureVersion {
  id: string;
  master_procedure_id: string;
  version: number;
  name: string;
  description: string;
  duration_minutes: number | null;
  recovery_time: string | null;
  risks: string[];
  benefits: string[];
  alternatives: string[];
  changed_by: string | null;
  changed_by_email: string | null;
  change_reason: string | null;
  archived_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  role: UserRole;
  full_name: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface SurgeonProfile {
  id: string;
  user_id: string;
  full_name: string;
  qualifications: string | null;
  specialty_id: string | null;
  practice_name: string | null;
  phone: string | null;
  email: string;
  group_id: string | null;
  onboarding_complete: boolean;
  created_at: string;
  // joined
  specialty?: Specialty;
  group?: SurgeonGroup;
}

export interface SurgeonGroup {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

export interface SurgeonProcedure {
  id: string;
  surgeon_id: string;
  group_id: string | null;
  master_procedure_id: string | null;
  imported_version: number | null;
  name: string;
  description: string;
  duration_minutes: number | null;
  recovery_time: string | null;
  risks: string[];
  benefits: string[];
  alternatives: string[];
  is_custom: boolean;
  created_at: string;
  updated_at: string;
  // joined
  master_procedure?: MasterProcedure;
}

export interface ConsentSection {
  id: string;
  surgeon_procedure_id: string;
  section_type: SectionType;
  title: string;
  content_html: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // joined
  media?: ConsentMedia[];
}

export interface ConsentMedia {
  id: string;
  consent_section_id: string;
  media_type: MediaType;
  file_url: string;
  file_name: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
}

export interface QuizQuestion {
  id: string;
  surgeon_procedure_id: string;
  question_text: string;
  question_type: QuestionType;
  options: QuizOption[];
  sort_order: number;
  created_at: string;
}

export interface QuizOption {
  text: string;
  is_correct: boolean;
}

export interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  medicare_number: string | null;
  insurance_number: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  is_minor: boolean;
  guardian_name: string | null;
  guardian_relationship: string | null;
  guardian_phone: string | null;
  guardian_email: string | null;
  created_by: string;
  created_at: string;
}

export interface PatientConsent {
  id: string;
  patient_id: string;
  surgeon_id: string;
  surgeon_procedure_id: string;
  procedure_version_snapshot: Record<string, unknown>;
  status: ConsentStatus;
  qr_code_token: string;
  assigned_at: string;
  started_at: string | null;
  completed_at: string | null;
  withdrawn_at: string | null;
  withdrawal_reason: string | null;
  withdrawn_by: string | null;
  is_locked: boolean;
  // joined
  patient?: Patient;
  surgeon_procedure?: SurgeonProcedure;
}

export interface ConsentSectionProgress {
  id: string;
  patient_consent_id: string;
  consent_section_id: string;
  started_at: string | null;
  completed_at: string | null;
  time_spent_seconds: number;
  flagged_too_fast: boolean;
}

export interface QuizAttempt {
  id: string;
  patient_consent_id: string;
  score_percent: number;
  passed: boolean;
  attempted_at: string;
}

export interface ConsentSignature {
  id: string;
  patient_consent_id: string;
  signature_image_url: string;
  signer_type: SignerType;
  signer_name: string;
  signer_relationship: string | null;
  signed_at: string;
  device_info: string | null;
  ip_address: string | null;
}

export interface ConsentAcknowledgment {
  id: string;
  surgeon_procedure_id: string;
  text: string;
  sort_order: number;
  is_required: boolean;
}

export interface ConsentPdf {
  id: string;
  patient_consent_id: string;
  pdf_url: string;
  generated_at: string;
  document_hash: string | null;
}

export interface StaffAssignment {
  id: string;
  staff_user_id: string;
  surgeon_id: string;
  staff_role: StaffRole;
  permissions: StaffPermission[];
  invited_by: string | null;
  invitation_status: InvitationStatus;
  invited_at: string;
  accepted_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // joined
  surgeon_profile?: SurgeonProfile;
  staff_profile?: UserProfile;
}

export interface Notification {
  id: string;
  user_id: string;
  sender_id: string | null;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  read: boolean;
  action_type: string | null;
  action_data: Record<string, unknown> | null;
  action_taken: boolean;
  action_taken_at: string | null;
  created_at: string;
  // joined
  sender_profile?: { full_name: string; email: string; role: string };
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

// Supabase Database type for typed client
export interface Database {
  public: {
    Tables: {
      specialties: { Row: Specialty; Insert: Omit<Specialty, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Specialty, 'id'>> };
      master_procedures: { Row: MasterProcedure; Insert: Omit<MasterProcedure, 'id' | 'created_at' | 'updated_at' | 'version' | 'specialty'>; Update: Partial<Omit<MasterProcedure, 'id' | 'specialty'>> };
      procedure_versions: { Row: ProcedureVersion; Insert: Omit<ProcedureVersion, 'id'>; Update: Partial<Omit<ProcedureVersion, 'id'>> };
      user_profiles: { Row: UserProfile; Insert: Omit<UserProfile, 'id' | 'created_at'>; Update: Partial<Omit<UserProfile, 'id'>> };
      surgeon_profiles: { Row: SurgeonProfile; Insert: Omit<SurgeonProfile, 'id' | 'created_at' | 'specialty' | 'group'>; Update: Partial<Omit<SurgeonProfile, 'id' | 'specialty' | 'group'>> };
      surgeon_groups: { Row: SurgeonGroup; Insert: Omit<SurgeonGroup, 'id' | 'created_at'>; Update: Partial<Omit<SurgeonGroup, 'id'>> };
      surgeon_procedures: { Row: SurgeonProcedure; Insert: Omit<SurgeonProcedure, 'id' | 'created_at' | 'updated_at' | 'master_procedure'>; Update: Partial<Omit<SurgeonProcedure, 'id' | 'master_procedure'>> };
      consent_sections: { Row: ConsentSection; Insert: Omit<ConsentSection, 'id' | 'created_at' | 'updated_at' | 'media'>; Update: Partial<Omit<ConsentSection, 'id' | 'media'>> };
      consent_media: { Row: ConsentMedia; Insert: Omit<ConsentMedia, 'id' | 'created_at'>; Update: Partial<Omit<ConsentMedia, 'id'>> };
      quiz_questions: { Row: QuizQuestion; Insert: Omit<QuizQuestion, 'id' | 'created_at'>; Update: Partial<Omit<QuizQuestion, 'id'>> };
      patients: { Row: Patient; Insert: Omit<Patient, 'id' | 'created_at'>; Update: Partial<Omit<Patient, 'id'>> };
      patient_consents: { Row: PatientConsent; Insert: Omit<PatientConsent, 'id' | 'patient' | 'surgeon_procedure'>; Update: Partial<Omit<PatientConsent, 'id' | 'patient' | 'surgeon_procedure'>> };
      consent_section_progress: { Row: ConsentSectionProgress; Insert: Omit<ConsentSectionProgress, 'id'>; Update: Partial<Omit<ConsentSectionProgress, 'id'>> };
      quiz_attempts: { Row: QuizAttempt; Insert: Omit<QuizAttempt, 'id'>; Update: Partial<Omit<QuizAttempt, 'id'>> };
      consent_signatures: { Row: ConsentSignature; Insert: Omit<ConsentSignature, 'id'>; Update: Partial<Omit<ConsentSignature, 'id'>> };
      consent_acknowledgments: { Row: ConsentAcknowledgment; Insert: Omit<ConsentAcknowledgment, 'id'>; Update: Partial<Omit<ConsentAcknowledgment, 'id'>> };
      consent_pdfs: { Row: ConsentPdf; Insert: Omit<ConsentPdf, 'id'>; Update: Partial<Omit<ConsentPdf, 'id'>> };
      staff_assignments: { Row: StaffAssignment; Insert: Omit<StaffAssignment, 'id' | 'created_at' | 'updated_at' | 'surgeon_profile' | 'staff_profile'>; Update: Partial<Omit<StaffAssignment, 'id' | 'surgeon_profile' | 'staff_profile'>> };
      notifications: { Row: Notification; Insert: Omit<Notification, 'id' | 'created_at'>; Update: Partial<Omit<Notification, 'id'>> };
      audit_log: { Row: AuditLog; Insert: Omit<AuditLog, 'id' | 'created_at'>; Update: Partial<Omit<AuditLog, 'id'>> };
    };
  };
}

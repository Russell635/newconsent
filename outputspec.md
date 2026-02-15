# ConsentMaker — Product Specification

## 1. Overview

**ConsentMaker** is a platform for creating, managing, and delivering informed surgical consent to patients. It centres on a **master operations list** organised by specialty, from which surgeons import procedures into their own personalised lists, attach rich educational content (text, images, video, audio), and deliver structured consent workflows to patients — including comprehension testing and e-signature.

A **content creator marketplace** (V2) will allow individuals or companies to contract with surgeons to develop consent documents, medical artwork, and educational videos.

**Business Model:** Per-patient fee — **$1–2 AUD per patient consent** processed.

---

## 2. Target Users

| Role | Description |
|------|------------|
| **System Admin** | Manages the master operations list, user accounts, and platform configuration. Only admins can add/edit the master list. |
| **Surgeon** | Imports operations from the master list into a personal list, customises consent content, assigns consent workflows to patients, reviews comprehension results, records signatures. Can operate individually or as part of a surgeon group. |
| **Content Creator** (V2) | Individuals or companies who contract with surgeons to produce consent documents, medical artwork, and videos. Can contract with multiple surgeons. Retains IP and licenses content. |
| **Patient** | Completes the consent workflow: reviews educational content, watches videos, takes comprehension quiz, and signs the consent form. Includes parents/guardians signing for minors. |

**Target Markets:** English-speaking countries — Australia (primary), New Zealand, United Kingdom, United States, Canada.

---

## 3. Platform & Tech Stack

| Layer | Technology |
|-------|-----------|
| **Web App** (Surgeon, Admin, Content Creator) | React + TypeScript |
| **Mobile App** (Patient-facing) | React Native (Expo) — iOS & Android |
| **Backend** | Supabase (PostgreSQL, Auth, Storage, Edge Functions) |
| **Authentication** | Supabase Auth — email + password |
| **File Storage** | Supabase Storage (images, videos, PDFs, artwork) |
| **PDF Generation** | Server-side PDF generation via Supabase Edge Functions |
| **AI/NotebookLM** | Deferred to future version — build content structure to support AI-generated audio, study guides, and quizzes later |

### Data Architecture
- Cloud-only storage in Supabase PostgreSQL
- Row-Level Security (RLS) enforcing data isolation per surgeon/group/patient
- Immutable consent records — locked on patient signature, cannot be modified after signing

---

## 4. Core Concept: Master Operations List

The **master operations list** is the central organising feature of the entire database.

### Structure
- Operations are **categorised by specialty** (e.g., General Surgery, Cardiac Surgery, Orthopaedic Surgery, Breast & Endocrine Surgery, Urologic Surgery, etc.)
- Each operation has: name, description, typical duration, recovery time, risks/complications, benefits, alternatives
- **Admin-curated only** — only system administrators can add, edit, or remove operations from the master list
- Each specialty contains a comprehensive list of common operations (minimum 5 per specialty)

### Versioning
- Every edit to a master list operation creates a **new version** (serialised)
- A separate `procedure_versions` table holds all historical versions
- Version records include: version number, who changed it, when, and a complete snapshot of the operation data at that point
- **Surgeons are notified** when a master list operation they've imported has a new version available, but their copy stays unchanged until they manually update
- Patient consent forms remain permanently linked to the specific version that was active when they signed

### Surgeon Import
- Surgeons **import operations** from the master list into their own personal list
- Import always captures the **current version** at time of import
- Once imported, surgeons can **fully edit** their personal copy (change risks, benefits, description, add notes, rewrite entirely)
- Surgeons can also **create custom operations** not on the master list

---

## 5. Surgeon Groups

- Surgeons can belong to a **group practice**
- Groups have a **shared procedure list** that all members inherit
- Individual surgeons can **add personal procedures** on top of the shared list and customise their own copies
- Group-level settings (branding, default templates) apply to all members
- Each surgeon maintains their own patient relationships and consent records

---

## 6. V1 Features — Core + Content Management

### 6.1 Master Operations List (Admin)

- Admin dashboard for managing the master list
- Add/edit/remove specialties
- Add/edit/remove operations within each specialty
- Full version history with diff viewing
- Search and filter across all specialties and operations

### 6.2 Surgeon Onboarding & Profile

- **Self-service** registration: sign up, verify email, set up profile
- Profile includes: name, qualifications, specialty, practice name, contact details
- Guided flow: select specialty → import procedures from master list → customise → ready to use
- Join or create a surgeon group

### 6.3 Surgeon Procedure Management

- **Import from master list**: browse specialties, select operations, import current versions
- **Create custom operations**: add procedure-specific operations not on the master list
- **Full editing**: modify any aspect of imported or custom operations
- **Reusable content**: once content is created for an operation, it's reused for every patient assigned that procedure

### 6.4 Consent Content Builder

- **Hybrid template + rich editor** approach:
  - **Structured template** with defined sections: Procedure Description, Risks & Complications, Benefits, Alternatives, What to Expect (Before/During/After), Recovery
  - **Rich text editor** within each section for custom formatting, inline images, and free-form content
- **Media attachments** per section:
  - Upload images/artwork (anatomical diagrams, procedural illustrations)
  - Upload or embed educational videos
  - Upload audio files (for future NotebookLM-generated narrations)
- **Comprehension quiz builder**:
  - Surgeon creates questions for each procedure
  - Question types: multiple choice, true/false
  - Set correct answers
  - **80% pass threshold** — patient must score 80% to proceed to signature
  - **Unlimited retries** with reshuffled questions

### 6.5 Patient Consent Workflow

> **Detailed specification:** See [consentflow.md](consentflow.md) for the full consent flow design including QR code system, patient matching logic, consent session lifecycle, chat system, surgeon/nurse review workflow, PDF generation, and the nurse/assistant role model.

#### Patient Access
- **QR code** generated per procedure (not per patient) — reusable, always resolves to current consent version
- QR code encodes a single `surgeon_procedure_id` (GUID) — scanned via the patient's mobile app
- Patient identity is provided by the mobile app; system matches against surgeon's patient list (Medicare > name+DOB > fuzzy match with confirmation > auto-insert)
- **Fully flexible location** — patient can complete at home, at the clinic, or partially both

#### Patient Data Collection
- Standard demographics: name, date of birth, gender, contact details (phone, email), address
- Medicare/insurance number
- Emergency contact
- **Minor consent**: if patient is under 18, parent/guardian details are collected and parent/guardian signs instead

#### Consent Flow
- **Flexible sections** — patient can review sections in any order
- All sections must be completed before the signature step unlocks
- Sections include:
  1. Procedure information (text + images)
  2. Risks and complications
  3. Benefits
  4. Alternatives
  5. Educational video(s) (if attached)
  6. Comprehension quiz (80% pass required, unlimited retries)
  7. Acknowledgment checkboxes
  8. E-signature

#### Engagement Tracking
- **Time tracking** on each section — records how long the patient spent reading/viewing
- Flags suspiciously fast completion (e.g., < 30 seconds on a detailed risks section)
- Time data stored in the consent record for medico-legal evidence that patient had adequate time to review

#### E-Signature
- **Simple e-signature** — patient draws their signature on screen (touch or mouse)
- Captured with timestamp and device info
- For minors: parent/guardian signature with relationship field

#### Consent PDF Generation
- **Full document** generated on signature containing:
  - Patient demographics
  - Procedure name and version
  - Complete procedure description, risks, benefits, alternatives
  - All acknowledgment checkboxes and patient's responses
  - Comprehension quiz score
  - Time spent on each section
  - E-signature image
  - Timestamp (date, time, timezone)
  - Surgeon details
- PDF is stored immutably — **locked on signature**, cannot be modified
- PDF can be printed or emailed to patient and surgeon

#### Consent Withdrawal
- **Surgeon-initiated** — if a patient changes their mind, the surgeon records the withdrawal in the system
- Withdrawal record includes: date, reason, who recorded it
- Original consent record remains intact with withdrawal annotation appended
- Full audit trail maintained

### 6.6 Admin Dashboard

- **User management**: create, edit, deactivate surgeon and patient accounts
- **Master operations list management**: full CRUD with version control
- **Basic platform metrics**: number of active surgeons, consents processed, operations in master list

---

## 7. V2 Features — Content Creator Marketplace

### 7.1 Content Creator Accounts
- Separate registration flow for content creators (individuals or companies)
- **Portfolio with samples**: profile page showcasing sample consent documents, artwork, and video thumbnails
- Specialties they cover
- Contact information and availability

### 7.2 Marketplace Browsing
- Surgeons browse content creators by specialty, portfolio quality, and availability
- Search and filter functionality
- View creator portfolios and sample work

### 7.3 Contracting Workflow
- **Simple hire model**:
  1. Surgeon selects a content creator from the marketplace
  2. Surgeon chooses deliverable types needed (text, artwork, video — variable per contract)
  3. Creator receives the request and accepts or declines
  4. **Custom quoting**: creator sends a quote based on the scope
  5. Surgeon accepts the quote
  6. Creator produces the work and uploads deliverables
  7. Surgeon reviews and approves or requests revisions
- Content creators can contract with **multiple surgeons** simultaneously

### 7.4 IP & Licensing
- **Creator retains intellectual property**
- Content is **licensed** to the contracting surgeon
- **Shared library + customisation**: base content can be licensed to multiple surgeons; each surgeon can customise/annotate their copy
- Licensing terms tracked per deliverable

### 7.5 Marketplace Commission
- Platform takes a percentage of each transaction (percentage TBD)

---

## 8. V3 Features — AI & Advanced

### 8.1 NotebookLM / AI Integration
- AI-generated **audio overviews** of procedures (podcast-style patient education)
- AI-generated **study guides** and simplified FAQs from procedure data
- AI-generated **comprehension quizzes** from procedure content (hybrid: AI generates, surgeon reviews and edits)
- **Layered approach**: base content auto-generated from procedure data, surgeon/creator refines
- **Always surgeon-approved** before going live to patients

### 8.2 Translation Support
- Patient-facing content available in patient's preferred language
- English as primary; translated content for non-English speaking patients

### 8.3 Enhanced Analytics
- Consent completion rates, average time per section, quiz pass rates
- Content effectiveness metrics
- Revenue reporting

---

## 9. UI/UX Design

### Patient-Facing (Mobile App)

> **Detailed specification:** See [mobileflow.md](mobileflow.md) for the full mobile app design including registration, QR scanning, offline support, multimedia/accessibility, chat integration, and technical architecture.

- **Clinical and professional** aesthetic — clean, medical-feeling interface conveying authority and trustworthiness
- Large, clear text for readability
- Obvious progress indicators showing which sections are complete
- Calming colour palette (blues, whites, soft greys)
- Accessible design for elderly or less tech-savvy patients
- Clear navigation between consent sections

### Surgeon-Facing (Web App)
- Professional dashboard with procedure management
- Clean data tables for patient consent status
- Rich content editor for building consent materials
- Notification centre for master list updates and patient completions

### Admin (Web App)
- Master list management with version history
- User management tables
- Basic platform metrics

### Key Screens — Patient App
1. **QR Scan / Entry** — scan QR code to load consent workflow
2. **Patient Details** — confirm/enter demographics
3. **Consent Overview** — see all sections with completion status
4. **Section Viewer** — read procedure info, risks, benefits, alternatives (with images)
5. **Video Player** — watch educational videos with completion tracking
6. **Quiz** — comprehension questions with score display and retry option
7. **Acknowledgments** — checkbox list of specific items patient is acknowledging
8. **Signature** — draw signature on screen
9. **Confirmation** — consent complete, PDF available

### Key Screens — Surgeon Web App
1. **Dashboard** — overview of pending/completed consents, notifications
2. **My Procedures** — personal procedure list (imported + custom)
3. **Import from Master List** — browse specialties, select and import operations
4. **Procedure Editor** — template sections + rich editor + media uploads + quiz builder
5. **Patient List** — all patients with consent status
6. **Assign Procedure** — assign a procedure to a patient, generate QR code
7. **Consent Review** — view completed consent details, time tracking, quiz scores
8. **Group Management** — manage surgeon group members and shared procedures
9. **Settings** — profile, practice details, notification preferences

### Key Screens — Admin Web App
1. **Dashboard** — platform metrics
2. **Master Operations List** — specialties and operations with version history
3. **Operation Editor** — add/edit operations with full field set
4. **User Management** — surgeons, patients, content creators
5. **System Settings** — platform configuration

---

## 10. Database Schema (Supabase PostgreSQL)

### Core Tables

```
-- MASTER OPERATIONS LIST

specialties
  id (uuid, PK)
  name (text) -- e.g., 'General Surgery', 'Cardiac Surgery'
  description (text)
  sort_order (integer)
  created_at (timestamptz)
  updated_at (timestamptz)

master_procedures
  id (uuid, PK)
  specialty_id (uuid, FK → specialties)
  name (text)
  description (text)
  duration_minutes (integer)
  recovery_time (text)
  risks (text[]) -- array of risk/complication strings
  benefits (text[])
  alternatives (text[])
  version (integer, default 1)
  updated_by (uuid, FK → auth.users)
  created_at (timestamptz)
  updated_at (timestamptz)

procedure_versions
  id (uuid, PK)
  master_procedure_id (uuid, FK → master_procedures)
  version (integer)
  name (text)
  description (text)
  duration_minutes (integer)
  recovery_time (text)
  risks (text[])
  benefits (text[])
  alternatives (text[])
  changed_by (uuid, FK → auth.users)
  changed_by_email (text)
  change_reason (text)
  archived_at (timestamptz)

-- SURGEON & GROUPS

surgeon_profiles
  id (uuid, PK)
  user_id (uuid, FK → auth.users)
  full_name (text)
  qualifications (text)
  specialty_id (uuid, FK → specialties)
  practice_name (text)
  phone (text)
  email (text)
  group_id (uuid, FK → surgeon_groups, nullable)
  created_at (timestamptz)

surgeon_groups
  id (uuid, PK)
  name (text)
  description (text)
  created_by (uuid, FK → auth.users)
  created_at (timestamptz)

-- SURGEON'S PERSONAL PROCEDURE LIST

surgeon_procedures
  id (uuid, PK)
  surgeon_id (uuid, FK → surgeon_profiles)
  group_id (uuid, FK → surgeon_groups, nullable) -- if shared at group level
  master_procedure_id (uuid, FK → master_procedures, nullable) -- null if custom
  imported_version (integer, nullable) -- version at time of import
  name (text)
  description (text)
  duration_minutes (integer)
  recovery_time (text)
  risks (text[])
  benefits (text[])
  alternatives (text[])
  is_custom (boolean, default false)
  created_at (timestamptz)
  updated_at (timestamptz)

-- CONSENT CONTENT (attached to surgeon_procedures)

consent_sections
  id (uuid, PK)
  surgeon_procedure_id (uuid, FK → surgeon_procedures)
  section_type (enum: 'description', 'risks', 'benefits', 'alternatives', 'before_during_after', 'recovery', 'custom')
  title (text)
  content_html (text) -- rich text content
  sort_order (integer)
  created_at (timestamptz)
  updated_at (timestamptz)

consent_media
  id (uuid, PK)
  consent_section_id (uuid, FK → consent_sections)
  media_type (enum: 'image', 'video', 'audio', 'pdf')
  file_url (text)
  file_name (text)
  caption (text)
  sort_order (integer)
  created_at (timestamptz)

-- COMPREHENSION QUIZ

quiz_questions
  id (uuid, PK)
  surgeon_procedure_id (uuid, FK → surgeon_procedures)
  question_text (text)
  question_type (enum: 'multiple_choice', 'true_false')
  options (jsonb) -- array of {text, is_correct}
  sort_order (integer)
  created_at (timestamptz)

-- PATIENTS

patients
  id (uuid, PK)
  user_id (uuid, FK → auth.users, nullable) -- nullable for QR-access patients
  first_name (text)
  last_name (text)
  date_of_birth (date)
  gender (text)
  phone (text)
  email (text)
  address (text)
  medicare_number (text, nullable)
  insurance_number (text, nullable)
  emergency_contact_name (text)
  emergency_contact_phone (text)
  emergency_contact_relationship (text)
  is_minor (boolean, default false)
  guardian_name (text, nullable)
  guardian_relationship (text, nullable)
  guardian_phone (text, nullable)
  guardian_email (text, nullable)
  created_at (timestamptz)

-- CONSENT RECORDS

patient_consents
  id (uuid, PK)
  patient_id (uuid, FK → patients)
  surgeon_id (uuid, FK → surgeon_profiles)
  surgeon_procedure_id (uuid, FK → surgeon_procedures)
  procedure_version_snapshot (jsonb) -- full snapshot of procedure data at time of consent
  status (enum: 'assigned', 'in_progress', 'quiz_failed', 'completed', 'withdrawn')
  qr_code_token (text, unique) -- unique token for QR access
  assigned_at (timestamptz)
  started_at (timestamptz)
  completed_at (timestamptz)
  withdrawn_at (timestamptz)
  withdrawal_reason (text, nullable)
  withdrawn_by (uuid, FK → auth.users, nullable)
  is_locked (boolean, default false) -- true once signed

-- SECTION COMPLETION TRACKING

consent_section_progress
  id (uuid, PK)
  patient_consent_id (uuid, FK → patient_consents)
  consent_section_id (uuid, FK → consent_sections)
  started_at (timestamptz)
  completed_at (timestamptz)
  time_spent_seconds (integer)
  flagged_too_fast (boolean, default false)

-- QUIZ ATTEMPTS

quiz_attempts
  id (uuid, PK)
  patient_consent_id (uuid, FK → patient_consents)
  score_percent (numeric)
  passed (boolean)
  attempted_at (timestamptz)

quiz_responses
  id (uuid, PK)
  quiz_attempt_id (uuid, FK → quiz_attempts)
  question_id (uuid, FK → quiz_questions)
  selected_option (jsonb)
  is_correct (boolean)

-- SIGNATURES

consent_signatures
  id (uuid, PK)
  patient_consent_id (uuid, FK → patient_consents)
  signature_image_url (text) -- stored as image in Supabase Storage
  signer_type (enum: 'patient', 'guardian')
  signer_name (text)
  signer_relationship (text, nullable) -- for guardian
  signed_at (timestamptz)
  device_info (text)
  ip_address (text)

-- ACKNOWLEDGMENTS

consent_acknowledgments
  id (uuid, PK)
  surgeon_procedure_id (uuid, FK → surgeon_procedures)
  text (text) -- e.g., "I understand the risks of bleeding and infection"
  sort_order (integer)
  is_required (boolean, default true)

patient_acknowledgments
  id (uuid, PK)
  patient_consent_id (uuid, FK → patient_consents)
  acknowledgment_id (uuid, FK → consent_acknowledgments)
  acknowledged (boolean)
  acknowledged_at (timestamptz)

-- GENERATED PDFs

consent_pdfs
  id (uuid, PK)
  patient_consent_id (uuid, FK → patient_consents)
  pdf_url (text)
  generated_at (timestamptz)
  document_hash (text) -- SHA-256 hash for integrity verification

-- NOTIFICATIONS

notifications
  id (uuid, PK)
  user_id (uuid, FK → auth.users)
  type (text) -- 'version_update', 'consent_completed', 'quiz_failed', etc.
  title (text)
  message (text)
  data (jsonb)
  read (boolean, default false)
  created_at (timestamptz)

-- AUDIT LOG

audit_log
  id (uuid, PK)
  user_id (uuid, FK → auth.users, nullable)
  action (text) -- 'consent_signed', 'consent_withdrawn', 'procedure_updated', etc.
  entity_type (text) -- 'patient_consent', 'master_procedure', etc.
  entity_id (uuid)
  details (jsonb)
  ip_address (text)
  created_at (timestamptz)
```

### V2 Additional Tables (Content Creator Marketplace)

```
content_creators
  id (uuid, PK)
  user_id (uuid, FK → auth.users)
  company_name (text, nullable)
  contact_name (text)
  bio (text)
  specialties (uuid[], FK → specialties)
  portfolio_url (text, nullable)
  created_at (timestamptz)

portfolio_items
  id (uuid, PK)
  creator_id (uuid, FK → content_creators)
  title (text)
  description (text)
  media_type (enum: 'document', 'artwork', 'video')
  sample_url (text)
  created_at (timestamptz)

contracts
  id (uuid, PK)
  surgeon_id (uuid, FK → surgeon_profiles)
  creator_id (uuid, FK → content_creators)
  procedure_id (uuid, FK → surgeon_procedures, nullable)
  deliverable_types (text[]) -- ['text', 'artwork', 'video']
  status (enum: 'requested', 'quoted', 'accepted', 'in_progress', 'delivered', 'approved', 'rejected')
  quote_amount (numeric, nullable)
  quote_currency (text, default 'AUD')
  notes (text)
  created_at (timestamptz)
  updated_at (timestamptz)

contract_deliverables
  id (uuid, PK)
  contract_id (uuid, FK → contracts)
  deliverable_type (text)
  file_url (text)
  status (enum: 'pending', 'uploaded', 'approved', 'revision_requested')
  revision_notes (text, nullable)
  uploaded_at (timestamptz)
  approved_at (timestamptz)

content_licenses
  id (uuid, PK)
  deliverable_id (uuid, FK → contract_deliverables)
  creator_id (uuid, FK → content_creators)
  surgeon_id (uuid, FK → surgeon_profiles)
  license_type (text) -- 'exclusive', 'non-exclusive'
  granted_at (timestamptz)
```

### Row-Level Security

- All tables enforce user-level or role-level isolation
- Surgeons can only access their own procedures, patients, and consent records (plus group-shared data)
- Patients can only access their own consent records
- Admins have full access to master list and user management
- Consent records marked `is_locked = true` cannot be updated via any RLS policy (immutable after signature)
- Audit log is append-only — no updates or deletes permitted

---

## 11. Supabase Edge Functions (V1)

| Function | Purpose |
|----------|---------|
| `generate-consent-pdf` | Generate full consent PDF with all content, acknowledgments, quiz score, signature, timestamps |
| `generate-qr-code` | Generate unique QR code for a patient consent assignment |
| `validate-quiz` | Score a quiz attempt, determine pass/fail against 80% threshold |
| `notify-version-update` | When master list operation is updated, notify surgeons who imported it |
| `record-section-time` | Record time spent on each section, flag if below minimum threshold |

---

## 12. Compliance & Security

### Australian Privacy Act (APPs)
- Collect only necessary personal information (APP 3)
- Notify patients about data collection purposes (APP 5)
- Secure storage of health information (APP 11)
- Patient right to access their consent records (APP 12)

### Data Retention
- **Minimum 7 years** for all consent records
- Consent PDFs and signature images retained for the full retention period
- Audit logs retained indefinitely

### Security Measures
- All API calls authenticated via Supabase JWT tokens
- Row-Level Security on all tables
- Consent records immutable after signature (locked at database level)
- Signed PDFs stored with SHA-256 hash for tamper detection
- Automatic session timeout
- Audit logging on all consent-related actions (sign, withdraw, view, edit)

---

## 13. Release Roadmap

### V1 — Core + Content Management
- System admin: master operations list with versioning, user management
- Surgeon: self-service onboarding, import from master list, custom operations, full editing
- Surgeon: consent content builder (template + rich editor + media uploads)
- Surgeon: comprehension quiz builder
- Surgeon: assign procedures to patients, generate QR codes
- Surgeon: view consent status, review completed consents
- Surgeon groups: shared procedure lists with individual additions
- Patient: QR code access, flexible section review, time tracking
- Patient: comprehension quiz (80% pass, unlimited retries)
- Patient: e-signature capture, acknowledgment checkboxes
- Patient: consent for minors (parent/guardian signature)
- Consent withdrawal (surgeon-initiated)
- Full consent PDF generation (immutable, locked on signature)
- Notification: master list version updates to surgeons
- Audit logging

### V2 — Content Creator Marketplace
- Content creator registration and portfolio
- Marketplace browsing by specialty
- Simple hire + custom quoting contract workflow
- Deliverable upload, review, and approval
- IP licensing (creator retains, licenses to surgeon)
- Shared library with surgeon-level customisation
- Platform commission on transactions

### V3 — AI & Internationalisation
- NotebookLM / AI integration: auto-generated audio overviews, study guides, quiz questions
- Layered content approach: AI base + surgeon refinement
- Surgeon approval required on all AI-generated content
- Translation support for patient-facing content
- Enhanced analytics and reporting
- EMR integration consideration (FHIR)

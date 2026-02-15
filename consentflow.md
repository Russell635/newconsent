# ConsentMaker — Consent Flow Specification

## 1. Overview

This document details the end-to-end consent flow: how a surgeon shares consent with patients, how patients complete it, and how the clinical team validates it. It covers QR code generation, patient matching, consent session lifecycle, chat, review workflows, PDF generation, and the nurse/assistant role model.

> **Related:** See [consentAuth.md](consentAuth.md) for roles, authentication, staff invitation flow, and access control. See [mobileflow.md](mobileflow.md) for the patient mobile app design. See [outputspec.md](outputspec.md) for the full product specification.

## 2. QR Code System

### 2.1 What the QR Code Represents

Each QR code is tied to a **surgeon procedure** (not a specific patient or version). The QR encodes a URL containing a single identifier:

- `surgeon_procedure_id` (GUID) — this is the only value needed in the QR code, since the surgeon procedure record already contains the `surgeon_id`. The `surgeon_procedure_id` must be a GUID (not a sequential integer) to be suitable for public-facing URLs.

The QR code does **not** encode a version number. When scanned, the system resolves the **current version** of the consent content at that moment. This means the same QR code always points to the latest consent content without needing to be reprinted.

### 2.2 QR Form Pages

Surgeons create and manage printable form pages from a dedicated **QR Form Pages** section in the web app.

**Page Management (CRUD):**
- The surgeon maintains a list of form page definitions (e.g., "Hip Operations", "Ankle & Knee", "Common Procedures")
- Pages can be created, renamed, reordered, and deleted

**Page Builder UI:**
- Opening a form page shows a two-panel layout:
  - **Left panel**: all of the surgeon's procedures (available to add)
  - **Right panel**: procedures assigned to this page (the current selection, ordered)
- The surgeon drags or selects procedures from left to right to build the page
- Procedures can be reordered within the right panel

**Printed Output:**
- Each page renders as a printable PDF containing:
  - **Heading**: surgeon name, practice name, page title
  - **Line items**: procedure name, brief description, QR code
- The surgeon can print or download the PDF directly from the web app
- A surgeon can have multiple form pages

### 2.3 QR Code Lifecycle

- QR codes are **static and reusable** — many patients can scan the same code
- QR codes remain valid as long as the surgeon procedure exists
- If the surgeon deletes a procedure, the QR becomes invalid (shows an error on scan)
- No expiry on the QR code itself (expiry applies to consent sessions, not the code)

---

## 3. Patient Scan & Matching

### 3.1 The Scan Journey

1. Patient opens the ConsentMaker mobile app
2. Patient scans the QR code (the app has a built-in scanner)
3. The app decodes the URL and sends the patient's identity + the procedure reference to the backend
4. The system runs the **patient matching logic** (see 3.2)
5. On successful match/insert, a new consent session is created
6. The patient is taken to their **consent list** showing all pending consents
7. The just-scanned consent appears as "Not Started"

The consent list also provides access to **past completed consents** and their associated PDFs, so the patient has a full history of all consents across all surgeons.

### 3.2 Patient Matching Logic

The mobile app holds the patient's demographics (entered during app registration, including Medicare number). When a scan occurs, the system matches the patient against the surgeon's existing patient list.

**Match priority (highest to lowest):**

1. **Medicare number match** — if the patient's Medicare number matches a record in the surgeon's patient list AND the name is reasonable → **auto-link** (strongest match)
2. **Exact name + DOB match** — first name + last name + date of birth all match → **auto-link**
3. **Similar name, no DOB on surgeon's side** — the surgeon entered the patient manually without DOB, and the name is similar → **flag for surgeon confirmation** (surgeon receives a notification to confirm or reject the match)
4. **No match found** — patient does not exist in the surgeon's list → **auto-insert** as a new patient record for that surgeon, populated from the mobile app's demographics

### 3.3 Auto-Insert Behaviour

When a patient is auto-inserted:

- Demographics are pulled from the mobile app profile (first name, last name, DOB, gender, phone, email, Medicare number)
- The patient is added to the surgeon's patient list
- The surgeon receives a notification: "New patient [Name] scanned [Procedure Name] consent"
- The surgeon can now schedule operations and manage this patient normally

### 3.4 Patient Merge

Duplicate patient records may arise (e.g., surgeon manually entered a patient, then the same patient scans a QR and gets auto-inserted as a new record). The system must support **patient merge**:

- The surgeon (or authorised nurse) can identify two patient records as the same person
- Merge uses the same matching logic as scan-time matching (Medicare, name+DOB, similar name) to suggest potential duplicates
- On merge: one record is designated as primary, the other is absorbed
  - All consent sessions, chat history, and audit records transfer to the primary record
  - Demographics are consolidated (primary record's fields take precedence, with gaps filled from the secondary)
  - The secondary record is soft-deleted (retained for audit trail)
- The system should proactively suggest potential duplicates when similar records are detected

---

## 4. Consent Session Lifecycle

### 4.1 States

A consent session progresses through these states:

```
NOT_STARTED → IN_PROGRESS → PATIENT_COMPLETED → UNDER_REVIEW → VALID
```

| State               | Meaning                                                                           |
| ------------------- | --------------------------------------------------------------------------------- |
| `not_started`       | QR scanned, consent session created, patient hasn't opened it yet                 |
| `in_progress`       | Patient has started at least one section                                          |
| `patient_completed` | Patient has completed all sections, quiz, acknowledgments, and signature          |
| `under_review`      | Clinical team (surgeon/nurse) is reviewing the consent                            |
| `valid`             | Surgeon or authorised nurse has completed their review — consent is legally valid |

### 4.2 Consent Session Record

When a consent session is created, the following data is recorded:

| Field                  | Description                                                                 |
| ---------------------- | --------------------------------------------------------------------------- |
| `id`                   | GUID — unique identifier for this consent session                           |
| `surgeon_id`           | The surgeon's auth ID                                                       |
| `patient_id`           | The matched/inserted patient ID                                             |
| `surgeon_procedure_id` | The procedure from the surgeon's list                                       |
| `consent_version`      | The version of consent content **at time of scan** — locked from this point |
| `status`               | Current lifecycle state                                                     |
| `scanned_at`           | Timestamp of QR scan                                                        |
| `started_at`           | Timestamp when patient first opens a section                                |
| `patient_completed_at` | Timestamp when patient finishes all requirements                            |
| `reviewed_at`          | Timestamp when clinical review is completed                                 |
| `reviewed_by`          | User ID of the reviewer (surgeon or nurse)                                  |
| `expires_at`           | Calculated from surgeon's expiry setting                                    |
| `surgery_location_id`  | Assigned by surgeon/assistant — links to location template                  |

### 4.3 Version Locking

- The consent version is **locked at the moment of scan**
- If the surgeon updates their consent content after a patient has scanned, the patient continues with the version they started with
- A new scan of the same QR code by the same patient (e.g., for a future surgery) creates a new consent session with the then-current version
- Completed and validated consents are never retroactively changed

### 4.4 Consent Expiry

- Each surgeon has a **default consent expiry setting**: 3 months, 6 months, 12 months, or never
- `expires_at` is calculated as `scanned_at + expiry_duration`
- If a consent session is not completed before expiry, it becomes invalid and the patient must scan again
- The surgeon can override the expiry on individual consent sessions if needed

---

## 5. Patient Consent Experience (Mobile App)

### 5.1 Consent List

After scanning, the patient sees a list of all their pending consents:

- Each item shows: procedure name, surgeon name, status, % completion
- Statuses displayed: **Not Started**, **In Progress (X%)**, **Completed — Awaiting Review**, **Valid**
- Tap a consent to enter the consent session

### 5.2 Section Navigation

Within a consent session, the patient can:

- **Navigate freely** between sections (not forced linear progression)
- See visual indicators for each section:
  - **Not started** — grey/empty indicator
  - **Partially completed** — amber/partial indicator
  - **Completed** — green/check indicator
- Sections include: Procedure Description, Risks & Complications, Benefits, Alternatives, Before/During/After, Recovery, Video/Media, Quiz, Acknowledgments, Signature
- The patient can complete sections in any order
- The consent cannot be finalised until all sections are completed

### 5.3 Quiz

- The quiz tests patient understanding of the consent content
- Questions are multiple-choice or true/false
- The patient **can retry** the quiz if they fail
- On retry, the questions **may be different** (drawn from a question pool)
- Quiz attempts and scores are recorded for the clinical record

### 5.4 Completion

To complete the consent on the patient side:

1. All sections must show as completed
2. Quiz must be passed
3. All acknowledgment checkboxes must be checked
4. Signature must be provided

Once all requirements are met → status moves to `patient_completed` and locks on the patient side.

### 5.5 Multiple Sittings

- Patients can complete the consent across multiple sittings
- Progress is saved automatically
- They can start at the clinic and finish at home, or vice versa
- The consent list always shows current progress

---

## 6. Chat System

### 6.1 Overview

Patients can ask questions while going through the consent. In V1, this is a **text-based human chat**. AI-assisted chat will be added in a future release.

### 6.2 Section-Aware Chat

- The chat is **aware of which section the patient is currently viewing** when they initiate it
- This context is attached to the chat session so the responder knows what the patient is reading
- A patient can have multiple chat sessions across different sections

### 6.3 Chat Participants

- **Patient** initiates the chat from within a consent section
- **Nurse/Assistant** or **Surgeon** responds (based on who is assigned to handle chats for that surgeon — see Section 8)
- Chat messages are timestamped and attributed

### 6.4 Chat Review

- Each chat session has a summary visible to the surgeon
- The surgeon can drill into the full chat transcript
- The surgeon's review of chat sessions is **tracked** — they must mark chat interactions as reviewed
- Unreviewed chats block the consent from reaching `valid` status

---

## 7. Surgeon Review Workflow

### 7.1 Review Dashboard

The surgeon (or authorised nurse) sees a review view for each consent that has reached `patient_completed`:

- **Overall completion percentage** (should be 100% on patient side)
- **Per-section status** — drill into each section to see what the patient saw and how they interacted
- **Quiz results** — attempts, scores, questions answered
- **Chat sessions** — summaries with ability to drill into full transcripts
- **Acknowledgments** — what was acknowledged
- **Signature** — view the patient's signature and timestamp

### 7.2 Review Process

- The reviewer walks through each area of the consent
- Each area (sections, quiz, chats, acknowledgments, signature) must be **marked as reviewed**
- The system tracks which areas have been reviewed and by whom
- A consent is not `valid` until **all areas are marked as reviewed**
- The reviewer can be the surgeon or an authorised nurse (see Section 8)

### 7.3 Notifications

| Event                            | Recipient                | Description                                                                     |
| -------------------------------- | ------------------------ | ------------------------------------------------------------------------------- |
| Patient scans QR                 | Surgeon                  | "New patient [Name] scanned [Procedure] consent"                                |
| New patient auto-inserted        | Surgeon                  | "New patient [Name] added to your patient list"                                 |
| Patient match needs confirmation | Surgeon                  | "[Name] scanned — possible match with existing patient [Name]. Please confirm." |
| Section completed                | Surgeon                  | Visible as progress % update                                                    |
| Chat message received            | Assigned nurse/surgeon   | "Patient [Name] has a question about [Section]"                                 |
| Patient completed consent        | Surgeon + assigned nurse | "[Name] completed consent for [Procedure] — ready for review"                   |
| No scan warning                  | Surgeon                  | "Patient [Name] was added [X weeks] ago but hasn't scanned a consent"           |
| Consent nearing expiry           | Patient + Surgeon        | "Consent for [Procedure] expires in [X days]"                                   |

### 7.4 No-Scan Warning

- If a surgeon manually adds a patient but no consent scan occurs within a configurable period (measured in **weeks**), the surgeon receives a warning
- Default: configurable per surgeon (e.g., 2 weeks, 4 weeks)
- The surgeon's dashboard shows a "time since added" indicator for patients without any consent sessions

---

## 8. Nurse / Assistant Role Model

### 8.1 Overview

Nurses and assistants are **independent practitioners** who can work with multiple surgeons. They are not bound to a single surgeon, practice, or group. A nurse might specialise in a clinical area (e.g., cardiac consent) and offer services to surgeons across the state.

### 8.2 Relationship Model

- **Many-to-many**: one nurse can work with many surgeons; one surgeon can have many nurses
- **Per-surgeon permissions**: the relationship between a nurse and a surgeon carries specific role assignments
- **Cross-group**: a nurse can work with surgeons in different groups or with ungrouped surgeons

### 8.3 Permissions (Per Surgeon-Nurse Relationship)

Each nurse-surgeon relationship defines which of the following the nurse can do for that surgeon:

| Permission                | Description                                                            |
| ------------------------- | ---------------------------------------------------------------------- |
| `handle_consent_sections` | Can assist with consent section preparation and management             |
| `prepare_documents`       | Can prepare consent documents, assign surgery locations, generate PDFs |
| `validate_consent`        | Can perform the clinical review and mark a consent as `valid`          |
| `answer_questions`        | Can respond to patient chat messages                                   |

These permissions are **independently toggleable** per surgeon relationship.

### 8.4 Database Model

```
nurse_surgeon_assignments
├── id (GUID)
├── nurse_user_id (FK → auth.users)
├── surgeon_id (FK → surgeon_profiles)
├── permissions (text[] — array of permission keys)
├── is_active (boolean)
├── created_at
├── updated_at
```

### 8.5 Nurse User Experience

- Nurses log into the web app with their own account (role: `nurse`)
- Their dashboard shows all surgeons they work with
- They can switch context between surgeons
- They only see data relevant to their permissions for each surgeon
- Notifications route to the appropriate nurse based on permissions (e.g., chat messages go to nurses with `answer_questions` permission)

---

## 9. PDF Generation

### 9.1 Surgeon PDF (Full Record)

Generated when consent reaches `valid` status:

- Complete consent content (all sections as the patient saw them)
- Patient demographics
- Quiz questions, patient answers, scores, attempts
- All acknowledgments with timestamps
- Patient signature with timestamp
- Chat transcripts (if any)
- Reviewer details and review timestamps
- Consent version number
- Legally complete record

### 9.2 Patient PDF (Summary + Practical Info)

Generated when consent reaches `patient_completed` status:

- Summary of procedure description
- Key risks, benefits, and alternatives
- Patient's signature confirmation
- **Location-specific practical information**:
  - Surgery location name and address
  - Transport information
  - Fasting instructions
  - Pre-operative instructions
  - Post-operative care summary
- This practical info is **auto-generated from location templates** (see 9.3)

### 9.3 Surgery Location Templates

- Surgeons (or their assistants) configure location templates for each procedure-location combination
- Example: "Total Hip Replacement — Toowoomba Private", "Total Hip Replacement — St Vincent's"
- Templates for the same procedure at different locations may be nearly identical with minor differences
- Template data includes: location address, transport info, fasting rules, pre-op instructions, post-op care
- When a consent session is assigned a surgery location, the template data auto-populates into the patient's summary PDF
- Location is assigned **per patient** (not per procedure globally)

---

## 10. Database Additions

The following new or modified tables support the consent flow:

### 10.1 New Tables

```sql
-- QR form pages
qr_form_pages
├── id (GUID)
├── surgeon_id (FK → surgeon_profiles)
├── title (text) — e.g., "Hip Operations"
├── procedure_ids (UUID[]) — ordered list of surgeon_procedure_ids on this page
├── created_at
├── updated_at

-- Nurse-surgeon assignments
nurse_surgeon_assignments
├── id (GUID)
├── nurse_user_id (FK → auth.users)
├── surgeon_id (FK → surgeon_profiles)
├── permissions (text[]) — ['handle_consent_sections', 'prepare_documents', 'validate_consent', 'answer_questions']
├── is_active (boolean)
├── created_at
├── updated_at

-- Chat sessions
consent_chat_sessions
├── id (GUID)
├── consent_id (FK → patient_consents)
├── section_key (text) — which section the patient was viewing
├── started_at (timestamptz)
├── resolved_at (timestamptz, nullable)
├── reviewed_by (FK → auth.users, nullable)
├── reviewed_at (timestamptz, nullable)

-- Chat messages
consent_chat_messages
├── id (GUID)
├── chat_session_id (FK → consent_chat_sessions)
├── sender_id (FK → auth.users)
├── sender_role (text) — 'patient', 'surgeon', 'nurse'
├── message (text)
├── sent_at (timestamptz)

-- Surgery location templates
surgery_location_templates
├── id (GUID)
├── surgeon_id (FK → surgeon_profiles)
├── surgeon_procedure_id (FK → surgeon_procedures, nullable) — null = applies to all procedures
├── location_name (text) — e.g., "Toowoomba Private Hospital"
├── location_address (text)
├── transport_info (text)
├── fasting_instructions (text)
├── pre_op_instructions (text)
├── post_op_care (text)
├── created_at
├── updated_at

-- Consent review tracking
consent_review_items
├── id (GUID)
├── consent_id (FK → patient_consents)
├── review_area (text) — 'section:risks', 'section:benefits', 'quiz', 'chat:session_id', 'acknowledgments', 'signature'
├── reviewed_by (FK → auth.users)
├── reviewed_at (timestamptz)
```

### 10.2 Modified Tables

```sql
-- patient_consents: add fields
ALTER TABLE patient_consents ADD COLUMN scanned_at timestamptz;
ALTER TABLE patient_consents ADD COLUMN patient_completed_at timestamptz;
ALTER TABLE patient_consents ADD COLUMN reviewed_at timestamptz;
ALTER TABLE patient_consents ADD COLUMN reviewed_by UUID REFERENCES auth.users;
ALTER TABLE patient_consents ADD COLUMN consent_version integer;
ALTER TABLE patient_consents ADD COLUMN surgery_location_id UUID REFERENCES surgery_location_templates;
ALTER TABLE patient_consents ADD COLUMN expires_at timestamptz;

-- surgeon_profiles: add expiry setting
ALTER TABLE surgeon_profiles ADD COLUMN default_consent_expiry_months integer DEFAULT 3;

-- surgeon_profiles: add no-scan warning setting
ALTER TABLE surgeon_profiles ADD COLUMN no_scan_warning_weeks integer DEFAULT 2;

-- user_profiles: add 'nurse' to role enum
-- ALTER TYPE user_role ADD VALUE 'nurse';
```

---

## 11. Status Diagram

```
Patient scans QR
       │
       ▼
  ┌─────────────┐
  │ not_started  │  ← consent session created, version locked
  └──────┬──────┘
         │ patient opens a section
         ▼
  ┌─────────────┐
  │ in_progress  │  ← patient working through sections, chat available
  └──────┬──────┘
         │ all sections + quiz + acknowledgments + signature done
         ▼
  ┌──────────────────┐
  │ patient_completed │  ← locked on patient side, patient PDF generated
  └───────┬──────────┘
          │ surgeon/nurse begins review
          ▼
  ┌──────────────┐
  │ under_review  │  ← clinical team reviewing sections, chats, quiz
  └───────┬──────┘
          │ all review items marked complete
          ▼
     ┌────────┐
     │ valid  │  ← full PDF generated, consent is legally binding
     └────────┘
```

---

## 12. Future Enhancements (Not V1)

- **AI-assisted chat** — AI responds first using consent content as context, escalates to human when needed
- **NotebookLM integration** — AI-generated learning flows for patient education
- **Video/audio chat** — real-time consultation within the consent flow
- **Consent withdrawal** — patient-initiated withdrawal through the app (currently handled manually with surgeon)
- **Re-consent on version change** — surgeon triggers re-consent for patients with outdated versions
- **Content creator marketplace** — third-party consent content creators offering services to surgeons

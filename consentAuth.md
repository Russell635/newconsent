# ConsentMaker — Authentication, Roles & Access Control

> **Related:** See [consentflow.md](consentflow.md) for the consent workflow, [mobileflow.md](mobileflow.md) for the patient mobile app, and [outputspec.md](outputspec.md) for the full product specification.

---

## 1. User Roles

The system has five distinct roles:

| Role | Platform | Description |
|------|----------|-------------|
| `admin` | Web | Platform administrator — manages the master operations list, user accounts, and system settings |
| `surgeon` | Web | Surgeon — manages procedures, consent content, patients, reviews consents, invites staff |
| `manager` | Web | Practice manager — delegated administrative authority from a surgeon, manages staff and patients |
| `nurse` | Web | Clinical assistant — handles consent-related tasks under surgeon/manager direction |
| `patient` | Mobile | Patient — completes consent workflows via the mobile app |

---

## 2. Registration & Authentication

### 2.1 Web App (Admin, Surgeon, Manager, Nurse)

**Registration:**
- User registers with **email + password**
- Selects their role during registration: admin, surgeon, manager, or nurse
- Email verification required before first login
- Profile setup completed on first login

**Login:**
- Email + password authentication
- Session managed by Supabase Auth
- Sessions persist until explicit sign-out or token expiry

### 2.2 Mobile App (Patient)

**Registration:**
- Patient registers with **phone number + SMS verification**
- SMS code sent via Supabase Auth (or Twilio)
- Profile setup follows immediately (name, DOB, optional Medicare, optional photo)
- Phone number is the primary identity

**Clinic Tablet Mode:**
- When using a clinic-owned device, authentication uses a **one-time code sent to the clinic's email**
- Session is temporary — data is not persisted on the device
- Automatic session timeout after period of inactivity (configurable, default 15 minutes)
- Patient prompted to clear session when done

**Login:**
- Phone number + SMS OTP each time (no persistent password)
- Session persisted in secure device storage between app uses

---

## 3. Role Details

### 3.1 Admin

**Access scope:** Platform-wide

**Capabilities:**
- Manage the master operations list (specialties, procedures, versioning)
- View and manage all user accounts (surgeons, managers, nurses)
- Activate/deactivate accounts
- View platform-wide metrics and audit logs
- Cannot access individual surgeon's patient data or consent records (unless explicitly granted)

**One admin or many:**
- Multiple admins supported
- Admin accounts are created during registration or promoted by existing admins

### 3.2 Surgeon

**Access scope:** Own practice data + assigned staff

**Capabilities:**
- **Procedures:** Import from master list, create custom procedures, edit consent content, build quizzes, manage acknowledgments
- **Patients:** Add, edit, merge patients; view patient demographics and consent history
- **Consents:** View all consent sessions for their patients; review and validate completed consents
- **QR Form Pages:** Create, edit, print QR code form pages for clinic use
- **Staff management:** Invite managers and nurses via email; set and modify permissions; revoke access
- **Settings:** Configure consent expiry defaults, no-scan warning period, practice details, surgery locations
- **Chat:** View and respond to patient questions; review chat transcripts during consent validation

**Delegation:** A surgeon can delegate most administrative tasks to a manager, retaining ultimate control over:
- Clinical consent content (procedure descriptions, risks, benefits)
- Final consent validation (unless `validate_consent` permission is granted to a nurse)
- Staff permission levels

### 3.3 Manager

**Access scope:** Per-surgeon — a manager can work with multiple surgeons, with independent permissions per surgeon

**How managers are assigned:**
- A manager registers on the platform independently (role: `manager`)
- The **surgeon initiates** the connection by entering the manager's email address in the app
- An **in-app invitation** is sent, specifying the roles/permissions being offered
- The invitation appears as a message to the manager
- The manager **accepts or declines** the invitation within the app
- If a manager wants to work with a surgeon who hasn't invited them, they must contact the surgeon outside the app (conventional email, letter, phone) and ask to be invited

**Capabilities (all subject to surgeon-set restrictions):**
- **Manage staff:** Add/remove nurses and assistants for the surgeon; set and modify nurse permissions
- **Manage patients:** Add, edit, merge patients on behalf of the surgeon
- **Manage locations:** Create and edit surgery location templates
- **View all consents:** Full read access to all consent records, reviews, chat transcripts
- **Prepare documents:** Assign surgery locations, generate PDFs
- **Answer questions:** Respond to patient chat messages (if permitted)

**Multiple managers:** A surgeon can have multiple managers (e.g., one per clinic location, one for admin tasks)

**Permission modification:** The surgeon can adjust a manager's permissions at any time — no re-invitation needed

### 3.4 Nurse / Assistant

**Access scope:** Per-surgeon — a nurse can work with multiple surgeons, with independent permissions per surgeon

**How nurses are assigned:**
- Same invitation flow as managers — surgeon (or manager with staff management permission) enters the nurse's email and sends an in-app invitation with specific permissions
- The nurse accepts or declines within the app

**Granular permissions (per surgeon relationship):**

| Permission | Description |
|-----------|-------------|
| `handle_consent_sections` | Can assist with consent section preparation and management |
| `prepare_documents` | Can prepare consent documents, assign surgery locations, generate PDFs |
| `validate_consent` | Can perform the clinical review and mark a consent as valid |
| `answer_questions` | Can respond to patient chat messages |

These permissions are **independently toggleable** per surgeon relationship.

**Permission modification:** The surgeon (or authorised manager) can adjust a nurse's permissions at any time.

### 3.5 Patient

**Access scope:** Own data only — own profile, own consent sessions, own chat messages

**Capabilities:**
- Complete consent workflows (read sections, take quizzes, sign acknowledgments, provide signature)
- Ask questions via chat within consent sections
- Record voice messages
- View consent history and download PDFs
- Update own profile (demographics, Medicare, photo, emergency contact)

**No web access:** Patients interact exclusively through the mobile app.

---

## 4. Staff Invitation Flow

### 4.1 Surgeon Invites Manager or Nurse

```
Surgeon opens Staff Management
    │
    ├── Clicks "Invite Staff"
    │
    ├── Enters the user's email address
    │
    ├── Selects role: Manager or Nurse
    │
    ├── Sets permissions (checkboxes)
    │   ├── For Manager: which capabilities to grant/restrict
    │   └── For Nurse: which of the 4 permission types to enable
    │
    ├── Sends invitation
    │
    ▼
Invitation appears as in-app message to the recipient
    │
    ├── Shows: Surgeon name, practice, role offered, permissions
    │
    ├── Recipient accepts → assignment created, appears in their surgeon list
    │
    └── Recipient declines → surgeon notified, no assignment created
```

### 4.2 Manager Invites Nurse (Delegated)

A manager with `manage staff` permission can invite nurses on behalf of the surgeon, using the same flow. The invitation comes from the surgeon's practice, not the manager personally.

### 4.3 What If the Invitee Isn't Registered?

- If the email doesn't match a registered user, the system sends an **email notification** to that address with a link to register
- The invitation remains pending until the user registers and accepts
- Pending invitations are visible to the surgeon in the staff management view
- Invitations expire after a configurable period (default: 30 days)

### 4.4 Revoking Access

- The surgeon (or authorised manager) can revoke a staff member's access at any time
- Revocation is immediate — the staff member loses access to that surgeon's data
- The staff member is notified via in-app message
- Revocation does not delete the staff member's account — they may still work with other surgeons

---

## 5. Multi-Surgeon Context (Nurse & Manager View)

### 5.1 Surgeon Selector

Nurses and managers who work with multiple surgeons see a **surgeon selector** (dropdown in the header or sidebar):

- Shows all surgeons they're currently assigned to
- Selecting a surgeon switches the entire app context to that surgeon's data
- The menu items and available features **adapt based on permissions** for the selected surgeon
- Features the user doesn't have permission for are **hidden** (not greyed out) — clean context-sensitive interface

### 5.2 Dashboard

The nurse/manager dashboard shows a **unified overview** before selecting a specific surgeon:

- **Pending chat messages** — across all assigned surgeons, grouped by surgeon
- **Consents awaiting review** — patient-completed consents needing validation (if permitted)
- **Patient progress** — active consent sessions with % progress
- **Notifications/alerts** — no-scan warnings, expiring consents, new patient matches
- **Pending invitations** — any new invitations from surgeons

Each item shows which surgeon it relates to. Clicking an item switches context to that surgeon.

---

## 6. In-App Messaging System

### 6.1 Overview

The in-app messaging system serves multiple purposes:
- Staff invitations (surgeon → manager/nurse)
- Permission change notifications
- Access revocation notifications
- System notifications (consent completed, patient questions, etc.)

### 6.2 Message Types

| Type | Sender | Recipient | Actionable |
|------|--------|-----------|------------|
| `staff_invitation` | Surgeon | Manager/Nurse | Accept / Decline |
| `permission_change` | Surgeon | Manager/Nurse | Informational |
| `access_revoked` | Surgeon | Manager/Nurse | Informational |
| `patient_question` | System | Nurse/Surgeon | Navigate to chat |
| `consent_completed` | System | Surgeon/Nurse | Navigate to review |
| `patient_matched` | System | Surgeon | Confirm / Reject match |
| `no_scan_warning` | System | Surgeon | Informational |
| `consent_expiring` | System | Surgeon + Patient | Informational |

### 6.3 Message Storage

Messages are stored in the `notifications` table (already exists) with additional fields for actionable messages:

- `action_type` — what action can be taken (e.g., 'accept_invitation', 'confirm_match')
- `action_data` — JSON payload with data needed to process the action (e.g., invitation ID, permissions)
- `action_taken` — whether the user has acted on the message
- `action_taken_at` — timestamp

---

## 7. Database Model

### 7.1 Staff Assignments (Updated)

```sql
-- Replaces nurse_surgeon_assignments with broader staff_assignments
staff_assignments
├── id (UUID, PK)
├── staff_user_id (FK → auth.users) — the manager or nurse
├── surgeon_id (FK → surgeon_profiles) — the surgeon they work for
├── staff_role ('manager' | 'nurse') — role in this relationship
├── permissions (text[]) — array of permission keys
├── invited_by (FK → auth.users) — who sent the invitation
├── invitation_status ('pending' | 'accepted' | 'declined' | 'expired')
├── invited_at (timestamptz)
├── accepted_at (timestamptz, nullable)
├── is_active (boolean, default true)
├── created_at (timestamptz)
├── updated_at (timestamptz)
├── UNIQUE(staff_user_id, surgeon_id)
```

### 7.2 Manager Permissions

Managers have the following permission keys:

| Permission Key | Description |
|---------------|-------------|
| `manage_staff` | Invite/remove nurses, set nurse permissions |
| `manage_patients` | Add, edit, merge patients |
| `manage_locations` | Create/edit surgery location templates |
| `view_consents` | Full read access to consent records |
| `prepare_documents` | Assign locations, generate PDFs |
| `answer_questions` | Respond to patient chat messages |
| `validate_consent` | Perform clinical review and validate consents |

### 7.3 Nurse Permissions

Nurses have a subset of permission keys:

| Permission Key | Description |
|---------------|-------------|
| `handle_consent_sections` | Assist with consent section preparation |
| `prepare_documents` | Prepare documents, assign locations, generate PDFs |
| `validate_consent` | Perform clinical review and validate consents |
| `answer_questions` | Respond to patient chat messages |

### 7.4 Notifications Table (Updated)

```sql
-- Add fields to existing notifications table
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_type TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_data JSONB;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_taken BOOLEAN DEFAULT false;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_taken_at TIMESTAMPTZ;
```

---

## 8. Access Control Matrix

### 8.1 Web App Feature Access

| Feature | Admin | Surgeon | Manager | Nurse |
|---------|-------|---------|---------|-------|
| Master operations list (CRUD) | ✅ | Read only | Read only | Read only |
| User management | ✅ | — | — | — |
| Platform metrics | ✅ | — | — | — |
| Own procedures (import/edit/create) | — | ✅ | — | — |
| Consent content builder | — | ✅ | — | Per permission |
| QR form pages | — | ✅ | Per permission | — |
| Patient management | — | ✅ | Per permission | — |
| Patient merge | — | ✅ | Per permission | — |
| Consent records (view) | — | ✅ | Per permission | Per permission |
| Consent review/validate | — | ✅ | Per permission | Per permission |
| Chat (respond to patients) | — | ✅ | Per permission | Per permission |
| Staff management (invite/revoke) | — | ✅ | Per permission | — |
| Surgery location templates | — | ✅ | Per permission | — |
| Settings (practice, expiry, etc.) | — | ✅ | — | — |

### 8.2 Mobile App Access

| Feature | Patient |
|---------|---------|
| Registration & profile | ✅ |
| QR code scanning | ✅ |
| Consent list (active + history) | ✅ Own only |
| Consent sections (read, listen, complete) | ✅ Own only |
| Quiz | ✅ Own only |
| Acknowledgments & signature | ✅ Own only |
| Chat (ask questions) | ✅ Own only |
| Voice recording | ✅ Own only |
| PDF viewing/download | ✅ Own only |
| Profile management | ✅ Own only |

---

## 9. Row-Level Security Principles

### 9.1 General Rules

- **Admin** sees platform-wide data (master list, all users) but not surgeon-specific clinical data unless explicitly needed
- **Surgeon** sees only their own data (procedures, patients, consents, staff)
- **Manager/Nurse** sees data scoped to the surgeons they're assigned to, further limited by their permissions
- **Patient** sees only their own profile and consent sessions

### 9.2 Staff Access Pattern

For manager and nurse RLS policies:
```sql
-- Staff can access surgeon data if they have an active assignment
staff_user_id = auth.uid()
AND surgeon_id IN (
  SELECT surgeon_id FROM staff_assignments
  WHERE staff_user_id = auth.uid()
  AND is_active = true
  AND invitation_status = 'accepted'
)
```

For permission-specific access, the application layer checks the `permissions` array before allowing actions. RLS provides the base data access; the UI enforces granular permission restrictions.

---

## 10. Session & Security

### 10.1 Session Management

- Web sessions: JWT tokens via Supabase Auth, auto-refresh
- Mobile sessions: JWT stored in device secure storage, auto-refresh
- Clinic tablet mode: session expires on inactivity, all local data cleared on sign-out

### 10.2 Security Measures

- All communication over HTTPS/TLS
- Passwords hashed by Supabase Auth (bcrypt)
- SMS OTP for mobile authentication
- Row-level security on all database tables
- File uploads (photos, voice recordings, documents) encrypted at rest in Supabase Storage
- Audit log records all significant actions (consent creation, validation, permission changes, data access)

### 10.3 Compliance

- Australian Privacy Act 1988 compliance
- Data retention: configurable per surgeon (default 7 years for consent records)
- Patient data export: available on request through the mobile app
- Patient data deletion: available subject to legal retention requirements
- Consent records are immutable once validated — cannot be edited or deleted within retention period

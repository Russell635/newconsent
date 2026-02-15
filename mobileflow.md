# ConsentMaker — Mobile App Specification

## 1. Overview

The ConsentMaker mobile app is the **patient-facing** application. It is the primary tool through which patients receive, review, and complete informed consent for surgical procedures. The app integrates tightly with the consent flow defined in [consentflow.md](consentflow.md).

A separate mobile app for surgeons/nurses may be developed later. This document covers the patient app only.

> **Related:** See [consentAuth.md](consentAuth.md) for roles, authentication, and access control. See [consentflow.md](consentflow.md) for the consent workflow. See [outputspec.md](outputspec.md) for the full product specification.

**Platform:** Android first, iOS to follow.
**Tech Stack:** React Native (Expo) + Supabase

---

## 2. Patient Registration & Identity

### 2.1 Registration Flow

Registration is via **phone number + SMS verification**:

1. Patient enters their mobile phone number
2. System sends an SMS verification code (via Supabase Auth or Twilio)
3. Patient enters the code to verify
4. Patient completes their profile (see 2.2)
5. Account is created — phone number is the primary identity

### 2.2 Clinic Tablet Mode

In some clinical settings, the patient may use a **clinic-owned iPad or tablet** rather than their own phone. In this case:

- The app detects or is configured as "clinic device" mode
- Authentication uses a **one-time code sent to the clinic's email address** instead of SMS
- The session is temporary — patient data is not persisted on the device after the session ends
- The patient's consent progress syncs to the server and can be continued on their own device later
- The app should prompt to clear the session when the patient is done

### 2.3 Patient Profile

The following fields are collected during or after registration:

| Field | Required | Notes |
|-------|----------|-------|
| Phone number | Yes | Primary identity, verified via SMS |
| First name | Yes | |
| Last name | Yes | |
| Date of birth | Yes | |
| Gender | Optional | |
| Email | Optional | Used for PDF delivery if provided |
| Address | Optional | |
| Medicare number | Optional | Can be added later; system must handle multiple Medicare formats (see 2.4) |
| Photo | Optional | Stored on system if provided; used for identity confirmation |
| Emergency contact name | Optional | |
| Emergency contact phone | Optional | |
| Emergency contact relationship | Optional | |

### 2.4 Medicare Number Handling

Australian Medicare numbers come in various formats:
- Standard: 10 digits (e.g., `2123 45670 1`)
- With IRN (Individual Reference Number): 11 digits
- Veterans' Affairs (DVA) numbers: different format entirely
- Patients may also have private health insurance numbers

The app must:
- Accept multiple formats without strict validation blocking entry
- Store the raw input alongside a normalised version for matching
- Display in a user-friendly format
- Support DVA numbers as an alternative identifier

### 2.5 Patient Photo

- Photo capture is **optional** but encouraged
- Can be taken via the device camera or selected from the gallery
- Stored in Supabase Storage, linked to the patient profile
- Used by surgeon/nurse for visual identity confirmation
- Not used for automated facial recognition (privacy compliance)

---

## 3. QR Code Scanner

### 3.1 Scanner Integration

- The app includes a **built-in QR code scanner** accessible from the home screen
- Uses the device camera (requires camera permission)
- Scans the QR code from the surgeon's printed form page
- Decodes the URL to extract the `surgeon_procedure_id` (GUID)

### 3.2 Post-Scan Flow

1. QR decoded → `surgeon_procedure_id` extracted
2. App sends to backend: patient identity + `surgeon_procedure_id`
3. Backend runs **patient matching** (see [consentflow.md](consentflow.md) Section 3.2):
   - Medicare match → auto-link
   - Name + DOB match → auto-link
   - Similar name, no DOB → flag for surgeon confirmation (patient sees "Awaiting confirmation from surgeon's office")
   - No match → auto-insert patient into surgeon's list
4. Consent session created → patient sees confirmation:
   - Procedure name
   - Surgeon name and practice
   - "Consent added to your list"
5. Patient is taken to the **consent list**

### 3.3 Error Handling

- **Invalid QR code**: "This doesn't appear to be a ConsentMaker code. Please try again."
- **Deleted procedure**: "This procedure is no longer available. Please contact your surgeon's office."
- **Network error**: "Unable to connect. Please check your internet connection and try again."
- **Duplicate scan** (same patient, same procedure, active consent exists): "You already have an active consent for this procedure." — option to view existing consent or create a new one (for re-consent scenarios)

---

## 4. Consent List (Home Screen)

### 4.1 Layout

The consent list is the **primary screen** of the app after registration. It shows all of the patient's consents across all surgeons, organised by status.

**Active Consents** (top of list):
- Not Started — procedure name, surgeon name, date scanned
- In Progress — procedure name, surgeon name, **% completion**, progress bar
- Awaiting Review — completed by patient, waiting for surgeon/nurse review

**Completed Consents** (below active, collapsible):
- Valid — procedure name, surgeon name, date validated
- Tap to view the consent summary and **download/view the PDF**

### 4.2 Consent Card Display

Each consent item shows:
- Procedure name (primary text)
- Surgeon name and practice
- Status badge (Not Started / In Progress / Awaiting Review / Valid)
- Progress indicator (% bar for in-progress)
- Date scanned / date completed
- Expiry warning if approaching expiry date

### 4.3 Past Consent History

- All completed and validated consents remain accessible indefinitely
- Patient can view the summary and associated PDF for any past consent
- History spans all surgeons — the patient has a single unified view

---

## 5. Consent Session Experience

### 5.1 Section Overview Screen

When a patient opens a consent session, they see an **overview of all sections** with visual status indicators:

| Indicator | Meaning |
|-----------|---------|
| Grey circle | Not started |
| Amber partial circle | Partially completed (started but not finished) |
| Green checkmark | Completed |

Sections are listed in the surgeon's recommended order but the patient can **navigate freely** — tap any section to open it.

### 5.2 Section Types

Each section renders content appropriate to its type:

- **Text content** — rich text (HTML rendered from TipTap content)
- **Images** — inline within text, or in a gallery view
- **Video** — embedded video player (online only — see Section 7)
- **Audio** — embedded audio player
- **Acknowledgments** — checkbox items the patient must check
- **Quiz** — multiple choice / true-false questions
- **Signature** — signature capture pad

### 5.3 Section Completion Logic

A section is marked as **completed** when:
- **Text/media sections**: the patient has scrolled through or spent a minimum time (engagement tracking)
- **Acknowledgment sections**: all checkboxes are checked
- **Quiz sections**: quiz is passed (minimum score met)
- **Signature section**: signature is captured and confirmed

### 5.4 Final Submission

When all sections are complete:
1. The app shows a **summary screen** listing all completed sections with timestamps
2. Patient reviews and taps "Submit Consent"
3. Status changes to `patient_completed`
4. Patient sees confirmation: "Your consent has been submitted. Your surgeon's team will review it."
5. The consent locks on the patient side — no further changes possible
6. Patient summary PDF becomes available for viewing/download

---

## 6. Multimedia & Accessibility

### 6.1 Text-to-Speech

Available from V1 — every text-based section can be **read aloud** to the patient:

- A "Listen" button appears on each text section
- Uses synthesised voice (device TTS engine or cloud-based for higher quality)
- Patient can play, pause, and control playback speed
- The app highlights the current paragraph/sentence being read (if feasible)
- Language: English (Australian accent preferred where available)

### 6.2 Voice Recording for Questions

Instead of typing a chat message, the patient can **record a voice message**:

- A microphone button in the chat interface
- Patient records their question as audio
- Audio is uploaded and attached to the chat message
- The surgeon/nurse receives the audio in the chat transcript
- The audio is also transcribed to text (using a speech-to-text service) for searchability and review convenience
- Both the audio and transcription are stored

### 6.3 Video & Rich Media Playback

- Video content (e.g., procedure animations, surgeon explanations) plays inline
- Supports standard formats (MP4, WebM)
- Video content is **online only** — not cached for offline use (too large)
- A placeholder message shows when offline: "Video content requires an internet connection"
- Audio files may be cached for offline playback (smaller file sizes)

### 6.4 Accessibility Features

- **Large text support** — respects device accessibility settings for font size
- **Screen reader support** — all UI elements have appropriate accessibility labels
- **High contrast mode** — support for device-level contrast settings
- **Touch target sizing** — minimum 44x44pt touch targets throughout

---

## 7. Offline Support

### 7.1 Strategy

The app follows a **cache-first, sync-when-online** approach for consent content:

- When a consent session is created (after QR scan), the app **downloads and caches** the consent content for that session
- Cached content includes: text sections, images, acknowledgment items, quiz questions
- **Not cached**: video content, chat functionality
- Progress is saved locally and **synced to the server** when connectivity is restored

### 7.2 What Works Offline

| Feature | Offline | Notes |
|---------|---------|-------|
| View consent sections (text + images) | Yes | Cached on first load |
| Read acknowledgments | Yes | Cached |
| Take quiz | Yes | Questions cached; results sync later |
| Text-to-speech | Depends | Device TTS works offline; cloud TTS does not |
| Capture signature | Yes | Syncs when online |
| View progress / consent list | Yes | Local cache |
| Watch videos | No | Requires streaming |
| Chat (send/receive messages) | No | Requires real-time connection |
| Voice recording | Partial | Can record offline; upload syncs when online |
| QR code scanning | No | Requires server call to create consent session |
| Submit final consent | No | Requires server confirmation |

### 7.3 Sync Behaviour

- The app checks for connectivity on launch and periodically
- When connectivity is restored, queued actions sync automatically:
  - Section progress updates
  - Quiz responses
  - Acknowledgment completions
  - Signature data
  - Voice recordings
- Conflict resolution: server timestamp wins (last-write-wins for progress; append-only for quiz attempts and chat)
- A sync indicator shows the patient whether their data is up to date

### 7.4 Content Versioning & Cache

- Content is cached **at the locked consent version** — even if the surgeon updates the procedure, the cached content matches the version the patient was assigned
- Cache is cleared for a consent session when it reaches `valid` status (PDF remains accessible)
- Cache storage limit: warn patient if device storage is low

---

## 8. Chat Integration

### 8.1 Overview

Chat is the patient's channel for asking questions during the consent process. In V1, this is **text-based human chat** with voice recording support. AI-assisted chat is planned for a future release.

### 8.2 Initiating Chat

- A "Ask a Question" button is available within each consent section
- Tapping it opens a chat interface **pre-tagged with the current section** (e.g., "Question about: Risks & Complications")
- The surgeon/nurse sees this context when responding

### 8.3 Chat Interface

- Simple messaging UI (similar to SMS/WhatsApp)
- Patient can:
  - Type a text message
  - Record a voice message (microphone button)
- Messages show sender, timestamp, and read status
- New messages trigger a push notification if the app is backgrounded

### 8.4 Chat Availability

- Chat requires an **active internet connection**
- If offline, the chat button shows "Chat available when online"
- Voice recordings made offline are queued and sent when connectivity resumes

---

## 9. Notifications

### 9.1 Push Notifications

The app uses push notifications (Firebase Cloud Messaging for Android) for:

| Event | Notification |
|-------|-------------|
| New consent added (after QR scan) | "New consent for [Procedure] with Dr [Name] has been added" |
| Chat message received | "Dr [Name]'s team replied to your question" |
| Consent validated | "Your consent for [Procedure] has been approved" |
| Consent nearing expiry | "Your consent for [Procedure] expires in [X] days" |
| Surgeon confirmation needed | "Dr [Name]'s office is confirming your identity — you'll be notified when ready" |

### 9.2 In-App Notifications

- A notification bell/badge on the home screen
- Notification history list showing all past notifications
- Tapping a notification navigates to the relevant consent or chat

---

## 10. Data & Privacy

### 10.1 Local Storage

- Patient profile data stored in secure device storage (encrypted)
- Consent content cached in app storage (clearable)
- No sensitive data (Medicare numbers, signatures) stored in plain text on device
- Session tokens managed by Supabase Auth SDK

### 10.2 Data Transmission

- All API calls over HTTPS
- Supabase real-time subscriptions for chat (WebSocket over TLS)
- File uploads (photos, voice recordings) via Supabase Storage (encrypted at rest)

### 10.3 Clinic Tablet Mode — Data Hygiene

- When in clinic tablet mode, no patient data persists on the device after session end
- The app prompts for session clearance: "Are you finished? This will clear your data from this device."
- Automatic session timeout after configurable period of inactivity (e.g., 15 minutes)
- All local caches and tokens are purged on session end

### 10.4 Compliance

- Australian Privacy Act 1988 compliance
- Patient data retained per surgeon's retention policy (default 7 years — see [consentflow.md](consentflow.md))
- Patient can request data export or deletion through the app (subject to legal retention requirements)

---

## 11. Navigation & Screen Map

```
App Launch
    │
    ├─ Not registered → Registration Flow
    │   ├── Enter phone number
    │   ├── SMS verification code
    │   ├── Profile setup (name, DOB, optional fields)
    │   └── → Home (Consent List)
    │
    ├─ Registered → Home (Consent List)
    │   ├── Active Consents
    │   │   └── Tap → Consent Session
    │   │       ├── Section Overview
    │   │       ├── Section Detail (text, media, acknowledgments)
    │   │       ├── Quiz
    │   │       ├── Signature Capture
    │   │       ├── Chat (per section)
    │   │       └── Submit Consent
    │   ├── Completed Consents
    │   │   └── Tap → Consent Summary + PDF
    │   └── QR Scanner (floating action button or tab)
    │
    ├─ Profile / Settings
    │   ├── Edit profile details
    │   ├── Add/edit Medicare number
    │   ├── Update photo
    │   ├── Notification preferences
    │   └── Privacy & data management
    │
    └─ Notifications
        └── Notification history list
```

---

## 12. Integration Points with Web App

These are the key touchpoints where the mobile app and the surgeon's web app interact:

| Mobile App Action | Web App / Backend Effect |
|-------------------|------------------------|
| QR scan | Creates consent session; triggers patient matching; surgeon notified |
| Section progress saved | Surgeon sees updated % completion in real-time |
| Chat message sent | Appears in surgeon/nurse chat dashboard; push notification to responder |
| Voice recording uploaded | Transcribed and attached to chat; available in surgeon's review |
| Quiz completed | Results stored; visible in surgeon's review dashboard |
| Consent submitted | Status → `patient_completed`; surgeon/nurse notified for review |
| Patient profile updated | Updates reflected in surgeon's patient list (if matched) |

---

## 13. Technical Considerations

### 13.1 React Native Expo Setup

- **Expo SDK**: latest stable
- **Navigation**: React Navigation (stack + bottom tabs)
- **State management**: React Context + useReducer (or Zustand if complexity warrants)
- **Camera/QR**: `expo-camera` with barcode scanning
- **Audio recording**: `expo-av`
- **Text-to-speech**: `expo-speech` (device TTS) with optional cloud TTS upgrade
- **Push notifications**: `expo-notifications` + Firebase Cloud Messaging
- **Secure storage**: `expo-secure-store` for tokens and sensitive data
- **Offline storage**: SQLite via `expo-sqlite` or AsyncStorage for consent content cache
- **File uploads**: Supabase Storage JS client

### 13.2 Supabase Integration

- **Auth**: phone/SMS authentication via Supabase Auth
- **Database**: Supabase JS client for CRUD operations
- **Real-time**: Supabase Realtime for chat messages
- **Storage**: Supabase Storage for photos, voice recordings, PDFs
- **Edge Functions**: for patient matching logic, PDF generation triggers, SMS sending

### 13.3 Offline Architecture

```
┌─────────────────────────────────┐
│         Mobile App              │
│  ┌───────────┐  ┌────────────┐  │
│  │ UI Layer  │  │ Sync Queue │  │
│  └─────┬─────┘  └──────┬─────┘  │
│        │               │        │
│  ┌─────▼───────────────▼─────┐  │
│  │    Local Cache (SQLite)   │  │
│  │  - Consent content        │  │
│  │  - Section progress       │  │
│  │  - Quiz responses         │  │
│  │  - Pending uploads        │  │
│  └─────────────┬─────────────┘  │
└────────────────┼────────────────┘
                 │ sync when online
                 ▼
        ┌────────────────┐
        │   Supabase     │
        │  (PostgreSQL   │
        │  + Storage     │
        │  + Realtime)   │
        └────────────────┘
```

---

## 14. Future Enhancements (Not V1)

- **iOS build** — second platform after Android launch
- **AI chat** — AI-first responder using consent content as context, with human escalation
- **Biometric login** — fingerprint / face unlock after initial phone verification
- **Multi-language** — consent content translated and displayed in patient's preferred language
- **Accessibility audio descriptions** — AI-generated audio descriptions of images and diagrams
- **Surgeon/nurse mobile app** — separate app for clinical team mobile access
- **Apple Health / Google Health integration** — pre-populate patient data from health records

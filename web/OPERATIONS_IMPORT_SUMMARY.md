# Master Operations Import — Complete Setup

## What's Been Built

### 1. Database Schema (Migration SQL)
**File:** `supabase/migrations/001_create_master_operations.sql`

Creates 6 new tables in Supabase:
- `master_specialties` — surgical specialties (16 to import)
- `master_fields` — anatomical regions (30 to import)
- `master_operations` — procedures (35 unique operations)
- `operation_specialties` — many-to-many linking operations to specialties
- `operation_fields` — many-to-many linking operations to fields
- `master_complications` — surgical risks/complications (191 to import)

**Key features:**
- Foreign key constraints with cascading deletes
- Unique constraints to prevent duplicates
- Indexes for performance
- RLS policies for read/write access

### 2. Import Script
**File:** `scripts/import-master-data.ts`

Automates the full import process:
1. Connects to old Supabase database (via `.env.test` credentials)
2. Fetches all 35 operations + 191 complications
3. **Normalizes** the data:
   - Deduplicates operations (35 rows → 25 unique operations)
   - Extracts specialties and fields
   - Builds many-to-many relationships
4. Inserts into new Supabase
5. Validates all references

**Intelligence:**
- Handles duplicate operations (same operation in multiple specialties)
- Deduplicates many-to-many relationships
- Gracefully handles already-existing data
- Detailed progress reporting

### 3. Migration Helper Script
**File:** `scripts/run-migration.ts`

Displays the SQL migration in the terminal so you can:
1. Copy it
2. Paste into Supabase SQL Editor
3. Run manually

Or build it into CI/CD for automated migrations.

### 4. Documentation
**File:** `IMPORT_MASTER_DATA.md`

Complete guide including:
- Step-by-step import process
- Troubleshooting
- Verification queries
- Next steps for the web app

## How to Run

### Step 1: Create the Tables

Option A (Manual - Recommended for first time):
```bash
npx tsx scripts/run-migration.ts
```
Then copy the SQL output and paste into: https://[your-project].supabase.co/sql/new

Option B (Automated - Requires service role key in environment):
```bash
# Would need additional setup
```

### Step 2: Import the Data

```bash
npm run import:master-data
```

This connects to both old and new Supabase, normalizes the data, and imports everything.

## Data Being Imported

### Operations
- **Source:** 35 rows from `master_operations` table
- **Destination:** ~25 unique operations (after deduplication)
- **Example operations:**
  - Appendectomy
  - Cholecystectomy
  - Hernia Repair
  - Thyroidectomy
  - Total Hip Replacement
  - Coronary Angioplasty
  - Brain Tumor Resection
  - ... and 28 more

### Specialties
- **Source:** 16 unique specialty_ids
- **Destination:** `master_specialties` table
- **Examples:** General Surgery, Cardiac Surgery, Orthopedics, etc.

### Fields (Body Parts)
- **Source:** 30 unique field_ids
- **Destination:** `master_fields` table
- **Examples:** Abdomen, Knee, Hip, Chest, Neck, etc.

### Complications
- **Source:** 191 rows from `master_complications` table
- **Destination:** `master_complications` table
- **Linked to:** Each operation has its own set of complications
- **Severity levels:** low, medium, high, critical
- **Examples per operation:**
  - Appendectomy: Bleeding, Infection, Bowel Perforation
  - Coronary Angioplasty: Restenosis, Dissection, Heart Attack
  - Rhinoplasty: Asymmetry, Scarring, Skin Numbness

## Architecture

### Old Database (source)
```
master_operations (35 rows, denormalized)
├── id, name, description
├── specialty_id (FK)
└── field_id (FK)

master_complications (191 rows)
├── id, name, description
├── operation_id (FK)
├── severity, is_ai_generated, approved
└── is_systemic
```

### New Database (normalized)
```
master_specialties
├── id, name, description

master_fields
├── id, name, description

master_operations (deduplicated)
├── id, name, description, body_region
├── is_ai_generated, approved, has_been_used

operation_specialties (many-to-many)
├── operation_id, specialty_id

operation_fields (many-to-many)
├── operation_id, field_id

master_complications
├── operation_id (FK)
├── name, description, severity
├── is_ai_generated, approved, is_systemic
```

## Key Design Decisions

1. **Normalization:** Operations are deduplicated (one per unique name), with separate many-to-many tables for specialties and fields. This is cleaner than the denormalized old database.

2. **Complications per Operation:** Each complication is linked to ONE specific operation, not to a field or specialty. This allows:
   - Different "Total Knee Replacement" and "Knee Arthroscopy" to have different complication profiles
   - Surgeon to see operation-specific risks when importing

3. **Read-only Master List:** RLS policies allow all authenticated users to READ the master list, but writes are restricted to admins (enforced by application layer).

4. **Cascading Deletes:** If an operation is deleted, all related complications are automatically deleted.

5. **Unique Constraints:**
   - Operation names are unique (no duplicates)
   - operation_specialties and operation_fields have composite unique constraints

## Next Steps for Web App

### Phase 1: Admin Master List Viewer
- [ ] Display specialties on `/admin/master-list`
- [ ] Display operations per specialty
- [ ] Show complications for each operation
- [ ] Filter by name, specialty, field
- [ ] Edit/approve AI-generated operations

### Phase 2: Surgeon Import Flow
- [ ] Create `/surgeon/procedures/import` page
- [ ] Browse master operations by specialty/field
- [ ] Select operations to import into personal list
- [ ] Confirm import (shows which complications are included)
- [ ] Create surgeon_procedures table (copy of master operation with customizations)

### Phase 3: Operation Management
- [ ] Surgeon can edit imported operations
- [ ] Surgeon can add/remove complications for their copy
- [ ] Version tracking for changes
- [ ] Notification when master list operation is updated

### Phase 4: QR Form Pages
- [ ] Link to `qr_form_pages` table (already designed in spec)
- [ ] Surgeon creates pages grouping operations by field
- [ ] Print QR codes for each page
- [ ] Patients scan and select specific operation

## Files Created

```
web/
├── supabase/
│   └── migrations/
│       └── 001_create_master_operations.sql
├── scripts/
│   ├── import-master-data.ts
│   └── run-migration.ts
├── IMPORT_MASTER_DATA.md
└── OPERATIONS_IMPORT_SUMMARY.md
```

## Verification

After import, verify with queries:

```sql
-- Count operations
SELECT COUNT(*) FROM master_operations;  -- ~25

-- Count complications
SELECT COUNT(*) FROM master_complications;  -- 191

-- See operation with most complications
SELECT
  o.name,
  COUNT(c.id) as complication_count
FROM master_operations o
LEFT JOIN master_complications c ON c.operation_id = o.id
GROUP BY o.id, o.name
ORDER BY complication_count DESC
LIMIT 1;

-- See an operation's specialties
SELECT o.name, s.name as specialty
FROM master_operations o
JOIN operation_specialties os ON os.operation_id = o.id
JOIN master_specialties s ON s.id = os.specialty_id
WHERE o.name = 'Total Knee Replacement';

-- See an operation's affected fields
SELECT o.name, f.name as field
FROM master_operations o
JOIN operation_fields of ON of.operation_id = o.id
JOIN master_fields f ON f.id = of.field_id
WHERE o.name = 'Total Knee Replacement';
```

## Troubleshooting

See `IMPORT_MASTER_DATA.md` for detailed troubleshooting guide.

Quick commands:
- Reset tables: `DELETE FROM master_complications; DELETE FROM master_operations; ...`
- Check credentials: Verify `.env.test` has all 4 keys
- Verify old DB: `npx tsx -e "import { createClient } from '@supabase/supabase-js'; ..."`

Ready to proceed! 🚀

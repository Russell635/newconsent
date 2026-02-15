# Import Master Operations & Complications

This guide walks through importing the master operations list (35 operations, 191 complications) from the old Supabase database to the new ConsentMaker Supabase project.

## Overview

The import process:
1. Creates the new schema in Supabase (tables + RLS policies)
2. Extracts data from old database
3. Normalizes operations (deduplicates, builds many-to-many relationships)
4. Imports all complications linked to operations
5. Creates relationships between operations, specialties, and fields

## What Gets Imported

**From old database:**
- **35 operations** (deduplicated by name)
- **16 specialties**
- **30 fields** (anatomical regions/body parts)
- **191 complications** (linked to operations)

**Result in new database:**
- `master_operations` — 35 unique procedures
- `master_specialties` — 16 specialties
- `master_fields` — 30 anatomical regions
- `operation_specialties` (many-to-many) — operations can appear in multiple specialties
- `operation_fields` (many-to-many) — operations can affect multiple fields
- `master_complications` — 191 complications linked to specific operations

## Step 1: Create the Schema

Run the migration SQL to create all tables in your Supabase project.

```bash
npm run import:master-data -- show-sql
```

This prints the SQL. Copy it and paste into your Supabase SQL Editor:
- Go to: https://[your-project].supabase.co/sql/new
- Paste the entire SQL block
- Click "Run"

Or run directly via script:

```bash
npx tsx scripts/run-migration.ts
```

## Step 2: Verify Tables Were Created

Check your Supabase dashboard that these tables exist:
- ✓ `master_specialties`
- ✓ `master_fields`
- ✓ `master_operations`
- ✓ `operation_specialties`
- ✓ `operation_fields`
- ✓ `master_complications`

## Step 3: Run the Import

Execute the import script:

```bash
npm run import:master-data
```

This will:
1. Connect to old Supabase database (using credentials from `.env.test`)
2. Fetch all operations and complications
3. Deduplicate and normalize the data
4. Insert into new Supabase
5. Build many-to-many relationships

**Output will look like:**
```
🔄 Starting import of master operations and complications...

📥 Fetching data from old database...
✓ Fetched 35 operations
✓ Fetched 191 complications

🔧 Normalizing operations data...
✓ Found 25 unique operations
✓ Found 16 unique specialties
✓ Found 30 unique fields

📤 Inserting into new database...
• Inserting specialties...
  ✓ Inserted 16 specialties
• Inserting fields...
  ✓ Inserted 30 fields
• Inserting operations...
  ✓ Inserted 25 operations
• Inserting operation-specialty relationships...
  ✓ Inserted 35 operation-specialty relationships
• Inserting operation-field relationships...
  ✓ Inserted 50 operation-field relationships
• Inserting complications...
  ✓ Inserted 191 complications

✅ Import complete!

Summary:
  • Specialties: 16
  • Fields: 30
  • Operations: 25
  • Operation-Specialty relationships: 35
  • Operation-Field relationships: 50
  • Complications: 191
```

## Step 4: Verify the Import

Query your new database to verify:

```sql
-- Check operations
SELECT COUNT(*) as total FROM master_operations;  -- Should be ~25

-- Check complications
SELECT COUNT(*) as total FROM master_complications;  -- Should be 191

-- Check a specific operation's complications
SELECT op.name, COUNT(c.id) as complication_count
FROM master_operations op
LEFT JOIN master_complications c ON c.operation_id = op.id
GROUP BY op.id, op.name
ORDER BY complication_count DESC
LIMIT 10;
```

## Data Structure

### Operations

Each operation can appear in multiple specialties and affect multiple fields:

```
master_operations
├── id
├── name: "Total Knee Replacement"
├── description
├── body_region: "Knee"
└── ...

operation_specialties
├── operation_id → master_operations.id
└── specialty_id → master_specialties.id

operation_fields
├── operation_id → master_operations.id
└── field_id → master_fields.id
```

### Complications

Each complication is linked to ONE specific operation:

```
master_complications
├── id
├── operation_id → master_operations.id
├── name: "Infection"
├── severity: "medium"
├── is_ai_generated: true
└── approved: false
```

## Troubleshooting

### "Table already exists" errors

The import script handles this gracefully. If tables exist, it will try to use existing IDs.

To start fresh, delete the tables in Supabase SQL Editor:

```sql
drop table if exists master_complications cascade;
drop table if exists operation_fields cascade;
drop table if exists operation_specialties cascade;
drop table if exists master_operations cascade;
drop table if exists master_fields cascade;
drop table if exists master_specialties cascade;
```

Then re-run the migration and import.

### Old database connection fails

Make sure `.env.test` has:
- `OLD_SUPABASE_URL`
- `OLD_SUPABASE_SERVICE_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Complications not imported

Check that the operations were imported first. Complications reference `operation_id`, so operations must exist.

If some operations were already in the new database with different IDs, the script should still find them by name.

## Next Steps

Once imported:

1. **View in admin UI**: Go to `/admin/master-list` to see specialties and operations
2. **Surgeon import flow**: Build `/surgeon/procedures/import` page to let surgeons select operations from master list
3. **Approval workflow**: Admin can approve/reject AI-generated operations and complications
4. **Customize content**: Surgeons import and add their own content (risks, benefits, etc.)

## Files

- `supabase/migrations/001_create_master_operations.sql` — DDL for all tables
- `scripts/import-master-data.ts` — Main import script
- `scripts/run-migration.ts` — Helper to display SQL for manual running

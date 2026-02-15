# Quick Start: Import Master Operations

## TL;DR

```bash
# 1. Display the migration SQL
npm run import:master-data

# Actually that's the wrong command. Let me fix the readme first...
```

## One-Minute Setup

### Step 1: View the Migration SQL
```bash
npx tsx scripts/run-migration.ts
```

Copy the entire SQL output.

### Step 2: Run the SQL
1. Go to: https://your-project.supabase.co/sql/new
2. Paste the SQL
3. Click "Run"

### Step 3: Import the Data
```bash
npm run import:master-data
```

Done! ✅

## What Gets Imported

| Table | Count | From Old DB |
|-------|-------|------------|
| master_specialties | 16 | specialty_ids |
| master_fields | 30 | field_ids (body regions) |
| master_operations | ~25 | 35 rows, deduplicated by name |
| operation_specialties | 35 | many-to-many relationships |
| operation_fields | 50 | many-to-many relationships |
| master_complications | 191 | all complications linked to operations |

## Verify Import

```sql
SELECT COUNT(*) FROM master_operations;       -- Should be ~25
SELECT COUNT(*) FROM master_complications;    -- Should be 191
SELECT COUNT(*) FROM master_specialties;      -- Should be 16
SELECT COUNT(*) FROM master_fields;           -- Should be 30
```

## Environment

Make sure `.env.test` has these keys:

```
OLD_SUPABASE_URL=https://egcuvizftkytnjuwpyft.supabase.co
OLD_SUPABASE_SERVICE_KEY=eyJ...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

## Next Steps

After import, you can:
1. View master list at `/admin/master-list` (coming soon)
2. Build surgeon import UI at `/surgeon/procedures/import`
3. Create custom operations and add content
4. Print QR codes for patient consent flows

## Help

For detailed guide: See `IMPORT_MASTER_DATA.md`
For architecture details: See `OPERATIONS_IMPORT_SUMMARY.md`

## Issues?

Most common:
- **"Table already exists"** → Normal, script handles this
- **Connection fails** → Check `.env.test` credentials
- **No data imported** → Verify old Supabase service key works

See `IMPORT_MASTER_DATA.md` troubleshooting section.

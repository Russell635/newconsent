/**
 * Run Supabase migration SQL
 *
 * NOTE: Supabase doesn't expose a direct SQL execution API from client side.
 * This script prints out the SQL that needs to be run manually in the Supabase SQL Editor.
 *
 * Usage: npx tsx scripts/run-migration.ts
 *
 * Then copy the SQL output and paste it into: https://[your-project].supabase.co/sql/new
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  try {
    console.log('📋 Reading migration file...\n');
    const migrationSql = readFileSync(
      resolve(__dirname, '../supabase/migrations/001_create_master_operations.sql'),
      'utf-8'
    );

    console.log('=' .repeat(80));
    console.log('SUPABASE SQL MIGRATION');
    console.log('=' .repeat(80));
    console.log('\n📝 Copy the SQL below and paste it into your Supabase SQL Editor:\n');
    console.log('   https://[your-project].supabase.co/sql/new\n');
    console.log('=' .repeat(80));
    console.log(migrationSql);
    console.log('=' .repeat(80));
    console.log('\n✅ After running the SQL, execute: npm run import:master-data');

  } catch (error) {
    console.error('❌ Failed to read migration file:', error);
    process.exit(1);
  }
}

runMigration();

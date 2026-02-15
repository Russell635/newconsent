/**
 * Import master operations and complications from old Supabase to new Supabase
 *
 * Usage: npx tsx scripts/import-master-data.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

const OLD_URL = process.env.OLD_SUPABASE_URL!;
const OLD_SERVICE_KEY = process.env.OLD_SUPABASE_SERVICE_KEY!;
const NEW_URL = process.env.SUPABASE_URL!;
const NEW_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const oldDb = createClient(OLD_URL, OLD_SERVICE_KEY);
const newDb = createClient(NEW_URL, NEW_SERVICE_KEY);

interface OldOperation {
  id: string;
  name: string;
  description: string;
  specialty_id: string;
  field_id: string;
  body_region: string;
  is_ai_generated: boolean;
  approved: boolean;
  has_been_used: boolean;
}

interface OldComplication {
  id: string;
  operation_id: string;
  name: string;
  description: string;
  severity: string;
  is_ai_generated: boolean;
  approved: boolean;
  is_systemic: boolean;
}

async function importMasterData() {
  try {
    console.log('🔄 Starting import of master operations and complications...\n');

    // Step 1: Fetch data from old DB
    console.log('📥 Fetching data from old database...');
    const { data: oldOps, error: opsError } = await oldDb
      .from('master_operations')
      .select('*');

    const { data: oldComps, error: compsError } = await oldDb
      .from('master_complications')
      .select('*');

    if (opsError || compsError) {
      throw new Error(`Failed to fetch from old DB: ${opsError?.message} ${compsError?.message}`);
    }

    console.log(`✓ Fetched ${oldOps?.length || 0} operations`);
    console.log(`✓ Fetched ${oldComps?.length || 0} complications\n`);

    // Step 2: Normalize operations (deduplicate and extract specialties/fields)
    console.log('🔧 Normalizing operations data...');

    const uniqueSpecialties = new Map<string, string>(); // id -> name
    const uniqueFields = new Map<string, string>(); // id -> name
    const uniqueOperations = new Map<string, OldOperation>(); // name -> operation
    const opSpecialties: Array<{ op_name: string; spec_id: string }> = [];
    const opFields: Array<{ op_name: string; field_id: string }> = [];

    oldOps?.forEach(op => {
      // Track unique specialties and fields
      if (op.specialty_id && !uniqueSpecialties.has(op.specialty_id)) {
        uniqueSpecialties.set(op.specialty_id, `Specialty_${op.specialty_id.slice(0, 8)}`);
      }
      if (op.field_id && !uniqueFields.has(op.field_id)) {
        uniqueFields.set(op.field_id, op.body_region || `Field_${op.field_id.slice(0, 8)}`);
      }

      // Track unique operations by name
      if (!uniqueOperations.has(op.name)) {
        uniqueOperations.set(op.name, op);
      }

      // Track specialty and field relationships
      if (op.specialty_id) {
        opSpecialties.push({ op_name: op.name, spec_id: op.specialty_id });
      }
      if (op.field_id) {
        opFields.push({ op_name: op.name, field_id: op.field_id });
      }
    });

    console.log(`✓ Found ${uniqueOperations.size} unique operations`);
    console.log(`✓ Found ${uniqueSpecialties.size} unique specialties`);
    console.log(`✓ Found ${uniqueFields.size} unique fields\n`);

    // Step 3: Build mapping of old IDs to new IDs
    const specMap = new Map<string, string>(); // old ID -> new ID
    const fieldMap = new Map<string, string>(); // old ID -> new ID
    const opMap = new Map<string, string>(); // operation name -> new ID

    // Step 4: Insert into new DB
    console.log('📤 Inserting into new database...\n');

    // Insert specialties
    console.log('• Inserting specialties...');
    const specInserts = Array.from(uniqueSpecialties.entries()).map(([oldId, name]) => ({
      name: name || `Specialty_${oldId.slice(0, 8)}`
    }));

    const { data: newSpecs, error: specInsertError } = await newDb
      .from('master_specialties')
      .insert(specInserts)
      .select('id, name');

    if (specInsertError) {
      console.log(`  ⚠️ Error inserting specialties (may already exist): ${specInsertError.message}`);
      // Try to fetch existing ones
      const { data: existing } = await newDb
        .from('master_specialties')
        .select('id, name');

      existing?.forEach(spec => {
        const oldId = Array.from(uniqueSpecialties.entries()).find(([_, name]) => name === spec.name)?.[0];
        if (oldId) specMap.set(oldId, spec.id);
      });
    } else {
      newSpecs?.forEach((spec: any) => {
        const oldId = Array.from(uniqueSpecialties.entries()).find(([_, name]) => name === spec.name)?.[0];
        if (oldId) specMap.set(oldId, spec.id);
      });
      console.log(`  ✓ Inserted ${newSpecs?.length || 0} specialties`);
    }

    // Insert fields
    console.log('• Inserting fields...');
    const fieldInserts = Array.from(uniqueFields.entries()).map(([oldId, name]) => ({
      name: name || `Field_${oldId.slice(0, 8)}`
    }));

    const { data: newFields, error: fieldInsertError } = await newDb
      .from('master_fields')
      .insert(fieldInserts)
      .select('id, name');

    if (fieldInsertError) {
      console.log(`  ⚠️ Error inserting fields (may already exist): ${fieldInsertError.message}`);
      const { data: existing } = await newDb
        .from('master_fields')
        .select('id, name');

      existing?.forEach(field => {
        const oldId = Array.from(uniqueFields.entries()).find(([_, name]) => name === field.name)?.[0];
        if (oldId) fieldMap.set(oldId, field.id);
      });
    } else {
      newFields?.forEach((field: any) => {
        const oldId = Array.from(uniqueFields.entries()).find(([_, name]) => name === field.name)?.[0];
        if (oldId) fieldMap.set(oldId, field.id);
      });
      console.log(`  ✓ Inserted ${newFields?.length || 0} fields`);
    }

    // Insert operations
    console.log('• Inserting operations...');
    const opInserts = Array.from(uniqueOperations.values()).map(op => ({
      name: op.name,
      description: op.description,
      body_region: op.body_region,
      is_ai_generated: op.is_ai_generated,
      approved: op.approved,
      has_been_used: op.has_been_used
    }));

    const { data: newOps, error: opInsertError } = await newDb
      .from('master_operations')
      .insert(opInserts)
      .select('id, name');

    if (opInsertError) {
      console.log(`  ⚠️ Error inserting operations (may already exist): ${opInsertError.message}`);
      const { data: existing } = await newDb
        .from('master_operations')
        .select('id, name');

      existing?.forEach((op: any) => {
        opMap.set(op.name, op.id);
      });
    } else {
      newOps?.forEach((op: any) => {
        opMap.set(op.name, op.id);
      });
      console.log(`  ✓ Inserted ${newOps?.length || 0} operations`);
    }

    // Insert operation_specialties relationships
    console.log('• Inserting operation-specialty relationships...');
    const opSpecInserts = opSpecialties
      .filter(rel => opMap.has(rel.op_name) && specMap.has(rel.spec_id))
      .map(rel => ({
        operation_id: opMap.get(rel.op_name)!,
        specialty_id: specMap.get(rel.spec_id)!
      }));

    // Deduplicate
    const uniqueOpSpecs = Array.from(new Map(
      opSpecInserts.map(x => [`${x.operation_id}-${x.specialty_id}`, x])
    ).values());

    if (uniqueOpSpecs.length > 0) {
      const { error: opSpecError } = await newDb
        .from('operation_specialties')
        .insert(uniqueOpSpecs);

      if (opSpecError && !opSpecError.message.includes('duplicate')) {
        console.log(`  ⚠️ Error inserting operation_specialties: ${opSpecError.message}`);
      } else {
        console.log(`  ✓ Inserted ${uniqueOpSpecs.length} operation-specialty relationships`);
      }
    }

    // Insert operation_fields relationships
    console.log('• Inserting operation-field relationships...');
    const opFieldInserts = opFields
      .filter(rel => opMap.has(rel.op_name) && fieldMap.has(rel.field_id))
      .map(rel => ({
        operation_id: opMap.get(rel.op_name)!,
        field_id: fieldMap.get(rel.field_id)!
      }));

    // Deduplicate
    const uniqueOpFields = Array.from(new Map(
      opFieldInserts.map(x => [`${x.operation_id}-${x.field_id}`, x])
    ).values());

    if (uniqueOpFields.length > 0) {
      const { error: opFieldError } = await newDb
        .from('operation_fields')
        .insert(uniqueOpFields);

      if (opFieldError && !opFieldError.message.includes('duplicate')) {
        console.log(`  ⚠️ Error inserting operation_fields: ${opFieldError.message}`);
      } else {
        console.log(`  ✓ Inserted ${uniqueOpFields.length} operation-field relationships`);
      }
    }

    // Insert complications
    console.log('• Inserting complications...');
    const compInserts = (oldComps || [])
      .filter(comp => opMap.has(Array.from(uniqueOperations.values()).find(op => oldOps?.some(oOp => oOp.id === comp.operation_id))?.name || ''))
      .map(comp => {
        const opName = Array.from(uniqueOperations.values()).find(op => oldOps?.some(oOp => oOp.id === comp.operation_id))?.name;
        return {
          operation_id: opMap.get(opName!)!,
          name: comp.name,
          description: comp.description,
          severity: comp.severity,
          is_ai_generated: comp.is_ai_generated,
          approved: comp.approved,
          is_systemic: comp.is_systemic
        };
      });

    if (compInserts.length > 0) {
      const { error: compError } = await newDb
        .from('master_complications')
        .insert(compInserts);

      if (compError) {
        console.log(`  ⚠️ Error inserting complications: ${compError.message}`);
      } else {
        console.log(`  ✓ Inserted ${compInserts.length} complications`);
      }
    }

    // Summary
    console.log('\n✅ Import complete!\n');
    console.log('Summary:');
    console.log(`  • Specialties: ${specMap.size}`);
    console.log(`  • Fields: ${fieldMap.size}`);
    console.log(`  • Operations: ${opMap.size}`);
    console.log(`  • Operation-Specialty relationships: ${uniqueOpSpecs.length}`);
    console.log(`  • Operation-Field relationships: ${uniqueOpFields.length}`);
    console.log(`  • Complications: ${compInserts.length}`);

  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }
}

importMasterData();

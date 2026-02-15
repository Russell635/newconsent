/**
 * Seed master operations and fields with realistic surgical data
 *
 * Usage: npx tsx scripts/seed-master-data.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SPECIALTIES = [
  { name: 'General Surgery', description: 'Common surgical procedures' },
  { name: 'Orthopedic Surgery', description: 'Bones, joints, and musculoskeletal system' },
  { name: 'Cardiac Surgery', description: 'Heart and cardiovascular procedures' },
];

const FIELDS = [
  { name: 'Abdomen', description: 'Abdominal region' },
  { name: 'Chest', description: 'Thoracic/chest region' },
  { name: 'Knee', description: 'Knee joint' },
  { name: 'Hip', description: 'Hip joint' },
  { name: 'Shoulder', description: 'Shoulder joint' },
  { name: 'Heart', description: 'Cardiac procedures' },
];

const OPERATIONS = [
  // General Surgery
  {
    name: 'Appendectomy',
    description: 'Surgical removal of the appendix',
    body_region: 'Abdomen',
    specialties: ['General Surgery'],
    fields: ['Abdomen'],
  },
  {
    name: 'Cholecystectomy',
    description: 'Surgical removal of the gallbladder',
    body_region: 'Abdomen',
    specialties: ['General Surgery'],
    fields: ['Abdomen'],
  },
  {
    name: 'Hernia Repair',
    description: 'Repair of abdominal or inguinal hernia',
    body_region: 'Abdomen',
    specialties: ['General Surgery'],
    fields: ['Abdomen'],
  },
  {
    name: 'Mastectomy',
    description: 'Surgical removal of breast tissue',
    body_region: 'Chest',
    specialties: ['General Surgery'],
    fields: ['Chest'],
  },

  // Orthopedic Surgery
  {
    name: 'Total Knee Replacement',
    description: 'Replacement of damaged knee joint with prosthetic',
    body_region: 'Knee',
    specialties: ['Orthopedic Surgery'],
    fields: ['Knee'],
  },
  {
    name: 'Knee Arthroscopy',
    description: 'Minimally invasive inspection and repair of knee joint',
    body_region: 'Knee',
    specialties: ['Orthopedic Surgery'],
    fields: ['Knee'],
  },
  {
    name: 'ACL Reconstruction',
    description: 'Surgical repair of anterior cruciate ligament',
    body_region: 'Knee',
    specialties: ['Orthopedic Surgery'],
    fields: ['Knee'],
  },
  {
    name: 'Total Hip Replacement',
    description: 'Replacement of damaged hip joint with prosthetic',
    body_region: 'Hip',
    specialties: ['Orthopedic Surgery'],
    fields: ['Hip'],
  },
  {
    name: 'Hip Arthroscopy',
    description: 'Minimally invasive inspection and repair of hip joint',
    body_region: 'Hip',
    specialties: ['Orthopedic Surgery'],
    fields: ['Hip'],
  },
  {
    name: 'Rotator Cuff Repair',
    description: 'Surgical repair of shoulder rotator cuff muscles',
    body_region: 'Shoulder',
    specialties: ['Orthopedic Surgery'],
    fields: ['Shoulder'],
  },
  {
    name: 'Shoulder Arthroscopy',
    description: 'Minimally invasive inspection and repair of shoulder joint',
    body_region: 'Shoulder',
    specialties: ['Orthopedic Surgery'],
    fields: ['Shoulder'],
  },

  // Cardiac Surgery
  {
    name: 'Coronary Artery Bypass Graft',
    description: 'Bypass surgery for blocked coronary arteries',
    body_region: 'Heart',
    specialties: ['Cardiac Surgery'],
    fields: ['Heart'],
  },
  {
    name: 'Aortic Valve Replacement',
    description: 'Replacement of damaged aortic valve',
    body_region: 'Heart',
    specialties: ['Cardiac Surgery'],
    fields: ['Heart'],
  },
  {
    name: 'Mitral Valve Repair',
    description: 'Repair of mitral valve',
    body_region: 'Heart',
    specialties: ['Cardiac Surgery'],
    fields: ['Heart'],
  },
];

const COMPLICATIONS = {
  'Appendectomy': [
    { name: 'Infection', severity: 'medium' },
    { name: 'Bleeding', severity: 'high' },
    { name: 'Bowel perforation', severity: 'critical' },
    { name: 'Anesthesia complications', severity: 'medium' },
  ],
  'Total Knee Replacement': [
    { name: 'Infection', severity: 'medium' },
    { name: 'Blood clots (DVT)', severity: 'high' },
    { name: 'Stiffness', severity: 'medium' },
    { name: 'Implant failure', severity: 'high' },
    { name: 'Nerve damage', severity: 'medium' },
  ],
  'Coronary Artery Bypass Graft': [
    { name: 'Heart attack', severity: 'critical' },
    { name: 'Stroke', severity: 'critical' },
    { name: 'Infection', severity: 'medium' },
    { name: 'Bleeding', severity: 'high' },
    { name: 'Arrhythmia', severity: 'high' },
  ],
  'ACL Reconstruction': [
    { name: 'Infection', severity: 'medium' },
    { name: 'Stiffness', severity: 'medium' },
    { name: 'Graft failure', severity: 'high' },
    { name: 'Nerve damage', severity: 'low' },
  ],
};

async function seed() {
  try {
    console.log('🌱 Starting seed...\n');

    // Clear existing data (delete in dependency order to respect FKs)
    console.log('🗑️  Clearing existing data...');
    const deleteOperations = [
      'master_complications',
      'operation_fields',
      'operation_specialties',
      'master_operations',
      'master_fields',
      'master_specialties',
    ];

    for (const table of deleteOperations) {
      const { error } = await supabase
        .from(table)
        .delete()
        .gt('id', '00000000-0000-0000-0000-000000000000');
      if (error) {
        console.error(`❌ Failed to clear ${table}:`, error);
        throw error;
      }
    }

    // Insert specialties
    console.log('📋 Inserting specialties...');
    const { data: specs, error: specError } = await supabase
      .from('master_specialties')
      .insert(SPECIALTIES)
      .select('id, name');

    if (specError) throw specError;
    const specMap = new Map(specs!.map(s => [s.name, s.id]));
    console.log(`   ✓ Inserted ${specs!.length} specialties`);

    // Insert fields
    console.log('📍 Inserting fields...');
    const { data: fields, error: fieldError } = await supabase
      .from('master_fields')
      .insert(FIELDS)
      .select('id, name');

    if (fieldError) throw fieldError;
    const fieldMap = new Map(fields!.map(f => [f.name, f.id]));
    console.log(`   ✓ Inserted ${fields!.length} fields`);

    // Insert operations
    console.log('🏥 Inserting operations...');
    const opsToInsert = OPERATIONS.map(op => ({
      name: op.name,
      description: op.description,
      body_region: op.body_region,
      is_ai_generated: false,
      approved: true,
      has_been_used: false,
    }));

    const { data: ops, error: opsError } = await supabase
      .from('master_operations')
      .insert(opsToInsert)
      .select('id, name');

    if (opsError) throw opsError;
    const opMap = new Map(ops!.map(o => [o.name, o.id]));
    console.log(`   ✓ Inserted ${ops!.length} operations`);

    // Insert operation_specialties relationships
    console.log('🔗 Linking operations to specialties...');
    const opSpecRelations = OPERATIONS.flatMap(op =>
      op.specialties.map(spec => ({
        operation_id: opMap.get(op.name)!,
        specialty_id: specMap.get(spec)!,
      }))
    );

    const { error: opSpecError } = await supabase
      .from('operation_specialties')
      .insert(opSpecRelations);

    if (opSpecError) throw opSpecError;
    console.log(`   ✓ Created ${opSpecRelations.length} operation-specialty links`);

    // Insert operation_fields relationships
    console.log('🔗 Linking operations to fields...');
    const opFieldRelations = OPERATIONS.flatMap(op =>
      op.fields.map(field => ({
        operation_id: opMap.get(op.name)!,
        field_id: fieldMap.get(field)!,
      }))
    );

    const { error: opFieldError } = await supabase
      .from('operation_fields')
      .insert(opFieldRelations);

    if (opFieldError) throw opFieldError;
    console.log(`   ✓ Created ${opFieldRelations.length} operation-field links`);

    // Insert complications
    console.log('⚠️  Inserting complications...');
    let compCount = 0;
    for (const [opName, comps] of Object.entries(COMPLICATIONS)) {
      const opId = opMap.get(opName);
      if (!opId) continue;

      const compsToInsert = comps.map(c => ({
        operation_id: opId,
        name: c.name,
        description: '',
        severity: c.severity,
        is_ai_generated: false,
        approved: true,
        is_systemic: false,
      }));

      const { error: compError } = await supabase
        .from('master_complications')
        .insert(compsToInsert);

      if (compError) throw compError;
      compCount += compsToInsert.length;
    }
    console.log(`   ✓ Inserted ${compCount} complications`);

    console.log('\n✅ Seed complete!\n');
    console.log('Summary:');
    console.log(`  • ${SPECIALTIES.length} specialties`);
    console.log(`  • ${FIELDS.length} fields`);
    console.log(`  • ${OPERATIONS.length} operations`);
    console.log(`  • ${opSpecRelations.length} operation-specialty links`);
    console.log(`  • ${opFieldRelations.length} operation-field links`);
    console.log(`  • ${compCount} complications`);

  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seed();

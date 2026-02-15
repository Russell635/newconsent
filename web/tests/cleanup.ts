import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });

import { cleanupTestData } from './lib/db-helpers';

async function cleanup() {
  console.log('Cleaning up test data...\n');
  await cleanupTestData();
  console.log('Done. Notifications and staff_assignments for test accounts have been removed.');
  console.log('Auth users and user_profiles are preserved for next test run.');
}

cleanup().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});

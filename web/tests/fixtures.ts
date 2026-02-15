import { test as base } from '@playwright/test';
import { adminClient } from './lib/supabase-admin';
import { TEST_ACCOUNTS, type TestAccount } from './lib/test-accounts';
import { cleanupTestData } from './lib/db-helpers';
import type { SupabaseClient } from '@supabase/supabase-js';

type TestFixtures = {
  adminClient: SupabaseClient;
  testAccounts: Record<string, TestAccount>;
};

export const test = base.extend<TestFixtures>({
  adminClient: async ({}, use) => {
    await use(adminClient);
  },
  testAccounts: async ({}, use) => {
    await use(TEST_ACCOUNTS);
  },
});

export { expect } from '@playwright/test';

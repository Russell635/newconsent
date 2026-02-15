import type { UserRole, StaffRole } from '../../src/types/database';

export interface TestAccount {
  email: string;
  password: string;
  role: UserRole;
  fullName: string;
  description: string;
  staffRole?: StaffRole;
}

const TEST_PASSWORD = process.env.TEST_PASSWORD || 'TestPass123!';

export const TEST_ACCOUNTS: Record<string, TestAccount> = {
  admin: {
    email: 'test+admin@consentmaker.test',
    password: TEST_PASSWORD,
    role: 'admin',
    fullName: 'Test Admin',
    description: 'Platform administrator',
  },
  surgeon1: {
    email: 'test+surgeon1@consentmaker.test',
    password: TEST_PASSWORD,
    role: 'surgeon',
    fullName: 'Dr Test Surgeon',
    description: 'Primary surgeon',
  },
  surgeon2: {
    email: 'test+surgeon2@consentmaker.test',
    password: TEST_PASSWORD,
    role: 'surgeon',
    fullName: 'Dr Second Surgeon',
    description: 'Second surgeon',
  },
  managerFull: {
    email: 'test+manager-full@consentmaker.test',
    password: TEST_PASSWORD,
    role: 'manager',
    fullName: 'Test Manager Full',
    description: 'Manager with all permissions',
    staffRole: 'manager',
  },
  managerLimited: {
    email: 'test+manager-limited@consentmaker.test',
    password: TEST_PASSWORD,
    role: 'manager',
    fullName: 'Test Manager Limited',
    description: 'Manager with restricted permissions',
    staffRole: 'manager',
  },
  nurseFull: {
    email: 'test+nurse-full@consentmaker.test',
    password: TEST_PASSWORD,
    role: 'nurse',
    fullName: 'Test Nurse Full',
    description: 'Nurse with all 4 permissions',
    staffRole: 'nurse',
  },
  nurseLimited: {
    email: 'test+nurse-limited@consentmaker.test',
    password: TEST_PASSWORD,
    role: 'nurse',
    fullName: 'Test Nurse Limited',
    description: 'Nurse with 1-2 permissions',
    staffRole: 'nurse',
  },
  nurseUnassigned: {
    email: 'test+nurse-unassigned@consentmaker.test',
    password: TEST_PASSWORD,
    role: 'nurse',
    fullName: 'Test Nurse Unassigned',
    description: 'Nurse with no surgeon assignments',
    staffRole: 'nurse',
  },
};

export function getAccount(key: keyof typeof TEST_ACCOUNTS): TestAccount {
  return TEST_ACCOUNTS[key];
}

export function getAllAccounts(): TestAccount[] {
  return Object.values(TEST_ACCOUNTS);
}

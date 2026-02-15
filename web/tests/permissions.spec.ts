import { test, expect } from './fixtures';
import { loginAs, logout } from './lib/auth-helpers';
import { getAccount } from './lib/test-accounts';
import {
  getUserProfileByEmail,
  getSurgeonProfileByUserId,
  cleanupTestData,
} from './lib/db-helpers';
import { adminClient } from './lib/supabase-admin';

test.describe('Permission Enforcement in UI', () => {
  test.beforeAll(async () => {
    await cleanupTestData();

    // Set up: assign nurseLimited to surgeon1 with only answer_questions permission
    const surgeon = getAccount('surgeon1');
    const nurseLimited = getAccount('nurseLimited');

    const surgeonProfile = await getUserProfileByEmail(surgeon.email);
    const surgeonDbProfile = await getSurgeonProfileByUserId(surgeonProfile!.user_id);
    const nurseProfile = await getUserProfileByEmail(nurseLimited.email);

    await adminClient.from('staff_assignments').insert({
      staff_user_id: nurseProfile!.user_id,
      surgeon_id: surgeonDbProfile!.id,
      staff_role: 'nurse',
      permissions: ['answer_questions'],
      invited_by: surgeonProfile!.user_id,
      invitation_status: 'accepted',
      invited_at: new Date().toISOString(),
      accepted_at: new Date().toISOString(),
      is_active: true,
    });

    // Set up: assign managerFull to surgeon1 with all permissions
    const managerFull = getAccount('managerFull');
    const managerProfile = await getUserProfileByEmail(managerFull.email);

    await adminClient.from('staff_assignments').insert({
      staff_user_id: managerProfile!.user_id,
      surgeon_id: surgeonDbProfile!.id,
      staff_role: 'manager',
      permissions: [
        'manage_staff', 'manage_patients', 'manage_locations',
        'view_consents', 'prepare_documents', 'answer_questions', 'validate_consent',
      ],
      invited_by: surgeonProfile!.user_id,
      invitation_status: 'accepted',
      invited_at: new Date().toISOString(),
      accepted_at: new Date().toISOString(),
      is_active: true,
    });

    // Set up: assign managerLimited to surgeon1 with only view_consents
    const managerLimited = getAccount('managerLimited');
    const managerLimitedProfile = await getUserProfileByEmail(managerLimited.email);

    await adminClient.from('staff_assignments').insert({
      staff_user_id: managerLimitedProfile!.user_id,
      surgeon_id: surgeonDbProfile!.id,
      staff_role: 'manager',
      permissions: ['view_consents'],
      invited_by: surgeonProfile!.user_id,
      invitation_status: 'accepted',
      invited_at: new Date().toISOString(),
      accepted_at: new Date().toISOString(),
      is_active: true,
    });
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('Nurse with limited permissions sees restricted sidebar', async ({ page }) => {
    const nurse = getAccount('nurseLimited');
    await loginAs(page, nurse);

    // Explicitly navigate to staff dashboard (don't rely on auto-redirect)
    await page.goto('/staff');
    await page.waitForLoadState('networkidle');

    const sidebar = page.locator('aside');

    // Should see Dashboard, Invitations, Messages (base items)
    await expect(sidebar.getByText('Dashboard')).toBeVisible({ timeout: 10_000 });
    await expect(sidebar.getByText('Messages')).toBeVisible();

    // Should NOT see Patients (requires manage_patients for managers only)
    await expect(sidebar.getByText('Patients')).toBeHidden();

    // Should NOT see Staff Management (requires manage_staff for managers only)
    await expect(sidebar.getByText('Staff Management')).toBeHidden();

    await logout(page);
  });

  test('Manager with full permissions sees all sidebar items', async ({ page }) => {
    const manager = getAccount('managerFull');
    await loginAs(page, manager);

    await page.goto('/staff');
    await page.waitForLoadState('networkidle');

    const sidebar = page.locator('aside');

    await expect(sidebar.getByText('Dashboard')).toBeVisible({ timeout: 10_000 });
    await expect(sidebar.getByText('Messages')).toBeVisible();
    await expect(sidebar.getByText('Patients')).toBeVisible();
    await expect(sidebar.getByText('Consents')).toBeVisible();
    await expect(sidebar.getByText('Staff Management')).toBeVisible();

    await logout(page);
  });

  test('Manager with limited permissions has restricted sidebar', async ({ page }) => {
    const manager = getAccount('managerLimited');
    await loginAs(page, manager);

    await page.goto('/staff');
    await page.waitForLoadState('networkidle');

    const sidebar = page.locator('aside');

    await expect(sidebar.getByText('Dashboard')).toBeVisible({ timeout: 10_000 });
    await expect(sidebar.getByText('Messages')).toBeVisible();

    // Has view_consents so should see Consents
    await expect(sidebar.getByText('Consents')).toBeVisible();

    // Does NOT have manage_patients or manage_staff
    await expect(sidebar.getByText('Patients')).toBeHidden();
    await expect(sidebar.getByText('Staff Management')).toBeHidden();

    await logout(page);
  });
});

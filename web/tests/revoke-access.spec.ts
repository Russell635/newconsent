import { test, expect } from './fixtures';
import { loginAs, logout } from './lib/auth-helpers';
import { getAccount } from './lib/test-accounts';
import {
  getStaffAssignment,
  getNotifications,
  getUserProfileByEmail,
  getSurgeonProfileByUserId,
  cleanupTestData,
} from './lib/db-helpers';
import { adminClient } from './lib/supabase-admin';

test.describe('Revoke Staff Access', () => {
  let surgeonUserId: string;
  let surgeonDbId: string;
  let managerUserId: string;

  test.beforeAll(async () => {
    await cleanupTestData();

    const surgeon = getAccount('surgeon1');
    const manager = getAccount('managerFull');

    const surgeonProfile = await getUserProfileByEmail(surgeon.email);
    const surgeonDbProfile = await getSurgeonProfileByUserId(surgeonProfile!.user_id);
    const managerProfile = await getUserProfileByEmail(manager.email);

    surgeonUserId = surgeonProfile!.user_id;
    surgeonDbId = surgeonDbProfile!.id;
    managerUserId = managerProfile!.user_id;

    // Create an accepted assignment for manager with surgeon
    await adminClient.from('staff_assignments').insert({
      staff_user_id: managerUserId,
      surgeon_id: surgeonDbId,
      staff_role: 'manager',
      permissions: ['manage_staff', 'manage_patients', 'view_consents'],
      invited_by: surgeonUserId,
      invitation_status: 'accepted',
      invited_at: new Date().toISOString(),
      accepted_at: new Date().toISOString(),
      is_active: true,
    });
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('Surgeon revokes manager access → verify immediate effect', async ({ page }) => {
    const surgeon = getAccount('surgeon1');
    const manager = getAccount('managerFull');

    // --- Login as surgeon ---
    await loginAs(page, surgeon);
    await page.goto('/surgeon/staff');
    await page.waitForLoadState('networkidle');

    // Verify manager appears in Active Staff
    await expect(page.getByText(manager.fullName)).toBeVisible({ timeout: 10_000 });

    // --- Click Revoke ---
    // Handle the confirm dialog
    page.on('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Revoke' }).click();

    // Wait for the manager to disappear from Active Staff
    await expect(page.getByText(manager.fullName)).toBeHidden({ timeout: 10_000 });

    // --- DB assert: is_active = false ---
    const assignment = await getStaffAssignment(managerUserId, surgeonDbId);
    expect(assignment).toBeTruthy();
    expect(assignment!.is_active).toBe(false);

    // --- DB assert: access_revoked notification sent ---
    const notifications = await getNotifications(managerUserId, 'access_revoked');
    expect(notifications.length).toBeGreaterThanOrEqual(1);

    // --- Login as manager, verify surgeon no longer in selector ---
    await logout(page);
    await loginAs(page, manager);
    await page.waitForLoadState('networkidle');

    // The SurgeonSelector should not show the revoked surgeon
    const surgeonSelect = page.locator('header select');
    if (await surgeonSelect.isVisible()) {
      const options = await surgeonSelect.locator('option').allTextContents();
      const hasSurgeon = options.some((opt) =>
        opt.includes(surgeon.fullName.replace('Dr ', ''))
      );
      expect(hasSurgeon).toBe(false);
    }
    // If selector is not visible at all, that also means no accepted assignments
  });
});

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

test.describe('Staff Invitation — Decline Flow', () => {
  test.beforeAll(async () => {
    await cleanupTestData();
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('Surgeon invites nurse → nurse declines → verify state', async ({ page }) => {
    const surgeon = getAccount('surgeon1');
    const nurse = getAccount('nurseFull');

    const surgeonProfile = await getUserProfileByEmail(surgeon.email);
    expect(surgeonProfile).toBeTruthy();
    const surgeonDbProfile = await getSurgeonProfileByUserId(surgeonProfile!.user_id);
    expect(surgeonDbProfile).toBeTruthy();

    const nurseProfile = await getUserProfileByEmail(nurse.email);
    expect(nurseProfile).toBeTruthy();

    // --- Login as surgeon and invite nurse ---
    await loginAs(page, surgeon);
    await page.goto('/surgeon/staff');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Invite Staff' }).click();
    await expect(page.getByText('Invite Staff Member')).toBeVisible();

    await page.getByLabel('Email Address').fill(nurse.email);

    // Nurse role should be selected by default, but click to be sure
    await page.getByRole('button', { name: 'Nurse' }).click();

    // Check all nurse permissions
    await page.getByLabel('Handle Consent Sections').check();
    await page.getByLabel('Prepare Documents').check();
    await page.getByLabel('Validate Consent').check();
    await page.getByLabel('Answer Questions').check();

    await page.getByRole('button', { name: 'Send Invitation' }).click();
    await expect(page.getByText('Invite Staff Member')).toBeHidden({ timeout: 10_000 });

    // --- DB assert: pending assignment exists ---
    const assignment = await getStaffAssignment(nurseProfile!.user_id, surgeonDbProfile!.id);
    expect(assignment).toBeTruthy();
    expect(assignment!.invitation_status).toBe('pending');

    // --- Logout surgeon, login as nurse ---
    await logout(page);
    await loginAs(page, nurse);

    await page.goto('/staff/messages');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Staff Invitation')).toBeVisible({ timeout: 10_000 });

    // --- Click Decline ---
    await page.getByRole('button', { name: 'Decline' }).click();
    await expect(page.getByText('Actioned')).toBeVisible({ timeout: 10_000 });

    // --- DB assert: assignment declined ---
    const updated = await getStaffAssignment(nurseProfile!.user_id, surgeonDbProfile!.id);
    expect(updated).toBeTruthy();
    expect(updated!.invitation_status).toBe('declined');
    expect(updated!.is_active).toBe(false);

    // --- DB assert: decline notification sent to surgeon ---
    const declineNotifs = await getNotifications(surgeonProfile!.user_id, 'invitation_declined');
    expect(declineNotifs.length).toBeGreaterThanOrEqual(1);

    // --- Verify surgeon sees declined notification ---
    await logout(page);
    await loginAs(page, surgeon);
    await page.goto('/surgeon/messages');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Invitation Declined')).toBeVisible({ timeout: 10_000 });
  });
});

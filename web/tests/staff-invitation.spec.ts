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

test.describe('Staff Invitation — Accept Flow', () => {
  test.beforeAll(async () => {
    await cleanupTestData();
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('Surgeon invites manager → manager accepts → verify state', async ({ page }) => {
    const surgeon = getAccount('surgeon1');
    const manager = getAccount('managerFull');

    // Get DB IDs we'll need for assertions
    const surgeonProfile = await getUserProfileByEmail(surgeon.email);
    expect(surgeonProfile).toBeTruthy();
    const surgeonDbProfile = await getSurgeonProfileByUserId(surgeonProfile!.user_id);
    expect(surgeonDbProfile).toBeTruthy();

    const managerProfile = await getUserProfileByEmail(manager.email);
    expect(managerProfile).toBeTruthy();

    // --- Step 1: Login as surgeon ---
    await loginAs(page, surgeon);

    // --- Step 2: Navigate to Staff page ---
    await page.goto('/surgeon/staff');
    await page.waitForLoadState('networkidle');

    // --- Step 3: Click "Invite Staff" ---
    await page.getByRole('button', { name: 'Invite Staff' }).click();

    // --- Step 4: Fill invitation form ---
    // Modal should be open with title "Invite Staff Member"
    await expect(page.getByText('Invite Staff Member')).toBeVisible();

    // Enter manager email
    await page.getByLabel('Email Address').fill(manager.email);

    // Select Manager role
    await page.getByRole('button', { name: 'Manager' }).click();

    // Check all manager permissions
    await page.getByLabel('Manage Staff').check();
    await page.getByLabel('Manage Patients').check();
    await page.getByLabel('Manage Locations').check();
    await page.getByLabel('View Consents').check();
    await page.getByLabel('Prepare Documents').check();
    await page.getByLabel('Answer Questions').check();
    await page.getByLabel('Validate Consent').check();

    // --- Step 5: Submit ---
    await page.getByRole('button', { name: 'Send Invitation' }).click();

    // Wait for modal to close
    await expect(page.getByText('Invite Staff Member')).toBeHidden({ timeout: 10_000 });

    // Verify pending invitation appears on page
    await expect(page.getByText('Pending Invitations')).toBeVisible({ timeout: 5_000 });

    // --- Step 6: DB assert — staff_assignments ---
    const assignment = await getStaffAssignment(managerProfile!.user_id, surgeonDbProfile!.id);
    expect(assignment).toBeTruthy();
    expect(assignment!.invitation_status).toBe('pending');
    expect(assignment!.staff_role).toBe('manager');
    expect(assignment!.permissions).toContain('manage_staff');
    expect(assignment!.permissions).toContain('manage_patients');
    expect(assignment!.is_active).toBe(true);

    // --- Step 7: DB assert — notification sent ---
    const notifications = await getNotifications(managerProfile!.user_id, 'staff_invitation');
    expect(notifications.length).toBeGreaterThanOrEqual(1);
    expect(notifications[0].sender_id).toBe(surgeonProfile!.user_id);

    // --- Step 8: Logout surgeon, login as manager ---
    await logout(page);
    await loginAs(page, manager);

    // --- Step 9: Navigate to messages ---
    await page.goto('/staff/messages');
    await page.waitForLoadState('networkidle');

    // --- Step 10: Verify invitation message with Accept/Decline buttons ---
    await expect(page.getByText('Staff Invitation')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Accept' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Decline' })).toBeVisible();

    // --- Step 11: Click Accept ---
    await page.getByRole('button', { name: 'Accept' }).click();

    // Wait for the action to complete (button should disappear or show "Actioned")
    await expect(page.getByText('Actioned')).toBeVisible({ timeout: 10_000 });

    // --- Step 12: DB assert — assignment accepted ---
    const updatedAssignment = await getStaffAssignment(managerProfile!.user_id, surgeonDbProfile!.id);
    expect(updatedAssignment).toBeTruthy();
    expect(updatedAssignment!.invitation_status).toBe('accepted');
    expect(updatedAssignment!.accepted_at).toBeTruthy();

    // --- Step 13: DB assert — acceptance notification sent to surgeon ---
    const acceptNotifs = await getNotifications(surgeonProfile!.user_id, 'invitation_accepted');
    expect(acceptNotifs.length).toBeGreaterThanOrEqual(1);

    // --- Step 14: Verify surgeon selector appears (assignment accepted) ---
    // Reload to ensure assignments are fresh
    await page.goto('/staff');
    await page.waitForLoadState('networkidle');

    // The SurgeonSelector is a <select> in the header for staff users
    // It only appears when there are accepted assignments
    const surgeonSelect = page.locator('header select');
    await expect(surgeonSelect).toBeVisible({ timeout: 10_000 });

    // --- Step 15: Logout manager, login as surgeon ---
    await logout(page);
    await loginAs(page, surgeon);

    // --- Step 16: Verify manager appears in Active Staff ---
    // Wait for the surgeon dashboard to fully render before navigating
    await page.waitForTimeout(1000);
    await page.goto('/surgeon/staff');
    await page.waitForLoadState('networkidle');
    // Wait for the Staff page to render
    await expect(page.getByText('Staff Management')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(manager.fullName)).toBeVisible({ timeout: 10_000 });

    // --- Step 17: Verify "Invitation Accepted" message ---
    await page.goto('/surgeon/messages');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Invitation Accepted')).toBeVisible({ timeout: 10_000 });
  });
});

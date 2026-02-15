import { test, expect } from './fixtures';
import { loginAs, logout } from './lib/auth-helpers';
import { getAccount } from './lib/test-accounts';
import {
  getUserProfileByEmail,
  cleanupTestData,
} from './lib/db-helpers';
import { adminClient } from './lib/supabase-admin';

/** Wait for the messages list to finish loading */
async function waitForMessagesLoaded(page: import('@playwright/test').Page) {
  await expect(page.getByText('Loading...')).toBeHidden({ timeout: 10_000 });
}

test.describe('Messages Page', () => {
  let surgeonUserId: string;
  let managerUserId: string;

  test.beforeAll(async () => {
    await cleanupTestData();

    const surgeon = getAccount('surgeon1');
    const manager = getAccount('managerFull');

    const surgeonProfile = await getUserProfileByEmail(surgeon.email);
    const managerProfile = await getUserProfileByEmail(manager.email);

    surgeonUserId = surgeonProfile!.user_id;
    managerUserId = managerProfile!.user_id;

    // Seed some test notifications
    // Received by manager (from surgeon)
    await adminClient.from('notifications').insert([
      {
        user_id: managerUserId,
        sender_id: surgeonUserId,
        type: 'staff_invitation',
        title: 'Test Invitation 1',
        message: 'You have been invited as a manager.',
        read: false,
        action_type: null,
        action_data: null,
        action_taken: false,
      },
      {
        user_id: managerUserId,
        sender_id: surgeonUserId,
        type: 'permission_change',
        title: 'Permissions Updated',
        message: 'Your permissions have been updated.',
        read: false,
        action_type: null,
        action_data: null,
        action_taken: false,
      },
    ]);

    // Sent by manager (to surgeon)
    await adminClient.from('notifications').insert({
      user_id: surgeonUserId,
      sender_id: managerUserId,
      type: 'invitation_accepted',
      title: 'Invitation Accepted',
      message: 'Manager has accepted your invitation.',
      read: false,
      action_type: null,
      action_data: null,
      action_taken: false,
    });
  });

  test.afterAll(async () => {
    await cleanupTestData();
  });

  test('Filter tabs show correct messages', async ({ page }) => {
    const manager = getAccount('managerFull');
    await loginAs(page, manager);

    await page.goto('/staff/messages');
    await waitForMessagesLoaded(page);

    // "All" tab should be active by default — should see both received and sent
    await expect(page.getByText('Test Invitation 1')).toBeVisible({ timeout: 10_000 });

    // Click "Received" tab
    await page.getByRole('button', { name: 'Received' }).click();
    await waitForMessagesLoaded(page);

    // Should see received messages
    await expect(page.getByText('Test Invitation 1')).toBeVisible();
    await expect(page.getByText('Permissions Updated')).toBeVisible();

    // Click "Sent" tab
    await page.getByRole('button', { name: 'Sent' }).click();
    await waitForMessagesLoaded(page);

    // Should see sent message
    await expect(page.getByText('Invitation Accepted')).toBeVisible({ timeout: 5_000 });
  });

  test('Mark message as read', async ({ page }) => {
    const manager = getAccount('managerFull');
    await loginAs(page, manager);

    await page.goto('/staff/messages');
    await waitForMessagesLoaded(page);

    // Click "Received" tab to only see received messages
    await page.getByRole('button', { name: 'Received' }).click();
    await waitForMessagesLoaded(page);

    // Wait for messages to render
    await expect(page.getByText('Test Invitation 1')).toBeVisible({ timeout: 5_000 });

    // Check unread count shown in header
    await expect(page.getByText('unread')).toBeVisible();

    // Select first message checkbox (nth(0) is "Select all", nth(1) is first message)
    const checkboxes = page.locator('input[type="checkbox"]');
    await checkboxes.nth(1).check();

    // Click "Mark Read"
    await page.getByRole('button', { name: 'Mark Read' }).click();

    // Wait for UI update
    await page.waitForTimeout(1000);
  });

  test('Delete messages', async ({ page }) => {
    const manager = getAccount('managerFull');
    await loginAs(page, manager);

    await page.goto('/staff/messages');
    await waitForMessagesLoaded(page);

    // Click "Received" tab
    await page.getByRole('button', { name: 'Received' }).click();
    await waitForMessagesLoaded(page);

    // Wait for at least one message to render
    await expect(page.getByText('Permissions Updated')).toBeVisible({ timeout: 5_000 });

    // Handle confirm dialog BEFORE clicking Delete (must be set up first)
    page.on('dialog', (dialog) => dialog.accept());

    // Select the "Permissions Updated" message checkbox
    // Find the row containing "Permissions Updated" and check its checkbox
    const row = page.locator('.divide-y > div').filter({ hasText: 'Permissions Updated' });
    await row.locator('input[type="checkbox"]').check();

    // Click Delete
    await page.getByRole('button', { name: 'Delete' }).click();

    // Verify the message is gone
    await expect(page.getByText('Permissions Updated')).toBeHidden({ timeout: 10_000 });
  });

  test('Clear All removes all received messages', async ({ page }) => {
    const manager = getAccount('managerFull');
    await loginAs(page, manager);

    await page.goto('/staff/messages');
    await waitForMessagesLoaded(page);

    // Handle confirm dialog
    page.on('dialog', (dialog) => dialog.accept());

    // Click "Clear All"
    await page.getByRole('button', { name: 'Clear All' }).click();

    // Wait for the page to reload notifications
    await page.waitForTimeout(1000);
    await waitForMessagesLoaded(page);

    // Switch to "Received" tab — should show no received messages
    await page.getByRole('button', { name: 'Received' }).click();
    await waitForMessagesLoaded(page);

    await expect(page.getByText('No messages')).toBeVisible({ timeout: 10_000 });
  });
});

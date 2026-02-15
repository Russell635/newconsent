import { test, expect } from './fixtures';
import { getUserProfileByEmail } from './lib/db-helpers';
import { adminClient } from './lib/supabase-admin';

test.describe('Registration', () => {
  const testEmail = 'test+reg-temp@consentmaker.test';
  const testPassword = 'TestPass123!';
  const testName = 'Test Registration User';

  test.afterAll(async () => {
    // Clean up: delete the temporary registration user
    const { data: users } = await adminClient.auth.admin.listUsers();
    const tempUser = users?.users?.find((u) => u.email === testEmail);
    if (tempUser) {
      // Delete profile rows first
      await adminClient.from('user_profiles').delete().eq('user_id', tempUser.id);
      await adminClient.auth.admin.deleteUser(tempUser.id);
    }
  });

  test('Registration page shows all 4 role buttons', async ({ page }) => {
    await page.goto('/register');

    // Verify role buttons are visible (use locator to match label text within button)
    const roleGrid = page.locator('.grid');
    await expect(roleGrid.locator('button', { hasText: 'Surgeon' })).toBeVisible();
    await expect(roleGrid.locator('button', { hasText: 'Manager' })).toBeVisible();
    await expect(roleGrid.locator('button', { hasText: 'Nurse' })).toBeVisible();
    await expect(roleGrid.locator('button', { hasText: 'Admin' }).filter({ hasText: 'Platform administrator' })).toBeVisible();

    // Verify form fields
    await expect(page.getByLabel('Full Name')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
  });

  test('Register as manager and verify profile created', async ({ page }) => {
    await page.goto('/register');

    // Fill form
    await page.getByLabel('Full Name').fill(testName);
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);

    // Select Manager role
    await page.getByRole('button', { name: 'Manager' }).click();

    // Submit
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Wait for redirect (successful registration redirects to / which then goes to /staff)
    await page.waitForURL((url) => !url.pathname.includes('/register'), {
      timeout: 15_000,
    });

    // DB assert: user_profiles row created with correct role
    // Wait a moment for the trigger/insert to complete
    await page.waitForTimeout(2000);
    const profile = await getUserProfileByEmail(testEmail);
    expect(profile).toBeTruthy();
    expect(profile!.role).toBe('manager');
    expect(profile!.full_name).toBe(testName);
  });
});

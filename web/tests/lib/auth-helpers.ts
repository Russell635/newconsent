import type { Page } from '@playwright/test';
import { adminClient } from './supabase-admin';
import type { TestAccount } from './test-accounts';

/**
 * Log in via the UI as the given test persona.
 * Clears any existing Supabase session first, then fills the login form.
 */
export async function loginAs(page: Page, account: TestAccount) {
  // Clear cookies
  await page.context().clearCookies();

  // Navigate to login page first, so we're on the right origin
  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');

  // Now clear localStorage/sessionStorage on the correct origin
  // This removes any lingering Supabase auth session
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // Reload to ensure the app sees no session (AuthProvider reads on mount)
  await page.reload();
  await page.waitForLoadState('networkidle');

  // If the app redirected away from /login (shouldn't happen after clearing), go back
  if (!page.url().includes('/login')) {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
  }

  // Verify we're on the login page
  await page.getByRole('button', { name: 'Sign In' }).waitFor({ timeout: 15_000 });

  // Fill email
  const emailInput = page.getByLabel('Email');
  await emailInput.click({ clickCount: 3 });
  await emailInput.fill(account.email);

  // Fill password
  const passwordInput = page.getByLabel('Password');
  await passwordInput.click({ clickCount: 3 });
  await passwordInput.fill(account.password);

  // Small delay for Chrome autofill to settle
  await page.waitForTimeout(200);

  await page.getByRole('button', { name: 'Sign In' }).click();

  // Wait for redirect away from /login
  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 15_000,
  });

  // Wait for the app to finish loading profile/assignments
  await page.waitForLoadState('networkidle');
}

/**
 * Log out via the sign-out button in the header.
 */
export async function logout(page: Page) {
  await page.getByTitle('Sign out').click();
  await page.waitForURL('**/login', { timeout: 10_000 });
}

/**
 * Create a user account via the Supabase admin API (bypasses UI registration).
 * Returns the created user's id.
 */
export async function registerAccount(
  account: TestAccount
): Promise<string> {
  const { data, error } = await adminClient.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: { full_name: account.fullName, role: account.role },
  });

  if (error) throw new Error(`Failed to create user ${account.email}: ${error.message}`);
  return data.user.id;
}

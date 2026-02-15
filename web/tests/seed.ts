import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });

import { adminClient } from './lib/supabase-admin';
import { getAllAccounts } from './lib/test-accounts';

async function seed() {
  const accounts = getAllAccounts();
  let created = 0;
  let existing = 0;
  let errors = 0;

  console.log(`Seeding ${accounts.length} test accounts...\n`);

  for (const account of accounts) {
    // Check if user already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const found = existingUsers?.users?.find((u) => u.email === account.email);

    if (found) {
      console.log(`  EXISTS  ${account.email} (${account.role}) — ${account.fullName}`);
      existing++;

      // Reset password to ensure tests can log in
      await adminClient.auth.admin.updateUserById(found.id, {
        password: account.password,
      });
      console.log(`          -> Password reset to test password`);

      // Ensure user_profiles row exists
      const { data: profile } = await adminClient
        .from('user_profiles')
        .select('id')
        .eq('user_id', found.id)
        .single();

      if (!profile) {
        await adminClient.from('user_profiles').insert({
          user_id: found.id,
          role: account.role,
          full_name: account.fullName,
          email: account.email,
          is_active: true,
        });
        console.log(`          -> Created missing user_profiles row`);
      }

      // Ensure surgeon_profiles row for surgeons
      if (account.role === 'surgeon') {
        const { data: surgeonProfile } = await adminClient
          .from('surgeon_profiles')
          .select('id')
          .eq('user_id', found.id)
          .single();

        if (!surgeonProfile) {
          await adminClient.from('surgeon_profiles').insert({
            user_id: found.id,
            full_name: account.fullName,
            email: account.email,
            onboarding_complete: true,
          });
          console.log(`          -> Created missing surgeon_profiles row`);
        }
      }

      continue;
    }

    // Create new user
    const { data, error } = await adminClient.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: { full_name: account.fullName, role: account.role },
    });

    if (error) {
      console.log(`  ERROR   ${account.email}: ${error.message}`);
      errors++;
      continue;
    }

    console.log(`  CREATED ${account.email} (${account.role}) — ${account.fullName}`);
    created++;

    const userId = data.user.id;

    // Create user_profiles row (the app's trigger may handle this, but ensure it exists)
    const { error: profileErr } = await adminClient.from('user_profiles').upsert({
      user_id: userId,
      role: account.role,
      full_name: account.fullName,
      email: account.email,
      is_active: true,
    }, { onConflict: 'user_id' });

    if (profileErr) {
      console.log(`          -> user_profiles error: ${profileErr.message}`);
    }

    // Create surgeon_profiles for surgeon accounts
    if (account.role === 'surgeon') {
      const { error: surgeonErr } = await adminClient.from('surgeon_profiles').upsert({
        user_id: userId,
        full_name: account.fullName,
        email: account.email,
        onboarding_complete: true,
      }, { onConflict: 'user_id' });

      if (surgeonErr) {
        console.log(`          -> surgeon_profiles error: ${surgeonErr.message}`);
      } else {
        console.log(`          -> surgeon_profiles created`);
      }
    }
  }

  console.log(`\nDone: ${created} created, ${existing} existing, ${errors} errors`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

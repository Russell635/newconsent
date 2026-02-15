import { adminClient } from './supabase-admin';
import { getAllAccounts } from './test-accounts';

/**
 * Get a staff assignment row by staff user ID and surgeon profile ID.
 */
export async function getStaffAssignment(staffUserId: string, surgeonId: string) {
  const { data, error } = await adminClient
    .from('staff_assignments')
    .select('*')
    .eq('staff_user_id', staffUserId)
    .eq('surgeon_id', surgeonId)
    .single();

  if (error) return null;
  return data;
}

/**
 * Get notifications for a user, optionally filtered by type.
 */
export async function getNotifications(userId: string, type?: string) {
  let query = adminClient
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (type) query = query.eq('type', type);
  const { data } = await query;
  return data || [];
}

/**
 * Get notifications sent by a user, optionally filtered by type.
 */
export async function getNotificationsBySender(senderId: string, type?: string) {
  let query = adminClient
    .from('notifications')
    .select('*')
    .eq('sender_id', senderId)
    .order('created_at', { ascending: false });

  if (type) query = query.eq('type', type);
  const { data } = await query;
  return data || [];
}

/**
 * Get user_profiles row by email.
 */
export async function getUserProfileByEmail(email: string) {
  const { data } = await adminClient
    .from('user_profiles')
    .select('*')
    .eq('email', email)
    .single();
  return data;
}

/**
 * Get surgeon_profiles row by user_id.
 */
export async function getSurgeonProfileByUserId(userId: string) {
  const { data } = await adminClient
    .from('surgeon_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  return data;
}

/**
 * Poll until a row matching the filters appears (for async operations).
 */
export async function waitForRow(
  table: string,
  filters: Record<string, unknown>,
  timeout = 10_000
): Promise<Record<string, unknown> | null> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    let query = adminClient.from(table).select('*');
    for (const [key, value] of Object.entries(filters)) {
      query = query.eq(key, value);
    }
    const { data } = await query.limit(1).single();
    if (data) return data;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

/**
 * Clean up test data: notifications and staff_assignments for test accounts.
 * Does NOT delete auth users or user_profiles.
 */
export async function cleanupTestData() {
  const accounts = getAllAccounts();
  const emails = accounts.map((a) => a.email);

  // Get user IDs for test accounts
  const { data: profiles } = await adminClient
    .from('user_profiles')
    .select('user_id')
    .in('email', emails);

  if (!profiles || profiles.length === 0) return;

  const userIds = profiles.map((p: { user_id: string }) => p.user_id);

  // Delete notifications where user_id or sender_id is a test account
  for (const uid of userIds) {
    await adminClient.from('notifications').delete().eq('user_id', uid);
    await adminClient.from('notifications').delete().eq('sender_id', uid);
  }

  // Delete staff_assignments where staff_user_id is a test account
  await adminClient
    .from('staff_assignments')
    .delete()
    .in('staff_user_id', userIds);

  // Also delete staff_assignments where surgeon is a test account
  const { data: surgeonProfiles } = await adminClient
    .from('surgeon_profiles')
    .select('id')
    .in('user_id', userIds);

  if (surgeonProfiles && surgeonProfiles.length > 0) {
    const surgeonIds = surgeonProfiles.map((s: { id: string }) => s.id);
    await adminClient
      .from('staff_assignments')
      .delete()
      .in('surgeon_id', surgeonIds);
  }
}

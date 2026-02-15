import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { StaffRole, ManagerPermission, NursePermission } from '../../types/database';

const MANAGER_PERMISSIONS: { key: ManagerPermission; label: string }[] = [
  { key: 'manage_staff', label: 'Manage Staff' },
  { key: 'manage_patients', label: 'Manage Patients' },
  { key: 'manage_locations', label: 'Manage Locations' },
  { key: 'view_consents', label: 'View Consents' },
  { key: 'prepare_documents', label: 'Prepare Documents' },
  { key: 'answer_questions', label: 'Answer Questions' },
  { key: 'validate_consent', label: 'Validate Consent' },
];

const NURSE_PERMISSIONS: { key: NursePermission; label: string }[] = [
  { key: 'handle_consent_sections', label: 'Handle Consent Sections' },
  { key: 'prepare_documents', label: 'Prepare Documents' },
  { key: 'validate_consent', label: 'Validate Consent' },
  { key: 'answer_questions', label: 'Answer Questions' },
];

interface InviteStaffModalProps {
  open: boolean;
  onClose: () => void;
  onInvited: () => void;
}

export function InviteStaffModal({ open, onClose, onInvited }: InviteStaffModalProps) {
  const { surgeonProfile, user } = useAuth();
  const [email, setEmail] = useState('');
  const [staffRole, setStaffRole] = useState<StaffRole>('nurse');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const availablePermissions = staffRole === 'manager' ? MANAGER_PERMISSIONS : NURSE_PERMISSIONS;

  const togglePermission = (key: string) => {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const handleRoleChange = (role: StaffRole) => {
    setStaffRole(role);
    setPermissions([]);
  };

  const handleSubmit = async () => {
    if (!surgeonProfile || !user || !email.trim()) return;
    setError('');
    setSaving(true);

    // Look up the user by email
    const { data: targetProfile } = await supabase
      .from('user_profiles')
      .select('user_id, full_name, email')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (!targetProfile) {
      setError('No registered user found with that email. They must register first.');
      setSaving(false);
      return;
    }

    // Check for existing assignment
    const { data: existing } = await supabase
      .from('staff_assignments')
      .select('id, is_active')
      .eq('staff_user_id', targetProfile.user_id)
      .eq('surgeon_id', surgeonProfile.id)
      .single();

    if (existing?.is_active) {
      setError('This user already has an active assignment with you.');
      setSaving(false);
      return;
    }

    let assignError: string | null = null;

    if (existing) {
      // Reactivate with new invitation
      const { error: updateErr } = await supabase
        .from('staff_assignments')
        .update({
          is_active: true,
          staff_role: staffRole,
          permissions,
          invitation_status: 'pending',
          invited_by: user.id,
          invited_at: new Date().toISOString(),
          accepted_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
      if (updateErr) assignError = updateErr.message;
    } else {
      const { error: insertErr } = await supabase.from('staff_assignments').insert({
        staff_user_id: targetProfile.user_id,
        surgeon_id: surgeonProfile.id,
        staff_role: staffRole,
        permissions,
        invited_by: user.id,
        invitation_status: 'pending',
        invited_at: new Date().toISOString(),
        is_active: true,
      });
      if (insertErr) assignError = insertErr.message;
    }

    if (assignError) {
      setError(`Failed to create invitation: ${assignError}`);
      setSaving(false);
      return;
    }

    // Create notification for the invitee
    const { error: notifErr } = await supabase.from('notifications').insert({
      user_id: targetProfile.user_id,
      sender_id: user.id,
      type: 'staff_invitation',
      title: 'Staff Invitation',
      message: `${surgeonProfile.full_name} has invited you as a ${staffRole} for their practice.`,
      data: { surgeon_id: surgeonProfile.id, surgeon_name: surgeonProfile.full_name },
      read: false,
      action_type: 'accept_invitation',
      action_data: { surgeon_id: surgeonProfile.id, staff_role: staffRole, permissions },
      action_taken: false,
    });

    if (notifErr) {
      console.warn('Notification not sent:', notifErr.message);
    }

    setSaving(false);
    setEmail('');
    setPermissions([]);
    onClose();
    onInvited();
  };

  return (
    <Modal open={open} onClose={onClose} title="Invite Staff Member">
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-danger-50 border border-red-200 rounded-lg text-sm text-danger-700">{error}</div>
        )}

        <Input
          label="Email Address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="staff@example.com"
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleRoleChange('manager')}
              className={`p-3 rounded-lg border text-center transition-colors ${
                staffRole === 'manager'
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="block text-sm font-medium">Manager</span>
              <span className="block text-xs text-gray-400 mt-0.5">Practice admin</span>
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange('nurse')}
              className={`p-3 rounded-lg border text-center transition-colors ${
                staffRole === 'nurse'
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="block text-sm font-medium">Nurse</span>
              <span className="block text-xs text-gray-400 mt-0.5">Clinical assistant</span>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
          <div className="space-y-2">
            {availablePermissions.map((p) => (
              <label key={p.key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={permissions.includes(p.key)}
                  onChange={() => togglePermission(p.key)}
                  className="rounded border-gray-300 text-primary-500 focus:ring-primary-300"
                />
                <span className="text-sm text-gray-700">{p.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={saving} disabled={!email.trim()}>
            Send Invitation
          </Button>
        </div>
      </div>
    </Modal>
  );
}

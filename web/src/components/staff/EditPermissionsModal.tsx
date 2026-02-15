import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { StaffAssignment, ManagerPermission, NursePermission } from '../../types/database';

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

interface EditPermissionsModalProps {
  open: boolean;
  onClose: () => void;
  assignment: StaffAssignment;
  onSaved: () => void;
}

export function EditPermissionsModal({ open, onClose, assignment, onSaved }: EditPermissionsModalProps) {
  const { surgeonProfile } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([...assignment.permissions]);
  const [saving, setSaving] = useState(false);

  const availablePermissions = assignment.staff_role === 'manager' ? MANAGER_PERMISSIONS : NURSE_PERMISSIONS;

  const togglePermission = (key: string) => {
    setPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    await supabase
      .from('staff_assignments')
      .update({ permissions, updated_at: new Date().toISOString() })
      .eq('id', assignment.id);

    // Notify staff member of permission change
    const userId = (await supabase.auth.getUser()).data.user?.id;
    await supabase.from('notifications').insert({
      user_id: assignment.staff_user_id,
      sender_id: userId ?? null,
      type: 'permission_change',
      title: 'Permissions Updated',
      message: `Your permissions for ${surgeonProfile?.full_name}'s practice have been updated.`,
      data: { surgeon_id: assignment.surgeon_id, new_permissions: permissions },
      read: false,
      action_type: null,
      action_data: null,
      action_taken: false,
    });

    setSaving(false);
    onClose();
    onSaved();
  };

  const staffName = (assignment as any).staff_profile?.full_name || 'Staff Member';

  return (
    <Modal open={open} onClose={onClose} title={`Edit Permissions — ${staffName}`}>
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Role:</span>
          <span className="font-medium text-gray-700 capitalize">{assignment.staff_role}</span>
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
          <Button onClick={handleSave} loading={saving}>Save Permissions</Button>
        </div>
      </div>
    </Modal>
  );
}

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSurgeonContext } from '../../hooks/useSurgeonContext';
import { useStaffPermissions } from '../../hooks/useStaffPermissions';
import type { StaffAssignment } from '../../types/database';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Table } from '../../components/ui/Table';
import { InviteStaffModal } from '../../components/staff/InviteStaffModal';
import { EditPermissionsModal } from '../../components/staff/EditPermissionsModal';
import { UserPlus, Shield, XCircle } from 'lucide-react';

export function StaffManagementPage() {
  const { user } = useAuth();
  const { surgeonId } = useSurgeonContext();
  const { hasPermission } = useStaffPermissions();
  const [assignments, setAssignments] = useState<StaffAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<StaffAssignment | null>(null);

  const canManage = hasPermission('manage_staff');

  const loadAssignments = async () => {
    if (!surgeonId) return;
    const { data } = await supabase
      .from('staff_assignments')
      .select('*')
      .eq('surgeon_id', surgeonId)
      .eq('is_active', true)
      .eq('staff_role', 'nurse')
      .order('created_at', { ascending: false });

    const rows = data || [];
    const userIds = [...new Set(rows.map((r: any) => r.staff_user_id))];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id, full_name, email, role')
        .in('user_id', userIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      for (const row of rows) {
        (row as any).staff_profile = profileMap.get((row as any).staff_user_id) || null;
      }
    }

    setAssignments(rows as StaffAssignment[]);
    setLoading(false);
  };

  useEffect(() => { loadAssignments(); }, [surgeonId]);

  if (!surgeonId) {
    return (
      <div className="p-8 text-center text-gray-400">
        Select a surgeon to manage their staff.
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="p-8 text-center text-gray-400">
        You don't have permission to manage staff for this surgeon.
      </div>
    );
  }

  const handleRevoke = async (assignment: StaffAssignment) => {
    if (!confirm('Revoke access for this staff member?')) return;
    await supabase
      .from('staff_assignments')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', assignment.id);
    loadAssignments();
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (a: any) => (
        <span className="font-medium text-gray-900">{a.staff_profile?.full_name || 'Unknown'}</span>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (a: any) => a.staff_profile?.email || '-',
    },
    {
      key: 'permissions',
      header: 'Permissions',
      render: (a: StaffAssignment) => (
        <div className="flex flex-wrap gap-1">
          {a.permissions.map((p) => (
            <span key={p} className="inline-block px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
              {p.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (a: StaffAssignment) => (
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="ghost" onClick={() => setEditingAssignment(a)}>
            <Shield className="w-4 h-4 mr-1" /> Permissions
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleRevoke(a)} className="text-danger-500">
            <XCircle className="w-4 h-4 mr-1" /> Revoke
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <UserPlus className="w-4 h-4 mr-1" /> Invite Nurse
        </Button>
      </div>

      <Card padding={false}>
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <Table columns={columns} data={assignments} keyField="id" emptyMessage="No nurses assigned" />
        )}
      </Card>

      <InviteStaffModal open={inviteOpen} onClose={() => setInviteOpen(false)} onInvited={loadAssignments} />

      {editingAssignment && (
        <EditPermissionsModal
          open={!!editingAssignment}
          onClose={() => setEditingAssignment(null)}
          assignment={editingAssignment}
          onSaved={loadAssignments}
        />
      )}
    </div>
  );
}

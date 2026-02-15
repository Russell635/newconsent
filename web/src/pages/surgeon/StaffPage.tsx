import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { StaffAssignment } from '../../types/database';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Table } from '../../components/ui/Table';
import { InviteStaffModal } from '../../components/staff/InviteStaffModal';
import { EditPermissionsModal } from '../../components/staff/EditPermissionsModal';
import { UserPlus, Shield, XCircle } from 'lucide-react';

export function StaffPage() {
  const { surgeonProfile, user } = useAuth();
  const [assignments, setAssignments] = useState<StaffAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<StaffAssignment | null>(null);

  const loadAssignments = async () => {
    if (!surgeonProfile) return;
    const { data, error } = await supabase
      .from('staff_assignments')
      .select('*')
      .eq('surgeon_id', surgeonProfile.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load assignments:', error.message);
      setLoading(false);
      return;
    }

    const rows = data || [];

    // Fetch staff profiles for each assignment
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

  useEffect(() => { loadAssignments(); }, [surgeonProfile]);

  const handleRevoke = async (assignment: StaffAssignment) => {
    if (!confirm(`Revoke access for ${(assignment as any).staff_profile?.full_name || 'this staff member'}?`)) return;
    await supabase
      .from('staff_assignments')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', assignment.id);

    // Notify the staff member
    if (assignment.staff_user_id && user) {
      await supabase.from('notifications').insert({
        user_id: assignment.staff_user_id,
        sender_id: user.id,
        type: 'access_revoked',
        title: 'Access Revoked',
        message: `Your access to ${surgeonProfile?.full_name}'s practice has been revoked.`,
        data: { surgeon_id: surgeonProfile?.id },
        read: false,
        action_type: null,
        action_data: null,
        action_taken: false,
      });
    }
    loadAssignments();
  };

  const active = assignments.filter((a) => a.invitation_status === 'accepted');
  const pending = assignments.filter((a) => a.invitation_status === 'pending');

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
      key: 'staff_role',
      header: 'Role',
      render: (a: StaffAssignment) => (
        <Badge variant={a.staff_role === 'manager' ? 'info' : 'default'}>
          {a.staff_role === 'manager' ? 'Manager' : 'Nurse'}
        </Badge>
      ),
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
          {a.permissions.length === 0 && <span className="text-xs text-gray-400">None</span>}
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
          <Button size="sm" variant="ghost" onClick={() => handleRevoke(a)} className="text-danger-500 hover:text-danger-700">
            <XCircle className="w-4 h-4 mr-1" /> Revoke
          </Button>
        </div>
      ),
    },
  ];

  const pendingColumns = [
    {
      key: 'email',
      header: 'Email',
      render: (a: any) => a.staff_profile?.email || 'Unregistered',
    },
    {
      key: 'staff_role',
      header: 'Role',
      render: (a: StaffAssignment) => (
        <Badge variant="warning">{a.staff_role === 'manager' ? 'Manager' : 'Nurse'} (Pending)</Badge>
      ),
    },
    {
      key: 'invited_at',
      header: 'Invited',
      render: (a: StaffAssignment) => a.invited_at ? new Date(a.invited_at).toLocaleDateString() : '-',
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Staff Management</h1>
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <UserPlus className="w-4 h-4 mr-1" /> Invite Staff
        </Button>
      </div>

      <Card padding={false} className="mb-6">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Active Staff</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <Table columns={columns} data={active} keyField="id" emptyMessage="No active staff members" />
        )}
      </Card>

      {pending.length > 0 && (
        <Card padding={false}>
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Pending Invitations</h3>
          </div>
          <Table columns={pendingColumns} data={pending} keyField="id" emptyMessage="" />
        </Card>
      )}

      <InviteStaffModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={loadAssignments}
      />

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

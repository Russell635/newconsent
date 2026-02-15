import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Check, X } from 'lucide-react';

export function InvitationsPage() {
  const { user, profile, staffAssignments, refreshAssignments } = useAuth();
  const [processing, setProcessing] = useState<string | null>(null);

  const pending = staffAssignments.filter((a) => a.invitation_status === 'pending');
  const history = staffAssignments.filter((a) => a.invitation_status !== 'pending');

  const handleAccept = async (assignmentId: string) => {
    setProcessing(assignmentId);
    await supabase
      .from('staff_assignments')
      .update({
        invitation_status: 'accepted',
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', assignmentId);

    // Mark the related notification as acted on
    const assignment = staffAssignments.find((a) => a.id === assignmentId);
    if (assignment) {
      await supabase
        .from('notifications')
        .update({ action_taken: true, action_taken_at: new Date().toISOString() })
        .eq('user_id', assignment.staff_user_id)
        .eq('action_type', 'accept_invitation')
        .eq('action_taken', false)
        .contains('action_data', { surgeon_id: assignment.surgeon_id });

      // Notify the surgeon that the invitation was accepted
      if (assignment.invited_by) {
        await supabase.from('notifications').insert({
          user_id: assignment.invited_by,
          sender_id: user?.id ?? null,
          type: 'invitation_accepted',
          title: 'Invitation Accepted',
          message: `${profile?.full_name} has accepted your staff invitation as ${assignment.staff_role}.`,
          data: { staff_user_id: assignment.staff_user_id, assignment_id: assignment.id },
          read: false,
          action_type: null,
          action_data: null,
          action_taken: false,
        });
      }
    }

    await refreshAssignments();
    setProcessing(null);
  };

  const handleDecline = async (assignmentId: string) => {
    setProcessing(assignmentId);
    const assignment = staffAssignments.find((a) => a.id === assignmentId);

    await supabase
      .from('staff_assignments')
      .update({
        invitation_status: 'declined',
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', assignmentId);

    // Notify the surgeon that the invitation was declined
    if (assignment?.invited_by) {
      await supabase.from('notifications').insert({
        user_id: assignment.invited_by,
        sender_id: user?.id ?? null,
        type: 'invitation_declined',
        title: 'Invitation Declined',
        message: `${profile?.full_name} has declined your staff invitation.`,
        data: { staff_user_id: assignment.staff_user_id, assignment_id: assignment.id },
        read: false,
        action_type: null,
        action_data: null,
        action_taken: false,
      });
    }

    await refreshAssignments();
    setProcessing(null);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Invitations</h1>

      {/* Pending */}
      <Card className="mb-6">
        <h3 className="font-semibold text-gray-900 mb-3">Pending Invitations</h3>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-400">No pending invitations</p>
        ) : (
          <div className="space-y-3">
            {pending.map((inv) => (
              <div key={inv.id} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {inv.surgeon_profile?.full_name || 'Unknown Surgeon'}
                    </p>
                    {inv.surgeon_profile?.practice_name && (
                      <p className="text-sm text-gray-500">{inv.surgeon_profile.practice_name}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="info">{inv.staff_role === 'manager' ? 'Manager' : 'Nurse'}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {inv.permissions.map((p) => (
                        <span key={p} className="inline-block px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                          {p.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleDecline(inv.id)}
                      loading={processing === inv.id}
                    >
                      <X className="w-4 h-4 mr-1" /> Decline
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleAccept(inv.id)}
                      loading={processing === inv.id}
                    >
                      <Check className="w-4 h-4 mr-1" /> Accept
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* History */}
      {history.length > 0 && (
        <Card>
          <h3 className="font-semibold text-gray-900 mb-3">History</h3>
          <div className="space-y-2">
            {history.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">
                    {inv.surgeon_profile?.full_name || 'Unknown'}
                  </p>
                  <p className="text-xs text-gray-400 capitalize">{inv.staff_role}</p>
                </div>
                <Badge
                  variant={
                    inv.invitation_status === 'accepted' ? 'success' :
                    inv.invitation_status === 'declined' ? 'danger' : 'default'
                  }
                >
                  {inv.invitation_status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

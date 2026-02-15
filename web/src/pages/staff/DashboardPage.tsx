import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Mail, FileText, MessageSquare } from 'lucide-react';

interface PendingInvitation {
  id: string;
  surgeon_id: string;
  staff_role: string;
  surgeon_name: string;
  practice_name: string | null;
}

interface ConsentSummary {
  id: string;
  status: string;
  patient_name: string;
  procedure_name: string;
  surgeon_name: string;
  surgeon_id: string;
}

export function StaffDashboardPage() {
  const { user, staffAssignments, setActiveSurgeonId } = useAuth();
  const navigate = useNavigate();
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [awaitingReview, setAwaitingReview] = useState<ConsentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadDashboard();
  }, [user, staffAssignments]);

  const loadDashboard = async () => {
    // Get pending invitations
    const pending = staffAssignments
      .filter((a) => a.invitation_status === 'pending')
      .map((a) => ({
        id: a.id,
        surgeon_id: a.surgeon_id,
        staff_role: a.staff_role,
        surgeon_name: a.surgeon_profile?.full_name || 'Unknown',
        practice_name: a.surgeon_profile?.practice_name || null,
      }));
    setPendingInvitations(pending);

    // Get consents awaiting review across all assigned surgeons
    const acceptedSurgeonIds = staffAssignments
      .filter((a) => a.invitation_status === 'accepted' && a.is_active)
      .map((a) => a.surgeon_id);

    if (acceptedSurgeonIds.length > 0) {
      const { data: consents } = await supabase
        .from('patient_consents')
        .select('id, status, surgeon_id, patients(first_name, last_name), surgeon_procedures(name)')
        .in('surgeon_id', acceptedSurgeonIds)
        .in('status', ['patient_completed', 'under_review'])
        .order('created_at', { ascending: false })
        .limit(20);

      const surgeonMap = new Map(
        staffAssignments.map((a) => [a.surgeon_id, a.surgeon_profile?.full_name || 'Unknown'])
      );

      setAwaitingReview(
        (consents || []).map((c: any) => ({
          id: c.id,
          status: c.status,
          patient_name: c.patients ? `${c.patients.first_name} ${c.patients.last_name}` : 'Unknown',
          procedure_name: c.surgeon_procedures?.name || 'Unknown',
          surgeon_name: surgeonMap.get(c.surgeon_id) || 'Unknown',
          surgeon_id: c.surgeon_id,
        }))
      );
    }

    setLoading(false);
  };

  const handleConsentClick = (consent: ConsentSummary) => {
    setActiveSurgeonId(consent.surgeon_id);
    navigate(`/staff/consents/${consent.id}`);
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-400">Loading...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Staff Dashboard</h1>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="w-5 h-5 text-primary-500" />
            <h3 className="font-semibold text-gray-900">Pending Invitations</h3>
            <Badge variant="warning">{pendingInvitations.length}</Badge>
          </div>
          <div className="space-y-2">
            {pendingInvitations.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{inv.surgeon_name}</p>
                  <p className="text-sm text-gray-500">
                    {inv.practice_name && `${inv.practice_name} — `}
                    Role: <span className="capitalize">{inv.staff_role}</span>
                  </p>
                </div>
                <button
                  onClick={() => navigate('/staff/invitations')}
                  className="text-sm text-primary-500 hover:underline"
                >
                  View
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Consents Awaiting Review */}
      <Card className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-5 h-5 text-primary-500" />
          <h3 className="font-semibold text-gray-900">Consents Awaiting Review</h3>
          {awaitingReview.length > 0 && <Badge variant="info">{awaitingReview.length}</Badge>}
        </div>
        {awaitingReview.length === 0 ? (
          <p className="text-sm text-gray-400">No consents awaiting review</p>
        ) : (
          <div className="space-y-2">
            {awaitingReview.map((c) => (
              <button
                key={c.id}
                onClick={() => handleConsentClick(c)}
                className="w-full text-left p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{c.patient_name}</p>
                    <p className="text-sm text-gray-500">{c.procedure_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">{c.surgeon_name}</p>
                    <Badge variant={c.status === 'patient_completed' ? 'warning' : 'info'}>
                      {c.status === 'patient_completed' ? 'Awaiting Review' : 'Under Review'}
                    </Badge>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <p className="text-sm text-gray-500">Assigned Surgeons</p>
          <p className="text-2xl font-bold text-gray-900">
            {staffAssignments.filter((a) => a.invitation_status === 'accepted' && a.is_active).length}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Pending Invitations</p>
          <p className="text-2xl font-bold text-gray-900">{pendingInvitations.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Consents to Review</p>
          <p className="text-2xl font-bold text-gray-900">{awaitingReview.length}</p>
        </Card>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useSurgeonContext } from '../../hooks/useSurgeonContext';
import type { PatientConsent } from '../../types/database';
import { Card, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Table } from '../../components/ui/Table';

const statusVariant: Record<string, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
  not_started: 'default',
  assigned: 'default',
  in_progress: 'info',
  patient_completed: 'warning',
  under_review: 'info',
  completed: 'success',
  valid: 'success',
  withdrawn: 'danger',
};

const statusLabel: Record<string, string> = {
  not_started: 'Not Started',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  patient_completed: 'Awaiting Review',
  under_review: 'Under Review',
  completed: 'Completed',
  valid: 'Valid',
  withdrawn: 'Withdrawn',
};

export function ConsentsPage() {
  const { surgeonProfile } = useAuth();
  const { surgeonId, isSurgeon } = useSurgeonContext();
  const navigate = useNavigate();
  const [consents, setConsents] = useState<(PatientConsent & { patient_name: string; procedure_name: string })[]>([]);
  const [loading, setLoading] = useState(true);

  const effectiveSurgeonId = surgeonId || surgeonProfile?.id;

  useEffect(() => {
    if (!effectiveSurgeonId) return;
    supabase
      .from('patient_consents')
      .select('*, patient:patients(first_name, last_name), surgeon_procedure:surgeon_procedures(name)')
      .eq('surgeon_id', effectiveSurgeonId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setConsents(
          (data || []).map((c: any) => ({
            ...c,
            patient_name: c.patient ? `${c.patient.first_name} ${c.patient.last_name}` : 'Unknown',
            procedure_name: c.surgeon_procedure?.name || 'Unknown',
          }))
        );
        setLoading(false);
      });
  }, [effectiveSurgeonId]);

  const columns = [
    {
      key: 'patient_name',
      header: 'Patient',
      render: (c: any) => <span className="font-medium text-gray-900">{c.patient_name}</span>,
    },
    { key: 'procedure_name', header: 'Procedure' },
    {
      key: 'status',
      header: 'Status',
      render: (c: any) => <Badge variant={statusVariant[c.status] || 'default'}>{statusLabel[c.status] || c.status}</Badge>,
    },
    {
      key: 'scanned_at',
      header: 'Scanned',
      render: (c: any) => c.scanned_at ? new Date(c.scanned_at).toLocaleDateString() : c.assigned_at ? new Date(c.assigned_at).toLocaleDateString() : '-',
    },
    {
      key: 'patient_completed_at',
      header: 'Patient Done',
      render: (c: any) => c.patient_completed_at ? new Date(c.patient_completed_at).toLocaleDateString() : '-',
    },
    {
      key: 'reviewed_at',
      header: 'Validated',
      render: (c: any) => c.reviewed_at ? new Date(c.reviewed_at).toLocaleDateString() : '-',
    },
  ];

  if (!isSurgeon && !effectiveSurgeonId) {
    return <div className="p-8 text-center text-gray-400">Select a surgeon to view consents.</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Consent Records</h1>
      <Card padding={false}>
        <div className="p-4 border-b border-gray-200">
          <CardHeader title="All Consents" description="Track patient consent progress and review completed consents" />
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <Table
            columns={columns}
            data={consents}
            keyField="id"
            onRowClick={(c) => navigate(`${isSurgeon ? '/surgeon' : '/staff'}/consents/${c.id}`)}
            emptyMessage="No consent records yet — patients will appear here after scanning a QR code"
          />
        )}
      </Card>
    </div>
  );
}

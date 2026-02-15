import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ArrowLeft, Check, MessageSquare, FileCheck, ClipboardCheck } from 'lucide-react';
import { useSurgeonContext } from '../../hooks/useSurgeonContext';
import { useStaffPermissions } from '../../hooks/useStaffPermissions';

interface ConsentDetail {
  id: string;
  status: string;
  scanned_at: string;
  started_at: string | null;
  patient_completed_at: string | null;
  reviewed_at: string | null;
  consent_version: number;
  patient: { first_name: string; last_name: string; date_of_birth: string | null; email: string | null };
  procedure: { name: string };
}

interface ReviewItem {
  review_area: string;
  reviewed_at: string;
}

interface ChatSessionSummary {
  id: string;
  section_key: string;
  started_at: string;
  resolved_at: string | null;
  reviewed_at: string | null;
  message_count: number;
}

export function ConsentReviewPage() {
  const { consentId } = useParams<{ consentId: string }>();
  const { user } = useAuth();
  const { isSurgeon } = useSurgeonContext();
  const { hasPermission } = useStaffPermissions();
  const canValidate = hasPermission('validate_consent');
  const navigate = useNavigate();
  const backPath = isSurgeon ? '/surgeon/consents' : '/staff/consents';
  const [consent, setConsent] = useState<ConsentDetail | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSessionSummary[]>([]);
  const [sections, setSections] = useState<{ id: string; title: string; section_type: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!consentId) return;
    loadData();
  }, [consentId]);

  const loadData = async () => {
    const [consentRes, reviewRes, chatRes] = await Promise.all([
      supabase.from('patient_consents').select(`
        id, status, scanned_at, started_at, patient_completed_at, reviewed_at, consent_version,
        patients(first_name, last_name, date_of_birth, email),
        surgeon_procedures(name, id)
      `).eq('id', consentId!).single(),
      supabase.from('consent_review_items').select('review_area, reviewed_at').eq('consent_id', consentId!),
      supabase.from('consent_chat_sessions').select('id, section_key, started_at, resolved_at, reviewed_at').eq('consent_id', consentId!),
    ]);

    if (consentRes.data) {
      const d = consentRes.data as any;
      setConsent({
        id: d.id,
        status: d.status,
        scanned_at: d.scanned_at,
        started_at: d.started_at,
        patient_completed_at: d.patient_completed_at,
        reviewed_at: d.reviewed_at,
        consent_version: d.consent_version ?? 1,
        patient: d.patients,
        procedure: d.surgeon_procedures,
      });

      // Load sections for this procedure
      const { data: sectionData } = await supabase
        .from('consent_sections')
        .select('id, title, section_type')
        .eq('surgeon_procedure_id', d.surgeon_procedures.id)
        .order('sort_order');
      setSections(sectionData || []);
    }

    setReviewItems(reviewRes.data || []);

    // Count messages per chat session
    const sessions = chatRes.data || [];
    const sessionsWithCounts: ChatSessionSummary[] = [];
    for (const s of sessions) {
      const { count } = await supabase
        .from('consent_chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('chat_session_id', s.id);
      sessionsWithCounts.push({ ...s, message_count: count ?? 0 });
    }
    setChatSessions(sessionsWithCounts);
    setLoading(false);
  };

  const isReviewed = (area: string) => reviewItems.some(r => r.review_area === area);

  const markReviewed = async (area: string) => {
    if (!user || isReviewed(area)) return;
    await supabase.from('consent_review_items').insert({
      consent_id: consentId,
      review_area: area,
      reviewed_by: user.id,
    });
    setReviewItems(prev => [...prev, { review_area: area, reviewed_at: new Date().toISOString() }]);
  };

  const allReviewAreas = [
    ...sections.map(s => `section:${s.section_type}`),
    'quiz',
    ...chatSessions.map(c => `chat:${c.id}`),
    'acknowledgments',
    'signature',
  ];

  const allReviewed = allReviewAreas.every(area => isReviewed(area));

  const handleValidate = async () => {
    if (!allReviewed || !user) return;
    await supabase.from('patient_consents').update({
      status: 'valid',
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    }).eq('id', consentId);
    navigate(backPath);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'not_started': return <Badge variant="default">Not Started</Badge>;
      case 'in_progress': return <Badge variant="warning">In Progress</Badge>;
      case 'patient_completed': return <Badge variant="info">Awaiting Review</Badge>;
      case 'under_review': return <Badge variant="info">Under Review</Badge>;
      case 'valid': return <Badge variant="success">Valid</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  if (loading || !consent) {
    return <div className="p-8 text-center text-gray-400">Loading consent details...</div>;
  }

  return (
    <div>
      <button onClick={() => navigate(backPath)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Consents
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{consent.procedure.name}</h1>
          <p className="text-gray-500 mt-1">
            Patient: {consent.patient.first_name} {consent.patient.last_name}
            {consent.patient.date_of_birth && ` — DOB: ${new Date(consent.patient.date_of_birth).toLocaleDateString()}`}
          </p>
        </div>
        {getStatusBadge(consent.status)}
      </div>

      {/* Timeline */}
      <Card className="mb-6">
        <h3 className="font-semibold text-gray-900 mb-3">Timeline</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Scanned</p>
            <p className="font-medium">{consent.scanned_at ? new Date(consent.scanned_at).toLocaleString() : '-'}</p>
          </div>
          <div>
            <p className="text-gray-500">Started</p>
            <p className="font-medium">{consent.started_at ? new Date(consent.started_at).toLocaleString() : '-'}</p>
          </div>
          <div>
            <p className="text-gray-500">Patient Completed</p>
            <p className="font-medium">{consent.patient_completed_at ? new Date(consent.patient_completed_at).toLocaleString() : '-'}</p>
          </div>
          <div>
            <p className="text-gray-500">Validated</p>
            <p className="font-medium">{consent.reviewed_at ? new Date(consent.reviewed_at).toLocaleString() : '-'}</p>
          </div>
        </div>
      </Card>

      {/* Review sections */}
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Review Checklist</h2>
      <div className="space-y-2 mb-6">
        {sections.map(section => {
          const area = `section:${section.section_type}`;
          const reviewed = isReviewed(area);
          return (
            <Card key={section.id} className={reviewed ? 'border-green-200 bg-green-50/30' : ''}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${reviewed ? 'bg-green-500' : 'border-2 border-gray-300'}`}>
                    {reviewed && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{section.title}</p>
                    <p className="text-xs text-gray-500">{section.section_type.replace(/_/g, ' ')}</p>
                  </div>
                </div>
                {!reviewed && (
                  <Button size="sm" variant="ghost" onClick={() => markReviewed(area)}>
                    <ClipboardCheck className="w-4 h-4 mr-1" /> Mark Reviewed
                  </Button>
                )}
              </div>
            </Card>
          );
        })}

        {/* Quiz */}
        <Card className={isReviewed('quiz') ? 'border-green-200 bg-green-50/30' : ''}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isReviewed('quiz') ? 'bg-green-500' : 'border-2 border-gray-300'}`}>
                {isReviewed('quiz') && <Check className="w-4 h-4 text-white" />}
              </div>
              <p className="font-medium text-gray-900">Quiz Results</p>
            </div>
            {!isReviewed('quiz') && (
              <Button size="sm" variant="ghost" onClick={() => markReviewed('quiz')}>
                <ClipboardCheck className="w-4 h-4 mr-1" /> Mark Reviewed
              </Button>
            )}
          </div>
        </Card>

        {/* Chat sessions */}
        {chatSessions.map(chat => {
          const area = `chat:${chat.id}`;
          const reviewed = isReviewed(area);
          return (
            <Card key={chat.id} className={reviewed ? 'border-green-200 bg-green-50/30' : ''}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${reviewed ? 'bg-green-500' : 'border-2 border-gray-300'}`}>
                    {reviewed && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      <MessageSquare className="w-4 h-4 inline mr-1" />
                      Chat: {chat.section_key.replace(/_/g, ' ')}
                    </p>
                    <p className="text-xs text-gray-500">{chat.message_count} messages</p>
                  </div>
                </div>
                {!reviewed && (
                  <Button size="sm" variant="ghost" onClick={() => markReviewed(area)}>
                    <ClipboardCheck className="w-4 h-4 mr-1" /> Mark Reviewed
                  </Button>
                )}
              </div>
            </Card>
          );
        })}

        {/* Acknowledgments */}
        <Card className={isReviewed('acknowledgments') ? 'border-green-200 bg-green-50/30' : ''}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isReviewed('acknowledgments') ? 'bg-green-500' : 'border-2 border-gray-300'}`}>
                {isReviewed('acknowledgments') && <Check className="w-4 h-4 text-white" />}
              </div>
              <p className="font-medium text-gray-900">Acknowledgments</p>
            </div>
            {!isReviewed('acknowledgments') && (
              <Button size="sm" variant="ghost" onClick={() => markReviewed('acknowledgments')}>
                <ClipboardCheck className="w-4 h-4 mr-1" /> Mark Reviewed
              </Button>
            )}
          </div>
        </Card>

        {/* Signature */}
        <Card className={isReviewed('signature') ? 'border-green-200 bg-green-50/30' : ''}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isReviewed('signature') ? 'bg-green-500' : 'border-2 border-gray-300'}`}>
                {isReviewed('signature') && <Check className="w-4 h-4 text-white" />}
              </div>
              <p className="font-medium text-gray-900">Patient Signature</p>
            </div>
            {!isReviewed('signature') && (
              <Button size="sm" variant="ghost" onClick={() => markReviewed('signature')}>
                <ClipboardCheck className="w-4 h-4 mr-1" /> Mark Reviewed
              </Button>
            )}
          </div>
        </Card>
      </div>

      {/* Validate button */}
      {consent.status !== 'valid' && canValidate && (
        <div className="flex justify-end">
          <Button
            onClick={handleValidate}
            disabled={!allReviewed}
            className={allReviewed ? 'bg-green-600 hover:bg-green-700' : ''}
          >
            <FileCheck className="w-4 h-4 mr-1" />
            {allReviewed ? 'Validate Consent' : `Review all items to validate (${reviewItems.length}/${allReviewAreas.length})`}
          </Button>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Card, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ArrowLeft, CheckCircle, AlertCircle, Zap } from 'lucide-react';

interface MasterOperation {
  id: string;
  name: string;
  description: string;
  body_region: string;
  is_ai_generated: boolean;
  approved: boolean;
  has_been_used: boolean;
}

interface Complication {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  is_ai_generated: boolean;
  approved: boolean;
  is_systemic: boolean;
}

const severityColors: Record<string, string> = {
  low: 'bg-green-50 border-green-200 text-green-700',
  medium: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  high: 'bg-orange-50 border-orange-200 text-orange-700',
  critical: 'bg-red-50 border-red-200 text-red-700',
};

const severityBadgeVariants: Record<string, any> = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
  critical: 'danger',
};

export function OperationDetailPage() {
  const { specialtyId, operationId } = useParams();
  const navigate = useNavigate();
  const [operation, setOperation] = useState<MasterOperation | null>(null);
  const [complications, setComplications] = useState<Complication[]>([]);
  const [approving, setApproving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!operationId) return;

      const [opRes, compRes] = await Promise.all([
        supabase
          .from('master_operations')
          .select('*')
          .eq('id', operationId)
          .single(),
        supabase
          .from('master_complications')
          .select('*')
          .eq('operation_id', operationId)
          .order('severity desc, name'),
      ]);

      setOperation(opRes.data);
      setComplications(compRes.data || []);
      setLoading(false);
    }
    load();
  }, [operationId]);

  const handleApproveComplication = async (compId: string, approve: boolean) => {
    setApproving(compId);
    await supabase
      .from('master_complications')
      .update({ approved: approve })
      .eq('id', compId);

    setComplications(
      complications.map(c =>
        c.id === compId ? { ...c, approved: approve } : c
      )
    );
    setApproving(null);
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>;
  if (!operation) return <div className="p-8 text-center text-gray-400">Operation not found</div>;

  const pendingComplications = complications.filter(c => !c.approved);
  const approvedComplications = complications.filter(c => c.approved);

  return (
    <div>
      <button
        onClick={() => navigate(`/admin/master-list/${specialtyId}`)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Specialty
      </button>

      {/* Operation Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{operation.name}</h1>
              {operation.is_ai_generated && (
                <Badge variant="warning" title="AI-generated">
                  <Zap className="w-3 h-3 mr-1" /> AI
                </Badge>
              )}
              {operation.approved && (
                <Badge variant="success" title="Approved">
                  <CheckCircle className="w-3 h-3 mr-1" /> Approved
                </Badge>
              )}
            </div>
            {operation.description && (
              <p className="text-gray-600 max-w-2xl">{operation.description}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
          {operation.body_region && (
            <div>
              <span className="font-medium">Region:</span> {operation.body_region}
            </div>
          )}
          <div>
            <span className="font-medium">Total Complications:</span> {complications.length}
          </div>
          <div>
            <span className="font-medium">Pending Approval:</span> {pendingComplications.length}
          </div>
        </div>
      </div>

      {/* Complications */}
      <div className="space-y-6">
        {/* Pending Complications */}
        {pendingComplications.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              Pending Approval ({pendingComplications.length})
            </h2>
            <div className="space-y-3">
              {pendingComplications.map(comp => (
                <Card
                  key={comp.id}
                  className={`border-2 ${severityColors[comp.severity]}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-gray-900">{comp.name}</h3>
                        <Badge
                          variant={severityBadgeVariants[comp.severity]}
                          size="sm"
                        >
                          {comp.severity.charAt(0).toUpperCase() + comp.severity.slice(1)}
                        </Badge>
                        {comp.is_ai_generated && (
                          <Badge variant="info" size="sm">
                            AI
                          </Badge>
                        )}
                        {comp.is_systemic && (
                          <Badge variant="info" size="sm">
                            Systemic
                          </Badge>
                        )}
                      </div>
                      {comp.description && (
                        <p className="text-sm text-gray-600">{comp.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleApproveComplication(comp.id, false)}
                        loading={approving === comp.id}
                        disabled={approving !== null}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApproveComplication(comp.id, true)}
                        loading={approving === comp.id}
                        disabled={approving !== null}
                      >
                        Approve
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Approved Complications */}
        {approvedComplications.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Approved ({approvedComplications.length})
            </h2>
            <div className="space-y-2">
              {approvedComplications.map(comp => (
                <Card key={comp.id} className="bg-green-50 border-green-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{comp.name}</h3>
                        <Badge variant="success" size="sm">
                          {comp.severity.charAt(0).toUpperCase() + comp.severity.slice(1)}
                        </Badge>
                        {comp.is_systemic && (
                          <Badge variant="info" size="sm">
                            Systemic
                          </Badge>
                        )}
                      </div>
                      {comp.description && (
                        <p className="text-sm text-gray-600">{comp.description}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleApproveComplication(comp.id, false)}
                      loading={approving === comp.id}
                      disabled={approving !== null}
                    >
                      Unapprove
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* No Complications */}
        {complications.length === 0 && (
          <Card>
            <p className="text-center text-gray-400">No complications defined for this operation.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

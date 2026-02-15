import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { MasterProcedure, ProcedureVersion } from '../../types/database';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { ArrowLeft, Clock } from 'lucide-react';

export function VersionHistoryPage() {
  const { specialtyId, procedureId } = useParams();
  const navigate = useNavigate();
  const [procedure, setProcedure] = useState<MasterProcedure | null>(null);
  const [versions, setVersions] = useState<ProcedureVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!procedureId) return;
      const [procRes, versRes] = await Promise.all([
        supabase.from('master_procedures').select('*').eq('id', procedureId).single(),
        supabase.from('procedure_versions').select('*').eq('master_procedure_id', procedureId).order('version', { ascending: false }),
      ]);
      setProcedure(procRes.data);
      setVersions(versRes.data || []);
      setLoading(false);
    }
    load();
  }, [procedureId]);

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>;
  if (!procedure) return <div className="p-8 text-center text-gray-400">Procedure not found</div>;

  return (
    <div className="max-w-3xl">
      <button onClick={() => navigate(`/admin/master-list/${specialtyId}`)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">{procedure.name}</h1>
      <p className="text-gray-500 mb-6">Version History — Current: v{procedure.version}</p>

      <div className="space-y-4">
        {/* Current version */}
        <Card className="border-primary-200 bg-primary-50/30">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="info">v{procedure.version} (Current)</Badge>
            <span className="text-xs text-gray-400">
              Updated {new Date(procedure.updated_at).toLocaleDateString()}
            </span>
          </div>
          <p className="text-sm text-gray-700">{procedure.description}</p>
          <div className="mt-3 flex flex-wrap gap-1">
            {procedure.risks.map((r, i) => (
              <span key={i} className="px-2 py-0.5 bg-red-50 text-red-600 text-xs rounded">{r}</span>
            ))}
          </div>
        </Card>

        {/* Historical versions */}
        {versions.map((v) => (
          <Card key={v.id}>
            <div className="flex items-center gap-2 mb-2">
              <Badge>v{v.version}</Badge>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Archived {new Date(v.archived_at).toLocaleDateString()}
              </span>
              {v.changed_by_email && (
                <span className="text-xs text-gray-400">by {v.changed_by_email}</span>
              )}
            </div>
            <p className="text-sm text-gray-600">{v.description}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {v.risks.map((r, i) => (
                <span key={i} className="px-2 py-0.5 bg-red-50 text-red-600 text-xs rounded">{r}</span>
              ))}
            </div>
          </Card>
        ))}

        {versions.length === 0 && (
          <Card>
            <p className="text-center text-gray-400">No previous versions. This is the first version.</p>
          </Card>
        )}
      </div>
    </div>
  );
}

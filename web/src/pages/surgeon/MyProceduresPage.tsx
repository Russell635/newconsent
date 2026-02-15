import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { SurgeonProcedure, MasterProcedure } from '../../types/database';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Plus, Download, Edit2, FileText, AlertTriangle } from 'lucide-react';

export function MyProceduresPage() {
  const { surgeonProfile } = useAuth();
  const navigate = useNavigate();
  const [procedures, setProcedures] = useState<(SurgeonProcedure & { has_update?: boolean })[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProcedures = async () => {
    if (!surgeonProfile) return;
    const { data } = await supabase
      .from('surgeon_procedures')
      .select('*, master_procedure:master_procedures(version)')
      .eq('surgeon_id', surgeonProfile.id)
      .order('name');

    if (data) {
      setProcedures(
        data.map((p) => ({
          ...p,
          has_update: p.master_procedure && p.imported_version
            ? (p.master_procedure as unknown as MasterProcedure).version > p.imported_version
            : false,
        }))
      );
    }
    setLoading(false);
  };

  useEffect(() => { loadProcedures(); }, [surgeonProfile]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Procedures</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate('/surgeon/procedures/import')}>
            <Download className="w-4 h-4 mr-1" /> Import from Master List
          </Button>
          <Button size="sm" onClick={() => navigate('/surgeon/procedures/new')}>
            <Plus className="w-4 h-4 mr-1" /> Create Custom
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-400">Loading...</div>
      ) : procedures.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-gray-400 mb-4">You haven't added any procedures yet.</p>
          <div className="flex items-center justify-center gap-3">
            <Button variant="secondary" onClick={() => navigate('/surgeon/procedures/import')}>
              <Download className="w-4 h-4 mr-1" /> Import from Master List
            </Button>
            <Button onClick={() => navigate('/surgeon/procedures/new')}>
              <Plus className="w-4 h-4 mr-1" /> Create Custom
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {procedures.map((proc) => (
            <Card key={proc.id} className="hover:border-primary-200 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{proc.name}</h3>
                    {proc.is_custom && <Badge variant="default">Custom</Badge>}
                    {proc.imported_version && <Badge variant="info">v{proc.imported_version}</Badge>}
                    {proc.has_update && (
                      <Badge variant="warning">
                        <AlertTriangle className="w-3 h-3 mr-1" /> Update Available
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{proc.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    <span>{proc.risks.length} risks</span>
                    <span>{proc.benefits.length} benefits</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-4">
                  <button
                    onClick={() => navigate(`/surgeon/procedures/edit/${proc.id}`)}
                    className="p-2 text-gray-400 hover:text-primary-500 rounded-lg hover:bg-gray-50"
                    title="Edit procedure"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => navigate(`/surgeon/procedures/${proc.id}/content`)}
                    className="p-2 text-gray-400 hover:text-primary-500 rounded-lg hover:bg-gray-50"
                    title="Build consent content"
                  >
                    <FileText className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

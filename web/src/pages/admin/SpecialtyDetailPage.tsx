import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Specialty, MasterProcedure } from '../../types/database';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ArrowLeft, Plus, Edit2, History } from 'lucide-react';

export function SpecialtyDetailPage() {
  const { specialtyId } = useParams<{ specialtyId: string }>();
  const navigate = useNavigate();
  const [specialty, setSpecialty] = useState<Specialty | null>(null);
  const [procedures, setProcedures] = useState<MasterProcedure[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!specialtyId) return;
      const [specRes, procRes] = await Promise.all([
        supabase.from('specialties').select('*').eq('id', specialtyId).single(),
        supabase.from('master_procedures').select('*').eq('specialty_id', specialtyId).order('name'),
      ]);
      setSpecialty(specRes.data);
      setProcedures(procRes.data || []);
      setLoading(false);
    }
    load();
  }, [specialtyId]);

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>;
  if (!specialty) return <div className="p-8 text-center text-gray-400">Specialty not found</div>;

  return (
    <div>
      <button onClick={() => navigate('/admin/master-list')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Specialties
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{specialty.name}</h1>
          {specialty.description && <p className="text-gray-500 mt-1">{specialty.description}</p>}
        </div>
        <Button size="sm" onClick={() => navigate(`/admin/master-list/${specialtyId}/new`)}>
          <Plus className="w-4 h-4 mr-1" /> Add Operation
        </Button>
      </div>

      <div className="space-y-3">
        {procedures.length === 0 ? (
          <Card>
            <p className="text-center text-gray-400">No operations yet. Add one to get started.</p>
          </Card>
        ) : (
          procedures.map((proc) => (
            <Card key={proc.id} className="hover:border-primary-200 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{proc.name}</h3>
                    <Badge variant="info" size="sm">v{proc.version}</Badge>
                  </div>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{proc.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    {proc.duration_minutes && <span>{proc.duration_minutes} min</span>}
                    {proc.recovery_time && <span>Recovery: {proc.recovery_time}</span>}
                    <span>{proc.risks.length} risks</span>
                    <span>{proc.benefits.length} benefits</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-4">
                  <button
                    onClick={() => navigate(`/admin/master-list/${specialtyId}/edit/${proc.id}`)}
                    className="p-2 text-gray-400 hover:text-primary-500 rounded-lg hover:bg-gray-50"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {proc.version > 1 && (
                    <button
                      onClick={() => navigate(`/admin/master-list/${specialtyId}/history/${proc.id}`)}
                      className="p-2 text-gray-400 hover:text-primary-500 rounded-lg hover:bg-gray-50"
                      title="Version history"
                    >
                      <History className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ArrowLeft, Eye, AlertCircle } from 'lucide-react';

interface MasterOperation {
  id: string;
  name: string;
  description: string;
  body_region: string;
  is_ai_generated: boolean;
  approved: boolean;
  has_been_used: boolean;
}

interface SpecialtyData {
  id: string;
  name: string;
  description: string | null;
}

export function SpecialtyDetailPage() {
  const { specialtyId } = useParams<{ specialtyId: string }>();
  const navigate = useNavigate();
  const [specialty, setSpecialty] = useState<SpecialtyData | null>(null);
  const [operations, setOperations] = useState<MasterOperation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!specialtyId) return;
      const [specRes, opsRes] = await Promise.all([
        supabase.from('master_specialties').select('*').eq('id', specialtyId).single(),
        supabase
          .from('operation_specialties')
          .select('master_operations(*)')
          .eq('specialty_id', specialtyId)
          .order('master_operations(name)'),
      ]);
      setSpecialty(specRes.data);
      const ops = (opsRes.data || [])
        .map((rel: any) => rel.master_operations)
        .filter(Boolean)
        .sort((a: MasterOperation, b: MasterOperation) => a.name.localeCompare(b.name));
      setOperations(ops);
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

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{specialty.name}</h1>
        {specialty.description && <p className="text-gray-500 mt-1">{specialty.description}</p>}
      </div>

      <div className="space-y-3">
        {operations.length === 0 ? (
          <Card>
            <p className="text-center text-gray-400">No operations in this specialty.</p>
          </Card>
        ) : (
          operations.map((op) => (
            <Card key={op.id} className="hover:border-primary-200 transition-colors cursor-pointer" onClick={() => navigate(`/admin/master-list/${specialtyId}/${op.id}`)}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{op.name}</h3>
                    {op.is_ai_generated && (
                      <Badge variant="warning" size="sm" title="AI-generated content">
                        AI
                      </Badge>
                    )}
                    {!op.approved && (
                      <Badge variant="default" size="sm" title="Pending approval">
                        Pending
                      </Badge>
                    )}
                  </div>
                  {op.description && (
                    <p className="text-sm text-gray-500 line-clamp-2">{op.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    {op.body_region && <span>Region: {op.body_region}</span>}
                  </div>
                </div>
                <div className="ml-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/admin/master-list/${specialtyId}/${op.id}`);
                    }}
                    className="p-2 text-gray-400 hover:text-primary-500 rounded-lg hover:bg-gray-50"
                    title="View details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

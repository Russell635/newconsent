import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Table } from '../../components/ui/Table';
import { Eye } from 'lucide-react';

interface SpecialtyWithCount {
  id: string;
  name: string;
  description: string | null;
  operation_count: number;
}

export function SpecialtiesPage() {
  const [specialties, setSpecialties] = useState<SpecialtyWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadSpecialties = async () => {
    const { data: specs } = await supabase
      .from('master_specialties')
      .select('id, name, description')
      .order('name');

    if (specs) {
      const withCounts = await Promise.all(
        specs.map(async (spec) => {
          const { count } = await supabase
            .from('operation_specialties')
            .select('*', { count: 'exact' })
            .eq('specialty_id', spec.id);
          return {
            ...spec,
            operation_count: count || 0,
          };
        })
      );
      setSpecialties(withCounts);
    }
    setLoading(false);
  };

  useEffect(() => { loadSpecialties(); }, []);

  const columns = [
    { key: 'name', header: 'Specialty', render: (s: SpecialtyWithCount) => (
      <span className="font-medium text-gray-900">{s.name}</span>
    )},
    { key: 'description', header: 'Description', render: (s: SpecialtyWithCount) => (
      <span className="text-sm text-gray-500">{s.description || '–'}</span>
    )},
    { key: 'operation_count', header: 'Operations', className: 'text-center', render: (s: SpecialtyWithCount) => (
      <Badge variant="info">{s.operation_count}</Badge>
    )},
    { key: 'actions', header: '', className: 'w-16 text-center', render: (s: SpecialtyWithCount) => (
      <button onClick={(e) => { e.stopPropagation(); }} className="p-1.5 text-gray-400 hover:text-primary-500 rounded">
        <Eye className="w-4 h-4" />
      </button>
    )},
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Master Operations List</h1>

      <Card padding={false}>
        <div className="p-4 border-b border-gray-200">
          <CardHeader
            title="Surgical Specialties"
            description="Click on a specialty to view its operations and complications"
          />
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <Table
            columns={columns}
            data={specialties}
            keyField="id"
            onRowClick={(s) => navigate(`/admin/master-list/${s.id}`)}
            emptyMessage="No specialties found."
          />
        )}
      </Card>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Specialty } from '../../types/database';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Table } from '../../components/ui/Table';
import { Plus, Edit2, Trash2 } from 'lucide-react';

export function SpecialtiesPage() {
  const [specialties, setSpecialties] = useState<(Specialty & { procedure_count: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const loadSpecialties = async () => {
    const { data } = await supabase
      .from('specialties')
      .select('*, master_procedures(id)')
      .order('sort_order');
    if (data) {
      setSpecialties(
        data.map((s) => ({
          ...s,
          master_procedures: undefined,
          procedure_count: (s.master_procedures as unknown as { id: string }[])?.length ?? 0,
        })) as (Specialty & { procedure_count: number })[]
      );
    }
    setLoading(false);
  };

  useEffect(() => { loadSpecialties(); }, []);

  const openNew = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setModalOpen(true);
  };

  const openEdit = (spec: Specialty) => {
    setEditingId(spec.id);
    setName(spec.name);
    setDescription(spec.description || '');
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    if (editingId) {
      await supabase.from('specialties').update({ name, description }).eq('id', editingId);
    } else {
      await supabase.from('specialties').insert({ name, description, sort_order: specialties.length + 1 });
    }
    setSaving(false);
    setModalOpen(false);
    loadSpecialties();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this specialty and all its procedures?')) return;
    await supabase.from('specialties').delete().eq('id', id);
    loadSpecialties();
  };

  const columns = [
    { key: 'name', header: 'Specialty', render: (s: Specialty & { procedure_count: number }) => (
      <span className="font-medium text-gray-900">{s.name}</span>
    )},
    { key: 'description', header: 'Description' },
    { key: 'procedure_count', header: 'Procedures', className: 'text-center' },
    { key: 'actions', header: '', className: 'w-24', render: (s: Specialty & { procedure_count: number }) => (
      <div className="flex items-center gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(s); }} className="p-1.5 text-gray-400 hover:text-primary-500 rounded">
          <Edit2 className="w-4 h-4" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }} className="p-1.5 text-gray-400 hover:text-danger-500 rounded">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    )},
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Master Procedures List</h1>

      <Card padding={false}>
        <div className="p-4 border-b border-gray-200">
          <CardHeader
            title="Specialties"
            description="Manage surgical specialties and their operations"
            action={<Button size="sm" onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Add Specialty</Button>}
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
            emptyMessage="No specialties yet. Add one to get started."
          />
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Specialty' : 'Add Specialty'}>
        <div className="space-y-4">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., General Surgery" />
          <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description" />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} disabled={!name.trim()}>Save</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { MasterProcedure } from '../../types/database';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, TextArea } from '../../components/ui/Input';
import { TagInput } from '../../components/ui/TagInput';
import { ArrowLeft } from 'lucide-react';

const COMMON_RISKS = [
  'Bleeding', 'Infection', 'DVT/PE', 'Nerve damage', 'Wound dehiscence',
  'Chronic pain', 'Scarring', 'Anaesthetic complications', 'Organ injury',
  'Seroma', 'Haematoma', 'Urinary retention', 'Ileus', 'Pneumothorax',
  'Cardiac arrest', 'Stroke', 'Death', 'Allergic reaction', 'Conversion to open surgery',
  'Need for further surgery',
];

export function OperationEditorPage() {
  const { specialtyId, procedureId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = !procedureId;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [recoveryTime, setRecoveryTime] = useState('');
  const [risks, setRisks] = useState<string[]>([]);
  const [benefits, setBenefits] = useState<string[]>([]);
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!isNew);

  useEffect(() => {
    if (!isNew && procedureId) {
      supabase.from('master_procedures').select('*').eq('id', procedureId).single().then(({ data }) => {
        if (data) {
          setName(data.name);
          setDescription(data.description);
          setDurationMinutes(data.duration_minutes?.toString() || '');
          setRecoveryTime(data.recovery_time || '');
          setRisks(data.risks);
          setBenefits(data.benefits);
          setAlternatives(data.alternatives);
        }
        setLoading(false);
      });
    }
  }, [procedureId, isNew]);

  const handleSave = async () => {
    if (!name.trim() || !specialtyId) return;
    setSaving(true);

    const payload = {
      specialty_id: specialtyId,
      name: name.trim(),
      description: description.trim(),
      duration_minutes: durationMinutes ? parseInt(durationMinutes) : null,
      recovery_time: recoveryTime || null,
      risks,
      benefits,
      alternatives,
      updated_by: user?.id || null,
    };

    if (isNew) {
      await supabase.from('master_procedures').insert(payload);
    } else {
      await supabase.from('master_procedures').update(payload).eq('id', procedureId);
    }

    setSaving(false);
    navigate(`/admin/master-list/${specialtyId}`);
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>;

  return (
    <div className="max-w-3xl">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">{isNew ? 'Add Operation' : 'Edit Operation'}</h1>

      <Card>
        <div className="space-y-5">
          <Input label="Operation Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Laparoscopic Cholecystectomy" required />
          <TextArea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the procedure..." rows={4} />

          <div className="grid grid-cols-2 gap-4">
            <Input label="Duration (minutes)" type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} placeholder="e.g., 60" />
            <Input label="Recovery Time" value={recoveryTime} onChange={(e) => setRecoveryTime(e.target.value)} placeholder="e.g., 2-4 weeks" />
          </div>

          <TagInput label="Risks & Complications" tags={risks} onChange={setRisks} suggestions={COMMON_RISKS} placeholder="Type a risk or select from suggestions" />
          <TagInput label="Benefits" tags={benefits} onChange={setBenefits} placeholder="Type a benefit and press Enter" />
          <TagInput label="Alternatives" tags={alternatives} onChange={setAlternatives} placeholder="Type an alternative and press Enter" />

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} disabled={!name.trim()}>
              {isNew ? 'Create Operation' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

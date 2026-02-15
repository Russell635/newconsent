import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, TextArea } from '../../components/ui/Input';
import { TagInput } from '../../components/ui/TagInput';
import { ArrowLeft } from 'lucide-react';

const COMMON_RISKS = [
  'Bleeding', 'Infection', 'DVT/PE', 'Nerve damage', 'Wound dehiscence',
  'Chronic pain', 'Scarring', 'Anaesthetic complications', 'Organ injury',
  'Seroma', 'Haematoma', 'Urinary retention', 'Ileus', 'Pneumothorax',
];

export function ProcedureEditorPage() {
  const { procedureId } = useParams();
  const navigate = useNavigate();
  const { surgeonProfile } = useAuth();
  const isNew = procedureId === undefined || procedureId === 'new';

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
      supabase.from('surgeon_procedures').select('*').eq('id', procedureId).single().then(({ data }) => {
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
    if (!name.trim() || !surgeonProfile) return;
    setSaving(true);

    const payload = {
      surgeon_id: surgeonProfile.id,
      name: name.trim(),
      description: description.trim(),
      duration_minutes: durationMinutes ? parseInt(durationMinutes) : null,
      recovery_time: recoveryTime || null,
      risks,
      benefits,
      alternatives,
      is_custom: true,
    };

    if (isNew) {
      await supabase.from('surgeon_procedures').insert(payload);
    } else {
      await supabase.from('surgeon_procedures').update(payload).eq('id', procedureId);
    }

    setSaving(false);
    navigate('/surgeon/procedures');
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>;

  return (
    <div className="max-w-3xl">
      <button onClick={() => navigate('/surgeon/procedures')} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to My Procedures
      </button>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">{isNew ? 'Create Custom Procedure' : 'Edit Procedure'}</h1>

      <Card>
        <div className="space-y-5">
          <Input label="Procedure Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <TextArea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Duration (minutes)" type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} />
            <Input label="Recovery Time" value={recoveryTime} onChange={(e) => setRecoveryTime(e.target.value)} />
          </div>
          <TagInput label="Risks & Complications" tags={risks} onChange={setRisks} suggestions={COMMON_RISKS} />
          <TagInput label="Benefits" tags={benefits} onChange={setBenefits} />
          <TagInput label="Alternatives" tags={alternatives} onChange={setAlternatives} />
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button variant="secondary" onClick={() => navigate('/surgeon/procedures')}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} disabled={!name.trim()}>
              {isNew ? 'Create Procedure' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

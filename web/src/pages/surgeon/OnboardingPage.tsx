import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Specialty } from '../../types/database';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ShieldCheck } from 'lucide-react';

export function OnboardingPage() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [qualifications, setQualifications] = useState('');
  const [practiceName, setPracticeName] = useState('');
  const [phone, setPhone] = useState('');
  const [specialtyId, setSpecialtyId] = useState('');
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.from('specialties').select('*').order('sort_order').then(({ data }) => {
      setSpecialties(data || []);
    });
  }, []);

  const handleComplete = async () => {
    if (!user) {
      setError('Not logged in. Please sign in again.');
      return;
    }
    setSaving(true);
    setError('');

    const payload = {
      user_id: user.id,
      full_name: fullName,
      qualifications,
      specialty_id: specialtyId || null,
      practice_name: practiceName,
      phone,
      email: user.email || '',
      onboarding_complete: true,
    };

    // Try update first (profile may already exist from a partial onboarding)
    const { data: updated, error: updateErr } = await supabase
      .from('surgeon_profiles')
      .update(payload)
      .eq('user_id', user.id)
      .select('id');

    let result;
    if (!updateErr && updated && updated.length > 0) {
      result = { error: null };
    } else {
      // No existing profile, insert new
      result = await supabase.from('surgeon_profiles').insert(payload);
    }

    if (result.error) {
      setError(`Failed to save profile: ${result.error.message} (Code: ${result.error.code})`);
      setSaving(false);
      return;
    }

    await refreshProfile();
    setSaving(false);
    navigate('/surgeon');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-2xl mb-4">
            <ShieldCheck className="w-8 h-8 text-primary-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome to ConsentMaker</h1>
          <p className="text-gray-500 mt-1">Let's set up your surgeon profile</p>
        </div>

        <Card>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          <div className="mb-4 flex items-center gap-2">
            {[1, 2].map((s) => (
              <div key={s} className={`flex-1 h-1.5 rounded-full ${s <= step ? 'bg-primary-500' : 'bg-gray-200'}`} />
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Personal Details</h2>
              <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              <Input label="Qualifications" value={qualifications} onChange={(e) => setQualifications(e.target.value)} placeholder="e.g., MBBS, FRACS" />
              <Input label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <div className="flex justify-end">
                <Button onClick={() => setStep(2)} disabled={!fullName.trim()}>Next</Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Practice Details</h2>
              <Input label="Practice Name" value={practiceName} onChange={(e) => setPracticeName(e.target.value)} placeholder="e.g., Sydney Surgical Associates" />
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Primary Specialty</label>
                <select
                  value={specialtyId}
                  onChange={(e) => setSpecialtyId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                >
                  <option value="">Select a specialty...</option>
                  {specialties.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-between">
                <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
                <Button onClick={handleComplete} loading={saving}>Complete Setup</Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

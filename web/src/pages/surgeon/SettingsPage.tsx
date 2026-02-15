import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export function SettingsPage() {
  const { surgeonProfile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(surgeonProfile?.full_name || '');
  const [qualifications, setQualifications] = useState(surgeonProfile?.qualifications || '');
  const [practiceName, setPracticeName] = useState(surgeonProfile?.practice_name || '');
  const [phone, setPhone] = useState(surgeonProfile?.phone || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!surgeonProfile) return;
    setSaving(true);
    await supabase.from('surgeon_profiles').update({
      full_name: fullName,
      qualifications,
      practice_name: practiceName,
      phone,
    }).eq('id', surgeonProfile.id);
    await refreshProfile();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      <Card>
        <CardHeader title="Profile" description="Update your surgeon profile details" />
        <div className="space-y-4">
          <Input label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <Input label="Qualifications" value={qualifications} onChange={(e) => setQualifications(e.target.value)} placeholder="e.g., MBBS, FRACS" />
          <Input label="Practice Name" value={practiceName} onChange={(e) => setPracticeName(e.target.value)} />
          <Input label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} loading={saving}>Save Changes</Button>
            {saved && <span className="text-sm text-success-600">Saved!</span>}
          </div>
        </div>
      </Card>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Patient } from '../../types/database';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Table } from '../../components/ui/Table';
import { Plus, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSurgeonContext } from '../../hooks/useSurgeonContext';
import { useStaffPermissions } from '../../hooks/useStaffPermissions';

export function PatientsPage() {
  const { user } = useAuth();
  const { surgeonId, isSurgeon } = useSurgeonContext();
  const { hasPermission } = useStaffPermissions();
  const canAddPatient = isSurgeon || hasPermission('manage_patients');
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [medicare, setMedicare] = useState('');
  const [emergName, setEmergName] = useState('');
  const [emergPhone, setEmergPhone] = useState('');
  const [emergRelation, setEmergRelation] = useState('');
  const [isMinor, setIsMinor] = useState(false);
  const [guardianName, setGuardianName] = useState('');
  const [guardianRelation, setGuardianRelation] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');

  const loadPatients = async () => {
    const { data } = await supabase.from('patients').select('*').order('last_name');
    setPatients(data || []);
    setLoading(false);
  };

  useEffect(() => { loadPatients(); }, []);

  const resetForm = () => {
    setFirstName(''); setLastName(''); setDob(''); setGender('');
    setPhone(''); setEmail(''); setAddress(''); setMedicare('');
    setEmergName(''); setEmergPhone(''); setEmergRelation('');
    setIsMinor(false); setGuardianName(''); setGuardianRelation('');
    setGuardianPhone(''); setGuardianEmail('');
  };

  const handleSave = async () => {
    if (!user || !firstName.trim() || !lastName.trim()) return;
    setSaving(true);
    await supabase.from('patients').insert({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      date_of_birth: dob || null,
      gender: gender || null,
      phone: phone || null,
      email: email || null,
      address: address || null,
      medicare_number: medicare || null,
      emergency_contact_name: emergName || null,
      emergency_contact_phone: emergPhone || null,
      emergency_contact_relationship: emergRelation || null,
      is_minor: isMinor,
      guardian_name: isMinor ? guardianName || null : null,
      guardian_relationship: isMinor ? guardianRelation || null : null,
      guardian_phone: isMinor ? guardianPhone || null : null,
      guardian_email: isMinor ? guardianEmail || null : null,
      created_by: user.id,
    });
    setSaving(false);
    setModalOpen(false);
    resetForm();
    loadPatients();
  };

  const filtered = patients.filter(
    (p) =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      p.email?.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (p: Patient) => <span className="font-medium text-gray-900">{p.first_name} {p.last_name}</span>,
    },
    {
      key: 'date_of_birth',
      header: 'DOB',
      render: (p: Patient) => p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString() : '-',
    },
    { key: 'email', header: 'Email' },
  ];

  if (!isSurgeon && !surgeonId) {
    return <div className="p-8 text-center text-gray-400">Select a surgeon to view patients.</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
        {canAddPatient && <Button size="sm" onClick={() => setModalOpen(true)}><Plus className="w-4 h-4 mr-1" /> Add Patient</Button>}
      </div>

      <Card padding={false}>
        <div className="p-4 border-b border-gray-200">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patients..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <Table columns={columns} data={filtered} keyField="id" onRowClick={(p) => navigate(`/surgeon/patients/${p.id}`)} emptyMessage="No patients yet" />
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Patient">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name *" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            <Input label="Last Name *" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Date of Birth" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300">
                <option value="">Select...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
          <Input label="Medicare Number" value={medicare} onChange={(e) => setMedicare(e.target.value)} />

          <h4 className="text-sm font-semibold text-gray-700 pt-2">Emergency Contact</h4>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Name" value={emergName} onChange={(e) => setEmergName(e.target.value)} />
            <Input label="Relationship" value={emergRelation} onChange={(e) => setEmergRelation(e.target.value)} />
          </div>
          <Input label="Phone" value={emergPhone} onChange={(e) => setEmergPhone(e.target.value)} />

          <div className="flex items-center gap-2 pt-2">
            <input type="checkbox" id="isMinor" checked={isMinor} onChange={(e) => setIsMinor(e.target.checked)} className="rounded border-gray-300" />
            <label htmlFor="isMinor" className="text-sm font-medium text-gray-700">Patient is a minor</label>
          </div>

          {isMinor && (
            <>
              <h4 className="text-sm font-semibold text-gray-700">Guardian Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Guardian Name" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} />
                <Input label="Relationship" value={guardianRelation} onChange={(e) => setGuardianRelation(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Guardian Phone" value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} />
                <Input label="Guardian Email" type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} />
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} disabled={!firstName.trim() || !lastName.trim()}>Add Patient</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

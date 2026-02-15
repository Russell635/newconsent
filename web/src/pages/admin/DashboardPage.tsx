import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { StatCard } from '../../components/ui/Card';
import { Database, Users, Stethoscope, FileCheck } from 'lucide-react';

export function AdminDashboardPage() {
  const [stats, setStats] = useState({ specialties: 0, procedures: 0, surgeons: 0, consents: 0 });

  useEffect(() => {
    async function load() {
      const [specRes, procRes, surgRes, consentRes] = await Promise.all([
        supabase.from('specialties').select('id', { count: 'exact', head: true }),
        supabase.from('master_procedures').select('id', { count: 'exact', head: true }),
        supabase.from('surgeon_profiles').select('id', { count: 'exact', head: true }),
        supabase.from('patient_consents').select('id', { count: 'exact', head: true }),
      ]);
      setStats({
        specialties: specRes.count ?? 0,
        procedures: procRes.count ?? 0,
        surgeons: surgRes.count ?? 0,
        consents: consentRes.count ?? 0,
      });
    }
    load();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Specialties" value={stats.specialties} icon={<Stethoscope className="w-6 h-6" />} />
        <StatCard title="Master Procedures" value={stats.procedures} icon={<Database className="w-6 h-6" />} />
        <StatCard title="Registered Surgeons" value={stats.surgeons} icon={<Users className="w-6 h-6" />} />
        <StatCard title="Total Consents" value={stats.consents} icon={<FileCheck className="w-6 h-6" />} />
      </div>
    </div>
  );
}

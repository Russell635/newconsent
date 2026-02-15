import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { StatCard, Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ClipboardList, Users2, FileCheck, AlertCircle } from 'lucide-react';

export function SurgeonDashboardPage() {
  const { surgeonProfile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ procedures: 0, patients: 0, pendingConsents: 0, completedConsents: 0 });
  const [notifications, setNotifications] = useState<{ id: string; title: string; message: string; created_at: string }[]>([]);

  useEffect(() => {
    if (!surgeonProfile) return;
    async function load() {
      const [procRes, patientRes, pendingRes, completedRes, notifRes] = await Promise.all([
        supabase.from('surgeon_procedures').select('id').eq('surgeon_id', surgeonProfile!.id),
        supabase.from('patients').select('id'),
        supabase.from('patient_consents').select('id').eq('surgeon_id', surgeonProfile!.id).in('status', ['assigned', 'in_progress', 'not_started']),
        supabase.from('patient_consents').select('id').eq('surgeon_id', surgeonProfile!.id).in('status', ['completed', 'valid', 'patient_completed']),
        supabase.from('notifications').select('id, title, message, created_at').eq('read', false).order('created_at', { ascending: false }).limit(5),
      ]);
      setStats({
        procedures: procRes.data?.length ?? 0,
        patients: patientRes.data?.length ?? 0,
        pendingConsents: pendingRes.data?.length ?? 0,
        completedConsents: completedRes.data?.length ?? 0,
      });
      setNotifications(notifRes.data || []);
    }
    load();
  }, [surgeonProfile]);

  if (surgeonProfile === null) {
    // Profile hasn't loaded yet or doesn't exist — wait or redirect
    return (
      <div className="p-8 text-center text-gray-400">
        Loading surgeon profile...
        <button onClick={() => navigate('/surgeon/onboarding')} className="block mx-auto mt-4 text-sm text-primary-500 hover:underline">
          Complete onboarding if this doesn't load
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="My Procedures" value={stats.procedures} icon={<ClipboardList className="w-6 h-6" />} />
        <StatCard title="Patients" value={stats.patients} icon={<Users2 className="w-6 h-6" />} />
        <StatCard title="Pending Consents" value={stats.pendingConsents} icon={<AlertCircle className="w-6 h-6" />} />
        <StatCard title="Completed Consents" value={stats.completedConsents} icon={<FileCheck className="w-6 h-6" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
          <div className="space-y-2">
            <Button variant="secondary" className="w-full justify-start" onClick={() => navigate('/surgeon/procedures')}>
              <ClipboardList className="w-4 h-4 mr-2" /> Manage Procedures
            </Button>
            <Button variant="secondary" className="w-full justify-start" onClick={() => navigate('/surgeon/patients')}>
              <Users2 className="w-4 h-4 mr-2" /> Manage Patients
            </Button>
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold text-gray-900 mb-3">Notifications</h3>
          {notifications.length === 0 ? (
            <p className="text-sm text-gray-400">No new notifications</p>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => (
                <div key={n.id} className="p-2 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700">{n.title}</p>
                  <p className="text-xs text-gray-400">{n.message}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

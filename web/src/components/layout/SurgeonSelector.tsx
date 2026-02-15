import { useAuth } from '../../contexts/AuthContext';
import { ChevronDown } from 'lucide-react';

export function SurgeonSelector() {
  const { staffAssignments, activeSurgeonId, setActiveSurgeonId } = useAuth();

  const acceptedAssignments = staffAssignments.filter(
    (a) => a.invitation_status === 'accepted' && a.is_active
  );

  if (acceptedAssignments.length === 0) return null;

  const activeSurgeon = acceptedAssignments.find((a) => a.surgeon_id === activeSurgeonId);

  return (
    <div className="relative">
      <select
        value={activeSurgeonId ?? ''}
        onChange={(e) => setActiveSurgeonId(e.target.value || null)}
        className="appearance-none bg-gray-50 border border-gray-300 rounded-lg pl-3 pr-8 py-1.5 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-300 cursor-pointer"
      >
        {acceptedAssignments.length > 1 && (
          <option value="">All Surgeons</option>
        )}
        {acceptedAssignments.map((a) => (
          <option key={a.surgeon_id} value={a.surgeon_id}>
            {a.surgeon_profile?.full_name || 'Unknown Surgeon'}
            {a.surgeon_profile?.practice_name ? ` — ${a.surgeon_profile.practice_name}` : ''}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  );
}

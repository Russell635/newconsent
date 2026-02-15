import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '../../contexts/AuthContext';
import { useStaffPermissions } from '../../hooks/useStaffPermissions';
import { LayoutDashboard, FileText, Users2, UserCog, MapPin, Mail, MessageSquare } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export function StaffLayout() {
  const { profile, activeSurgeonId, staffAssignments } = useAuth();
  const { hasPermission, hasAnyPermission } = useStaffPermissions();
  const isManager = profile?.role === 'manager';

  const acceptedCount = staffAssignments.filter(
    (a) => a.invitation_status === 'accepted' && a.is_active
  ).length;

  // Build nav items based on role and permissions
  const navItems: NavItem[] = [
    { to: '/staff', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/staff/invitations', label: 'Invitations', icon: Mail },
    { to: '/staff/messages', label: 'Messages', icon: MessageSquare },
  ];

  // Only show surgeon-specific items when a surgeon is selected
  if (activeSurgeonId || acceptedCount <= 1) {
    if (isManager && hasPermission('manage_patients')) {
      navItems.push({ to: '/staff/patients', label: 'Patients', icon: Users2 });
    }

    if (hasAnyPermission(['view_consents', 'handle_consent_sections', 'validate_consent'])) {
      navItems.push({ to: '/staff/consents', label: 'Consents', icon: FileText });
    }

    if (isManager && hasPermission('manage_staff')) {
      navItems.push({ to: '/staff/staff-management', label: 'Staff Management', icon: UserCog });
    }

    if (isManager && hasPermission('manage_locations')) {
      navItems.push({ to: '/staff/locations', label: 'Locations', icon: MapPin });
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar items={navItems} title="Staff Portal" />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6 bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

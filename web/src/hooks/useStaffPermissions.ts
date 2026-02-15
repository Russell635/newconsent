import { useAuth } from '../contexts/AuthContext';
import type { StaffPermission } from '../types/database';

export function useStaffPermissions() {
  const { profile, activePermissions } = useAuth();

  const hasPermission = (permission: StaffPermission): boolean => {
    if (profile?.role === 'admin' || profile?.role === 'surgeon') return true;
    return activePermissions.includes(permission);
  };

  const hasAnyPermission = (permissions: StaffPermission[]): boolean => {
    if (profile?.role === 'admin' || profile?.role === 'surgeon') return true;
    return permissions.some((p) => activePermissions.includes(p));
  };

  return { hasPermission, hasAnyPermission };
}

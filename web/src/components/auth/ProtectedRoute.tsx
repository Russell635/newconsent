import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { UserRole } from '../../types/database';
import { Loader2 } from 'lucide-react';

const roleRedirectMap: Record<UserRole, string> = {
  admin: '/admin',
  surgeon: '/surgeon',
  manager: '/staff',
  nurse: '/staff',
};

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole | UserRole[];
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && profile?.role) {
    const allowed = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!allowed.includes(profile.role)) {
      const redirectTo = roleRedirectMap[profile.role] || '/';
      return <Navigate to={redirectTo} replace />;
    }
  }

  return <>{children}</>;
}

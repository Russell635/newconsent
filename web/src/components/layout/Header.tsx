import { useAuth } from '../../contexts/AuthContext';
import { SurgeonSelector } from './SurgeonSelector';
import { NotificationsDropdown } from './NotificationsDropdown';
import { LogOut, User } from 'lucide-react';

export function Header() {
  const { profile, signOut } = useAuth();
  const isStaff = profile?.role === 'manager' || profile?.role === 'nurse';

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 print:hidden">
      <div className="flex items-center gap-3">
        {isStaff && <SurgeonSelector />}
      </div>
      <div className="flex items-center gap-4">
        <NotificationsDropdown />
        <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
          <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-primary-600" />
          </div>
          <div className="text-sm">
            <p className="font-medium text-gray-700">{profile?.full_name}</p>
            <p className="text-xs text-gray-400 capitalize">{profile?.role}</p>
          </div>
          <button onClick={signOut} className="p-2 text-gray-400 hover:text-danger-500 rounded-lg hover:bg-gray-100" title="Sign out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

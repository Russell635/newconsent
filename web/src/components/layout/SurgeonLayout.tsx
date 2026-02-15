import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { LayoutDashboard, FileText, ClipboardList, Users2, QrCode, Settings, Users, MessageSquare } from 'lucide-react';

const navItems = [
  { to: '/surgeon', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/surgeon/procedures', label: 'My Procedures', icon: ClipboardList },
  { to: '/surgeon/patients', label: 'Patients', icon: Users2 },
  { to: '/surgeon/consents', label: 'Consents', icon: FileText },
  { to: '/surgeon/qr-pages', label: 'QR Form Pages', icon: QrCode },
  { to: '/surgeon/staff', label: 'Staff', icon: Users },
  { to: '/surgeon/messages', label: 'Messages', icon: MessageSquare },
  { to: '/surgeon/settings', label: 'Settings', icon: Settings },
];

export function SurgeonLayout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar items={navItems} title="Surgeon Portal" />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6 bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

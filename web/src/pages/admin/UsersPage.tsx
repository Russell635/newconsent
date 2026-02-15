import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { UserProfile } from '../../types/database';
import { Card, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Table } from '../../components/ui/Table';
import { Input } from '../../components/ui/Input';
import { Search } from 'lucide-react';

export function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('user_profiles').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setUsers(data || []);
      setLoading(false);
    });
  }, []);

  const filtered = users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      key: 'full_name',
      header: 'Name',
      render: (u: UserProfile) => <span className="font-medium text-gray-900">{u.full_name}</span>,
    },
    { key: 'email', header: 'Email' },
    {
      key: 'role',
      header: 'Role',
      render: (u: UserProfile) => (
        <Badge variant={u.role === 'admin' ? 'info' : 'default'}>{u.role}</Badge>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (u: UserProfile) => (
        <Badge variant={u.is_active ? 'success' : 'danger'}>{u.is_active ? 'Active' : 'Inactive'}</Badge>
      ),
    },
    {
      key: 'created_at',
      header: 'Joined',
      render: (u: UserProfile) => new Date(u.created_at).toLocaleDateString(),
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">User Management</h1>
      <Card padding={false}>
        <div className="p-4 border-b border-gray-200">
          <CardHeader title="All Users" description="Manage surgeons and administrators" />
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <Table columns={columns} data={filtered} keyField="id" emptyMessage="No users found" />
        )}
      </Card>
    </div>
  );
}

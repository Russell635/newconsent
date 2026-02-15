import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Notification } from '../../types/database';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import {
  Inbox, Send, Mail, Trash2, CheckCheck, UserCheck, UserX,
  Shield, AlertTriangle, FileText, Bell, X, Check,
} from 'lucide-react';

type Filter = 'all' | 'received' | 'sent';

const TYPE_ICONS: Record<string, typeof Bell> = {
  staff_invitation: Mail,
  invitation_accepted: UserCheck,
  invitation_declined: UserX,
  permission_change: Shield,
  access_revoked: AlertTriangle,
  consent_completed: FileText,
};

const TYPE_COLORS: Record<string, string> = {
  staff_invitation: 'bg-blue-100 text-blue-600',
  invitation_accepted: 'bg-green-100 text-green-600',
  invitation_declined: 'bg-red-100 text-red-600',
  permission_change: 'bg-amber-100 text-amber-600',
  access_revoked: 'bg-red-100 text-red-600',
  consent_completed: 'bg-green-100 text-green-600',
};

export function MessagesPage() {
  const { user, profile, refreshAssignments } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actioning, setActioning] = useState<string | null>(null);

  const loadNotifications = async () => {
    if (!user) return;
    setLoading(true);

    let query = supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter === 'received') {
      query = query.eq('user_id', user.id);
    } else if (filter === 'sent') {
      query = query.eq('sender_id', user.id);
    } else {
      query = query.or(`user_id.eq.${user.id},sender_id.eq.${user.id}`);
    }

    const { data, error } = await query.limit(100);
    if (error) {
      console.error('Failed to load notifications:', error.message);
      setLoading(false);
      return;
    }

    const rows = (data || []) as Notification[];

    // Fetch sender profiles
    const senderIds = [...new Set(rows.filter((r) => r.sender_id).map((r) => r.sender_id!))];
    if (senderIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('user_id, full_name, email, role')
        .in('user_id', senderIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      for (const row of rows) {
        if (row.sender_id) {
          row.sender_profile = profileMap.get(row.sender_id) || undefined;
        }
      }
    }

    setNotifications(rows);
    setLoading(false);
  };

  useEffect(() => {
    loadNotifications();
    setSelected(new Set());
  }, [user, filter]);

  const isSent = (n: Notification) => n.sender_id === user?.id && n.user_id !== user?.id;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === notifications.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(notifications.map((n) => n.id)));
    }
  };

  const markSelectedRead = async () => {
    if (!user) return;
    const ids = [...selected].filter((id) => {
      const n = notifications.find((n) => n.id === id);
      return n && n.user_id === user.id && !n.read;
    });
    if (ids.length === 0) return;

    for (const id of ids) {
      await supabase.from('notifications').update({ read: true }).eq('id', id);
    }
    setNotifications((prev) => prev.map((n) => ids.includes(n.id) ? { ...n, read: true } : n));
    setSelected(new Set());
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} message${selected.size > 1 ? 's' : ''}?`)) return;

    // Can only delete messages where user_id = current user (RLS)
    const ownIds = [...selected].filter((id) => {
      const n = notifications.find((n) => n.id === id);
      return n && n.user_id === user?.id;
    });

    for (const id of ownIds) {
      await supabase.from('notifications').delete().eq('id', id);
    }
    setNotifications((prev) => prev.filter((n) => !ownIds.includes(n.id)));
    setSelected(new Set());
  };

  const clearAll = async () => {
    if (!user) return;
    if (!confirm('Delete all your received messages?')) return;
    await supabase.from('notifications').delete().eq('user_id', user.id);
    loadNotifications();
  };

  const handleAcceptInvitation = async (notification: Notification) => {
    if (!user || !notification.action_data) return;
    setActioning(notification.id);
    const surgeonId = notification.action_data.surgeon_id as string;

    // Find and accept the matching staff assignment
    const { data: assignment } = await supabase
      .from('staff_assignments')
      .select('id, invited_by')
      .eq('staff_user_id', user.id)
      .eq('surgeon_id', surgeonId)
      .eq('invitation_status', 'pending')
      .single();

    if (assignment) {
      await supabase
        .from('staff_assignments')
        .update({
          invitation_status: 'accepted',
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', assignment.id);
    }

    // Mark notification as actioned
    await supabase
      .from('notifications')
      .update({ action_taken: true, action_taken_at: new Date().toISOString(), read: true })
      .eq('id', notification.id);

    // Notify the inviter (use sender_id from notification, or invited_by from assignment)
    const notifyUserId = notification.sender_id || assignment?.invited_by;
    if (notifyUserId) {
      await supabase.from('notifications').insert({
        user_id: notifyUserId,
        sender_id: user.id,
        type: 'invitation_accepted',
        title: 'Invitation Accepted',
        message: `${profile?.full_name} has accepted your staff invitation.`,
        data: notification.action_data,
        read: false,
        action_type: null,
        action_data: null,
        action_taken: false,
      });
    }

    await refreshAssignments();
    setActioning(null);
    loadNotifications();
  };

  const handleDeclineInvitation = async (notification: Notification) => {
    if (!user || !notification.action_data) return;
    setActioning(notification.id);
    const surgeonId = notification.action_data.surgeon_id as string;

    // Find and decline the matching staff assignment
    const { data: assignment } = await supabase
      .from('staff_assignments')
      .select('id, invited_by')
      .eq('staff_user_id', user.id)
      .eq('surgeon_id', surgeonId)
      .eq('invitation_status', 'pending')
      .single();

    if (assignment) {
      await supabase
        .from('staff_assignments')
        .update({
          invitation_status: 'declined',
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', assignment.id);
    }

    // Mark notification as actioned
    await supabase
      .from('notifications')
      .update({ action_taken: true, action_taken_at: new Date().toISOString(), read: true })
      .eq('id', notification.id);

    // Notify the inviter (use sender_id from notification, or invited_by from assignment)
    const notifyUserId = notification.sender_id || assignment?.invited_by;
    if (notifyUserId) {
      await supabase.from('notifications').insert({
        user_id: notifyUserId,
        sender_id: user.id,
        type: 'invitation_declined',
        title: 'Invitation Declined',
        message: `${profile?.full_name} has declined your staff invitation.`,
        data: notification.action_data,
        read: false,
        action_type: null,
        action_data: null,
        action_taken: false,
      });
    }

    await refreshAssignments();
    setActioning(null);
    loadNotifications();
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const filterTabs: { key: Filter; label: string; icon: typeof Inbox }[] = [
    { key: 'all', label: 'All', icon: Mail },
    { key: 'received', label: 'Received', icon: Inbox },
    { key: 'sent', label: 'Sent', icon: Send },
  ];

  const unreadCount = notifications.filter((n) => n.user_id === user?.id && !n.read).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500 mt-1">{unreadCount} unread</p>
          )}
        </div>
        <Button size="sm" variant="secondary" onClick={clearAll}>
          <Trash2 className="w-4 h-4 mr-1" /> Clear All
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              filter === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      {notifications.length > 0 && (
        <div className="flex items-center gap-3 mb-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.size === notifications.length && notifications.length > 0}
              onChange={selectAll}
              className="rounded border-gray-300 text-primary-500 focus:ring-primary-300"
            />
            <span className="text-sm text-gray-500">
              {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
            </span>
          </label>
          {selected.size > 0 && (
            <>
              <Button size="sm" variant="ghost" onClick={markSelectedRead}>
                <CheckCheck className="w-4 h-4 mr-1" /> Mark Read
              </Button>
              <Button size="sm" variant="ghost" onClick={deleteSelected} className="text-danger-500 hover:text-danger-700">
                <Trash2 className="w-4 h-4 mr-1" /> Delete
              </Button>
            </>
          )}
        </div>
      )}

      {/* Message list */}
      <Card padding={false}>
        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No messages</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((n) => {
              const sent = isSent(n);
              const Icon = TYPE_ICONS[n.type] || Bell;
              const iconColor = TYPE_COLORS[n.type] || 'bg-gray-100 text-gray-500';

              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                    !n.read && !sent ? 'bg-primary-50/30' : 'hover:bg-gray-50'
                  }`}
                >
                  {/* Checkbox */}
                  <div className="pt-1">
                    <input
                      type="checkbox"
                      checked={selected.has(n.id)}
                      onChange={() => toggleSelect(n.id)}
                      className="rounded border-gray-300 text-primary-500 focus:ring-primary-300"
                    />
                  </div>

                  {/* Direction indicator */}
                  <div className="pt-1">
                    {sent ? (
                      <Send className="w-4 h-4 text-gray-400" />
                    ) : (
                      <Inbox className="w-4 h-4 text-primary-400" />
                    )}
                  </div>

                  {/* Type icon */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${iconColor}`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className={`text-sm ${!n.read && !sent ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                          {n.title}
                        </p>
                        {sent && n.user_id !== user?.id && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            To: {(n as any).recipient_name || 'Staff member'}
                          </p>
                        )}
                        {!sent && n.sender_profile && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            From: {n.sender_profile.full_name}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-gray-400 whitespace-nowrap">{formatTime(n.created_at)}</span>
                        {!n.read && !sent && (
                          <span className="w-2 h-2 bg-primary-500 rounded-full" />
                        )}
                        {sent && (
                          <Badge variant="default">Sent</Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                    {n.action_type === 'accept_invitation' && !n.action_taken && !sent && (
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleAcceptInvitation(n); }}
                          loading={actioning === n.id}
                          disabled={actioning !== null}
                        >
                          <Check className="w-3.5 h-3.5 mr-1" /> Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => { e.stopPropagation(); handleDeclineInvitation(n); }}
                          loading={actioning === n.id}
                          disabled={actioning !== null}
                        >
                          <X className="w-3.5 h-3.5 mr-1" /> Decline
                        </Button>
                      </div>
                    )}
                    {n.action_type && !n.action_taken && n.action_type !== 'accept_invitation' && !sent && (
                      <div className="mt-1">
                        <Badge variant="warning">Action required</Badge>
                      </div>
                    )}
                    {n.action_taken && (
                      <div className="mt-1">
                        <Badge variant="success">Actioned</Badge>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Session, User } from '@supabase/supabase-js';
import type { UserProfile, SurgeonProfile, StaffAssignment, StaffPermission, UserRole } from '../types/database';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  surgeonProfile: SurgeonProfile | null;
  staffAssignments: StaffAssignment[];
  activeSurgeonId: string | null;
  setActiveSurgeonId: (id: string | null) => void;
  activePermissions: StaffPermission[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, role: UserRole) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshAssignments: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [surgeonProfile, setSurgeonProfile] = useState<SurgeonProfile | null>(null);
  const [staffAssignments, setStaffAssignments] = useState<StaffAssignment[]>([]);
  const [activeSurgeonId, setActiveSurgeonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const activePermissions: StaffPermission[] =
    profile?.role === 'surgeon' || profile?.role === 'admin'
      ? [] // surgeons/admins have full access, checked separately
      : activeSurgeonId
        ? (staffAssignments.find(
            (a) => a.surgeon_id === activeSurgeonId && a.invitation_status === 'accepted' && a.is_active
          )?.permissions ?? [])
        : [];

  const fetchStaffAssignments = async (userId: string) => {
    const { data, error } = await supabase
      .from('staff_assignments')
      .select('*')
      .eq('staff_user_id', userId)
      .eq('is_active', true);

    if (error) {
      console.error('Failed to fetch staff assignments:', error.message);
      return;
    }

    const rows = data || [];

    // Fetch surgeon profiles for each assignment
    const surgeonIds = [...new Set(rows.map((r: any) => r.surgeon_id))];
    if (surgeonIds.length > 0) {
      const { data: profiles } = await supabase
        .from('surgeon_profiles')
        .select('id, user_id, full_name, practice_name, email, specialty_id')
        .in('id', surgeonIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      for (const row of rows) {
        (row as any).surgeon_profile = profileMap.get((row as any).surgeon_id) || null;
      }
    }

    const assignments = rows as StaffAssignment[];
    setStaffAssignments(assignments);

    // Auto-select surgeon if only one accepted assignment
    const accepted = assignments.filter((a) => a.invitation_status === 'accepted');
    if (accepted.length === 1) {
      setActiveSurgeonId(accepted[0].surgeon_id);
    }
  };

  const fetchProfile = async (userId: string) => {
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    setProfile(userProfile);

    if (userProfile?.role === 'surgeon') {
      const { data: surgProf } = await supabase
        .from('surgeon_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();
      setSurgeonProfile(surgProf);
    }

    if (userProfile?.role === 'manager' || userProfile?.role === 'nurse') {
      await fetchStaffAssignments(userId);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id);
      } else {
        setProfile(null);
        setSurgeonProfile(null);
        setStaffAssignments([]);
        setActiveSurgeonId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string, role: UserRole) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSurgeonProfile(null);
    setStaffAssignments([]);
    setActiveSurgeonId(null);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const refreshAssignments = async () => {
    if (user) await fetchStaffAssignments(user.id);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        surgeonProfile,
        staffAssignments,
        activeSurgeonId,
        setActiveSurgeonId,
        activePermissions,
        loading,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        refreshAssignments,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

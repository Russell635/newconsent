import { useAuth } from '../contexts/AuthContext';

export function useSurgeonContext() {
  const { profile, surgeonProfile, activeSurgeonId } = useAuth();

  const isSurgeon = profile?.role === 'surgeon';
  const surgeonId = isSurgeon ? surgeonProfile?.id ?? null : activeSurgeonId;

  return { surgeonId, isSurgeon };
}

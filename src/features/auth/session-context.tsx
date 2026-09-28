import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { getSupabase } from '@/lib/supabase';

type SessionContextValue = {
  session: Session | null;
  isLoading: boolean;
  /** true si EXPO_PUBLIC_SUPABASE_URL / ANON_KEY sont absents (voir .env.example) */
  configError: boolean;
};

const SessionContext = createContext<SessionContextValue>({
  session: null,
  isLoading: true,
  configError: false,
});

function isSupabaseConfigured(): boolean {
  try {
    getSupabase();
    return true;
  } catch {
    return false;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [configured] = useState(isSupabaseConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(configured);

  useEffect(() => {
    if (!configured) return;

    const supabase = getSupabase();

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, [configured]);

  return (
    <SessionContext.Provider value={{ session, isLoading, configError: !configured }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}

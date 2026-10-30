'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/domain';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const PROFILE_COLUMNS = 'id, account_type, full_name, governorate, status';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ session: Session | null; profile: Profile | null; loading: boolean }>({
    session: null,
    profile: null,
    loading: true,
  });

  useEffect(() => {
    let active = true;

    const apply = (session: Session | null) => {
      (async () => {
        let profile: Profile | null = null;
        if (session) {
          const { data } = await supabase
            .from('profiles')
            .select(PROFILE_COLUMNS)
            .eq('id', session.user.id)
            .maybeSingle();
          profile = (data as Profile | null) ?? null;
        }
        if (active) setState({ session, profile, loading: false });
      })();
    };

    supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => apply(session));

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ ...state, signOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

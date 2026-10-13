import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { markSessionLost } from '../lib/session-notice';
import type { Profile, UserRole } from '../types/database';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  /* True until the session AND the role are both known. Routes wait on
     this, so a caller never gets a flash of the admin shell while their
     profile is still in flight. */
  loading: boolean;
  /* null = signed out, or signed in with no profile row (no access). */
  role: UserRole | null;
  profile: Profile | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  /* True while WE are signing out, so that is not mistaken for a session being lost. */
  const signingOut = useRef(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  /* Which user the current `profile` belongs to. Compared with user.id
     to derive "role still loading" without a setState-in-effect. */
  const [profileFor, setProfileFor] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setSessionLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' && !signingOut.current) markSessionLost();
      signingOut.current = false;
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  /* Keyed on the user id, not the session object: a token refresh hands
     us a new session for the same person and must not refetch the role. */
  const userId = user?.id ?? null;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setProfile((data as Profile | null) ?? null);
        setProfileFor(userId);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const roleLoading = userId !== null && profileFor !== userId;
  const loading = sessionLoading || roleLoading;
  const activeProfile = userId !== null && profileFor === userId ? profile : null;
  const role: UserRole | null = activeProfile?.active ? activeProfile.role : null;

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  /* 'local' = this browser only. The default signs the account out of
     EVERY device, so one person leaving a tab would end everybody else's
     session on the same login — mid-call, in the rep's case. */
  const signOut = async () => {
    signingOut.current = true;
    await supabase.auth.signOut({ scope: 'local' });
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, role, profile: activeProfile, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

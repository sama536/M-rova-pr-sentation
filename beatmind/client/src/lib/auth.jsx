import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, isDemo } from './supabase.js';

const AuthCtx = createContext(null);
const DEMO_KEY = 'bm_demo_session';
const DEMO_USERS = 'bm_demo_users';

const readJSON = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

function profileFromAuth(u) {
  if (!u) return null;
  const meta = u.user_metadata || {};
  return {
    id: u.id,
    email: u.email,
    display_name: meta.full_name || meta.name || u.email?.split('@')[0],
    avatar_url: meta.avatar_url || null,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemo) {
      setUser(readJSON(DEMO_KEY, null));
      setLoading(false);
      return undefined;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(profileFromAuth(data.session?.user));
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(profileFromAuth(s?.user));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email, password) => {
    if (isDemo) {
      const users = readJSON(DEMO_USERS, {});
      const existing = users[email.toLowerCase()];
      if (!existing) throw new Error('Aucun compte avec cet email (mode démo). Crée un compte.');
      if (existing.password !== password) throw new Error('Mot de passe incorrect.');
      localStorage.setItem(DEMO_KEY, JSON.stringify(existing.profile));
      setUser(existing.profile);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const signUp = useCallback(async (email, password, displayName) => {
    if (isDemo) {
      const users = readJSON(DEMO_USERS, {});
      const key = email.toLowerCase();
      if (users[key]) throw new Error('Un compte existe déjà avec cet email.');
      const profile = {
        id: `demo-${Math.random().toString(36).slice(2, 10)}`,
        email: key,
        display_name: displayName || key.split('@')[0],
        username: key.split('@')[0].replace(/[^a-z0-9_]/g, ''),
        avatar_url: null,
      };
      users[key] = { password, profile };
      localStorage.setItem(DEMO_USERS, JSON.stringify(users));
      localStorage.setItem(DEMO_KEY, JSON.stringify(profile));
      setUser(profile);
      return { needsConfirmation: false };
    }
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: displayName }, emailRedirectTo: `${window.location.origin}/beat` },
    });
    if (error) throw new Error(error.message);
    return { needsConfirmation: !data.session };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (isDemo) throw new Error('Google nécessite Supabase : configure VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.');
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/beat` } });
    if (error) throw new Error(error.message);
  }, []);

  const signOut = useCallback(async () => {
    if (isDemo) {
      localStorage.removeItem(DEMO_KEY);
      setUser(null);
      return;
    }
    await supabase.auth.signOut();
  }, []);

  const updateLocalProfile = useCallback((patch) => {
    setUser((u) => {
      const next = { ...u, ...patch };
      if (isDemo) {
        localStorage.setItem(DEMO_KEY, JSON.stringify(next));
        const users = readJSON(DEMO_USERS, {});
        if (users[next.email]) { users[next.email].profile = next; localStorage.setItem(DEMO_USERS, JSON.stringify(users)); }
      }
      return next;
    });
  }, []);

  return (
    <AuthCtx.Provider value={{ user, session, loading, isDemo, signIn, signUp, signInWithGoogle, signOut, updateLocalProfile }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);

export async function getAccessToken() {
  if (isDemo) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

export function getDemoUserId() {
  return readJSON(DEMO_KEY, null)?.id || 'demo';
}

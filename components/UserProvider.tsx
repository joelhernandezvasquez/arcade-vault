"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export interface User {
  id: string;
  email: string;
  alias: string;
}

interface UserContextValue {
  user: User | null;
  cargando: boolean;
  signOut: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    try {
      localStorage.removeItem("av_user");
    } catch {
      // ignore storage failures
    }

    const supabase = createClient();
    let active = true;

    async function applySession(session: Session | null) {
      if (!session) {
        if (active) {
          setUser(null);
          setCargando(false);
        }
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("alias")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!active) return;
      // Sesión sin perfil: alias vacío (la SPEC 15 añade /auth/alias).
      setUser({
        id: session.user.id,
        email: session.user.email ?? "",
        alias: data?.alias ?? "",
      });
      setCargando(false);
    }

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      // Diferido: no se debe esperar a Supabase dentro de este callback.
      setTimeout(() => void applySession(session), 0);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await createClient().auth.signOut();
    setUser(null);
  };

  return (
    <UserContext.Provider value={{ user, cargando, signOut }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}

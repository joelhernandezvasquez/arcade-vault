"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
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
  /** Sesión válida sin fila en `profiles`: debe elegir alias en /auth/alias. */
  sinAlias: boolean;
  /** Vuelve a leer el perfil de la sesión actual (tras crear el alias). */
  recargarPerfil: () => Promise<void>;
  signOut: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [cargando, setCargando] = useState(true);
  const activeRef = useRef(true);

  const applySession = useCallback(async (session: Session | null) => {
    if (!session) {
      if (activeRef.current) {
        setUser(null);
        setCargando(false);
      }
      return;
    }

    const { data } = await createClient()
      .from("profiles")
      .select("alias")
      .eq("id", session.user.id)
      .maybeSingle();

    if (!activeRef.current) return;
    // Sesión sin perfil: alias vacío (se resuelve en /auth/alias).
    setUser({
      id: session.user.id,
      email: session.user.email ?? "",
      alias: data?.alias ?? "",
    });
    setCargando(false);
  }, []);

  useEffect(() => {
    try {
      localStorage.removeItem("av_user");
    } catch {
      // ignore storage failures
    }

    activeRef.current = true;
    const supabase = createClient();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      // Diferido: no se debe esperar a Supabase dentro de este callback.
      setTimeout(() => void applySession(session), 0);
    });

    return () => {
      activeRef.current = false;
      data.subscription.unsubscribe();
    };
  }, [applySession]);

  const sinAlias = user !== null && user.alias === "";

  useEffect(() => {
    // /auth lo resuelve su propia página para conservar su ?next.
    if (!sinAlias || pathname === "/auth/alias" || pathname === "/auth") return;
    router.replace(`/auth/alias?next=${encodeURIComponent(pathname)}`);
  }, [sinAlias, pathname, router]);

  const recargarPerfil = useCallback(async () => {
    const { data } = await createClient().auth.getSession();
    await applySession(data.session);
  }, [applySession]);

  const signOut = async () => {
    await createClient().auth.signOut();
    setUser(null);
  };

  return (
    <UserContext.Provider
      value={{ user, cargando, sinAlias, recargarPerfil, signOut }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}

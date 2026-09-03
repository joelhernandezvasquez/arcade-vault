"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface User {
  name: string;
}

interface UserContextValue {
  user: User | null;
  login: (user: User | null) => void;
  signOut: () => void;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Reads the persisted session from localStorage on mount; this is a real
    // external-system read (browser storage, unavailable during SSR), not
    // derivable render-time state.
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUser(JSON.parse(localStorage.getItem("av_user") || "null"));
    } catch {
      setUser(null);
    }
  }, []);

  const login = (u: User | null) => {
    setUser(u);
    try {
      if (u) localStorage.setItem("av_user", JSON.stringify(u));
      else localStorage.removeItem("av_user");
    } catch {
      // ignore storage failures
    }
  };

  const signOut = () => {
    setUser(null);
    try {
      localStorage.removeItem("av_user");
    } catch {
      // ignore storage failures
    }
  };

  return <UserContext.Provider value={{ user, login, signOut }}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within UserProvider");
  return ctx;
}

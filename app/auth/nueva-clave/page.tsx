"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/UserProvider";
import { changePassword, getErrorMessage } from "@/lib/supabase/auth";

export default function NewPasswordPage() {
  const router = useRouter();
  const { user, cargando } = useUser();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (password !== repeat) {
      setError("LAS CONTRASEÑAS NO COINCIDEN");
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      await changePassword(password);
      router.push("/biblioteca");
      return;
    } catch (err) {
      setError(getErrorMessage(err));
    }
    setSubmitting(false);
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">NUEVA CONTRASEÑA</h2>
        </div>

        {cargando ? (
          <div className="pixel" style={{ textAlign: "center", padding: 24 }}>
            CARGANDO...
          </div>
        ) : !user ? (
          <div
            style={{
              textAlign: "center",
              color: "var(--cyan)",
              fontSize: 12,
              letterSpacing: "0.1em",
              lineHeight: 1.7,
              padding: "18px 0",
            }}
          >
            ABRE EL ENLACE DE TU CORREO
            <div style={{ marginTop: 14 }}>
              <Link className="btn ghost" href="/auth">
                IR A INICIAR SESIÓN
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="field">
              <label>Nueva contraseña</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
            </div>
            <div className="field">
              <label>Repetir contraseña</label>
              <input
                type="password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
            </div>

            {error && (
              <div
                style={{
                  marginBottom: 10,
                  color: "var(--magenta)",
                  fontSize: 12,
                  letterSpacing: "0.08em",
                  textShadow: "0 0 6px rgba(255,0,110,0.45)",
                }}
              >
                {error}
              </div>
            )}

            <button
              className="btn lg"
              type="submit"
              disabled={submitting}
              style={{ width: "100%", marginTop: 8 }}
            >
              {submitting ? "ENVIANDO..." : "GUARDAR CONTRASEÑA"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/components/UserProvider";
import { crearPerfil, getErrorMessage } from "@/lib/supabase/auth";

// Solo rutas internas ("/x"); "//host" sería un redirect abierto.
function safePath(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//")
    ? next
    : "/biblioteca";
}

function AliasForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, cargando, recargarPerfil } = useUser();
  const next = safePath(params.get("next"));

  const [alias, setAlias] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Evita que la redirección por "ya tiene perfil" pise la de `next` al terminar.
  const finishedRef = useRef(false);

  useEffect(() => {
    if (cargando || finishedRef.current) return;
    if (!user) router.replace("/auth");
    else if (user.alias) router.replace("/biblioteca");
  }, [user, cargando, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting || !user) return;
    setSubmitting(true);
    setError(null);

    try {
      await crearPerfil(user.id, alias);
      finishedRef.current = true;
      await recargarPerfil();
      router.replace(next);
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
          <h2 className="neon-cyan">ELIGE TU ALIAS</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            ASÍ APARECERÁS EN EL SALÓN
          </div>
        </div>

        {cargando || !user || user.alias ? (
          <div className="pixel" style={{ textAlign: "center", padding: 24 }}>
            CARGANDO...
          </div>
        ) : (
          <form onSubmit={submit}>
            <div className="field">
              <label>Alias</label>
              <input
                value={alias}
                onChange={(e) => setAlias(e.target.value.toUpperCase())}
                placeholder="PX_KAI"
                autoComplete="nickname"
                maxLength={10}
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
              {submitting ? "ENVIANDO..." : "GUARDAR ALIAS"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function AliasPage() {
  return (
    <Suspense fallback={null}>
      <AliasForm />
    </Suspense>
  );
}

"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/components/UserProvider";
import {
  signIn,
  getErrorMessage,
  signUp,
  requestPasswordReset,
} from "@/lib/supabase/auth";

type Mode = "in" | "up" | "recover";

const LINK_ERROR = "EL ENLACE NO ES VÁLIDO O YA EXPIRÓ";

const errorStyle = {
  marginBottom: 10,
  color: "var(--magenta)",
  fontSize: 12,
  letterSpacing: "0.08em",
  textShadow: "0 0 6px rgba(255,0,110,0.45)",
} as const;

const infoStyle = {
  textAlign: "center",
  color: "var(--cyan)",
  fontSize: 12,
  letterSpacing: "0.1em",
  lineHeight: 1.7,
  padding: "18px 0",
} as const;

// Solo rutas internas ("/x"); "//host" sería un redirect abierto.
function safePath(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//")
    ? next
    : "/biblioteca";
}

function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { user } = useUser();
  const next = safePath(params.get("next"));

  const [mode, setMode] = useState<Mode>("in");
  const [alias, setAlias] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<"signup" | "recovery" | null>(null);

  useEffect(() => {
    // Con sesión (ya activa o recién iniciada) respeta ?next; por defecto /biblioteca.
    if (user) router.replace(next);
  }, [user, router, next]);

  const changeMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setNotice(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      if (mode === "in") {
        await signIn({ email, password: pass });
        router.push(next);
        return;
      }
      if (mode === "up") {
        await signUp({ alias, email, password: pass });
        setNotice("signup");
      } else {
        await requestPasswordReset(email);
        setNotice("recovery");
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
    setSubmitting(false);
  };

  const visibleError =
    error ?? (params.get("error") === "link" ? LINK_ERROR : null);
  const buttonLabel =
    mode === "in"
      ? "ENTRAR AL VAULT"
      : mode === "up"
        ? "CREAR CUENTA"
        : "ENVIAR ENLACE";

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        {mode !== "recover" && (
          <div className="auth-tabs">
            <button
              className={mode === "in" ? "on" : ""}
              onClick={() => changeMode("in")}
            >
              INICIAR SESIÓN
            </button>
            <button
              className={mode === "up" ? "on" : ""}
              onClick={() => changeMode("up")}
            >
              CREAR CUENTA
            </button>
          </div>
        )}

        {notice ? (
          <div style={infoStyle}>
            {notice === "signup"
              ? "REVISA TU CORREO PARA ACTIVAR TU CUENTA"
              : "SI EXISTE UNA CUENTA, TE ENVIAMOS UN ENLACE"}
          </div>
        ) : (
          <form onSubmit={submit}>
            {mode === "recover" && (
              <div
                className="mono"
                style={{
                  margin: "18px 0 14px",
                  fontSize: 11,
                  color: "var(--ink-faint)",
                  letterSpacing: "0.12em",
                }}
              >
                RECUPERAR CONTRASEÑA
              </div>
            )}
            {mode === "up" && (
              <div className="field slide-in">
                <label>Alias</label>
                <input
                  value={alias}
                  onChange={(e) => setAlias(e.target.value.toUpperCase())}
                  placeholder="PX_KAI"
                  autoComplete="nickname"
                />
              </div>
            )}
            <div className="field">
              <label>Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jugador@vault.gg"
                autoComplete="email"
                required
              />
            </div>
            {mode !== "recover" && (
              <div className="field">
                <label>Contraseña</label>
                <input
                  type="password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={
                    mode === "in" ? "current-password" : "new-password"
                  }
                  required
                />
              </div>
            )}

            {mode === "in" && (
              <button
                type="button"
                className="btn ghost"
                style={{ width: "100%", marginBottom: 10 }}
                onClick={() => changeMode("recover")}
              >
                ¿OLVIDASTE TU CONTRASEÑA?
              </button>
            )}

            {visibleError && <div style={errorStyle}>{visibleError}</div>}

            <button
              className="btn lg"
              type="submit"
              disabled={submitting}
              style={{ width: "100%", marginTop: 8 }}
            >
              {submitting ? "ENVIANDO..." : buttonLabel}
            </button>
          </form>
        )}

        {(mode === "recover" || notice) && (
          <button
            className="btn ghost"
            style={{ width: "100%", marginTop: 10 }}
            onClick={() => changeMode("in")}
          >
            VOLVER A INICIAR SESIÓN
          </button>
        )}

        <button
          className="btn ghost"
          style={{ width: "100%", marginTop: 10 }}
          onClick={() => router.push("/biblioteca")}
        >
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button
            className="btn ghost"
            type="button"
            disabled
            title="PRÓXIMAMENTE"
          >
            ◆ GOOGLE
          </button>
          <button
            className="btn ghost"
            type="button"
            disabled
            title="PRÓXIMAMENTE"
          >
            ▣ GITHUB
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthForm />
    </Suspense>
  );
}

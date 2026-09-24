"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import { getGames, type Game } from "@/lib/supabase/games";
import { useUser } from "@/components/UserProvider";
import { saveScore } from "@/lib/supabase/scores";
import AsteroidsGame, {
  AsteroidsGameHandle,
} from "@/components/games/AsteroidsGame";

export default function GamePlayerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useUser();
  const [game, setGame] = useState<Game | null | undefined>(undefined);
  const isAsteroids = game?.id === "asteroids";
  const asteroidsRef = useRef<AsteroidsGameHandle>(null);

  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [asteroidsLevel, setAsteroidsLevel] = useState(1);
  const level = isAsteroids ? asteroidsLevel : Math.floor(score / 2500) + 1;
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState(user ? user.name : "INVITADO");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    getGames().then((games) => setGame(games.find((g) => g.id === id) ?? null));
  }, [id]);

  useEffect(() => {
    // Syncs the editable initials field once the persisted session finishes
    // loading (async, resolved after mount by UserProvider).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) setName(user.name);
  }, [user]);

  useEffect(() => {
    if (isAsteroids || over || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220,
    );
    return () => clearInterval(t);
  }, [isAsteroids, over, paused]);

  if (game === undefined) {
    return (
      <div
        className="av-player fade-in"
        style={{ textAlign: "center", padding: 80 }}
      >
        <div className="pixel">CARGANDO...</div>
      </div>
    );
  }

  if (!game) notFound();

  const endGame = () => {
    if (isAsteroids) asteroidsRef.current?.forceGameOver();
    else setOver(true);
  };
  const restart = () => {
    setScore(0);
    setLives(3);
    setAsteroidsLevel(1);
    setPaused(false);
    setOver(false);
    setSaved(false);
    setSaveError(false);
    if (isAsteroids) asteroidsRef.current?.reset();
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={() => setPaused((p) => !p)}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={endGame}>
            FIN
          </button>
          <button
            className="btn ghost"
            onClick={() => router.push(`/juego/${game.id}`)}
          >
            SALIR
          </button>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {isAsteroids ? (
            <AsteroidsGame
              ref={asteroidsRef}
              paused={paused}
              onStateChange={(s) => {
                setScore(s.score);
                setLives(s.lives);
                setAsteroidsLevel(s.level);
                if (s.gameOver) setOver(true);
              }}
            />
          ) : (
            <div className="game-arena">
              <div className="grid-floor"></div>
              <div className="enemy e1"></div>
              <div className="enemy e2"></div>
              <div className="enemy e3"></div>
              <div className="player-ship"></div>
            </div>
          )}
          {paused && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                />
                <button
                  className="btn yellow"
                  onClick={() => {
                    setSaveError(false);
                    saveScore({ gameId: game.id, score, name })
                      .then(() => setSaved(true))
                      .catch(() => setSaveError(true));
                  }}
                >
                  GUARDAR PUNTUACIÓN
                </button>
                {saveError && (
                  <div
                    className="mono"
                    style={{ color: "var(--magenta)", marginTop: 8 }}
                  >
                    NO SE PUDO GUARDAR LA PUNTUACIÓN. INTENTA DE NUEVO.
                  </div>
                )}
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <button
                className="btn magenta"
                onClick={() => router.push("/biblioteca")}
              >
                VOLVER AL VAULT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

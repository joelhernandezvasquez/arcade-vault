"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import { getGames, type Game } from "@/lib/supabase/games";
import { getTopScores, type ScoreRow } from "@/lib/supabase/scores";

export default function GameDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [game, setGame] = useState<Game | null | undefined>(undefined);
  const [scores, setScores] = useState<ScoreRow[] | null>(null);

  useEffect(() => {
    getGames().then((games) => setGame(games.find((g) => g.id === id) ?? null));
    getTopScores(id, 10).then(setScores);
  }, [id]);

  if (game === undefined || scores === null) {
    return (
      <div
        className="av-detail fade-in"
        style={{ textAlign: "center", padding: 80 }}
      >
        <div className="pixel">CARGANDO...</div>
      </div>
    );
  }

  if (!game) notFound();

  return (
    <div className="av-detail fade-in">
      <div>
        <div className="detail-cover">
          <div className={"cover-bg " + game.cover}></div>
        </div>
        <div style={{ marginTop: 20 }} className="detail-info">
          <div className="detail-tags">
            <span>{game.cat}</span>
            <span>1 JUGADOR</span>
            <span>TECLADO / TÁCTIL</span>
            <span>RETRO 1985</span>
          </div>
          <h2 className="neon-cyan">{game.title}</h2>
          <p>{game.long}</p>
          <div className="stat-strip">
            <div>
              <div className="l">Partidas</div>
              <div className="v">{game.plays}</div>
            </div>
            <div>
              <div className="l">Mejor global</div>
              <div
                className="v"
                style={{
                  color: "var(--magenta)",
                  textShadow: "0 0 6px rgba(255,0,110,0.5)",
                }}
              >
                {game.best.toLocaleString("es-ES")}
              </div>
            </div>
            <div>
              <div className="l">Dificultad</div>
              <div
                className="v"
                style={{
                  color: "var(--yellow)",
                  textShadow: "0 0 6px rgba(245,255,0,0.5)",
                }}
              >
                ★ ★ ★ ☆ ☆
              </div>
            </div>
          </div>
          <div className="detail-actions">
            <button
              className="btn xl pulse"
              onClick={() => router.push(`/jugar/${game.id}`)}
            >
              ▶ JUGAR AHORA
            </button>
            <button
              className="btn ghost lg"
              onClick={() => router.push("/biblioteca")}
            >
              VOLVER AL VAULT
            </button>
          </div>
        </div>
      </div>

      <aside>
        <div className="leaderboard">
          <h3>MEJORES PUNTUACIONES</h3>
          {scores.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: 24,
                color: "var(--ink-faint)",
              }}
            >
              SIN PUNTUACIONES TODAVÍA
            </div>
          ) : (
            scores.map((r, i) => (
              <div
                key={r.id}
                className={
                  "lb-row" +
                  (i === 0
                    ? " top1"
                    : i === 1
                      ? " top2"
                      : i === 2
                        ? " top3"
                        : "")
                }
              >
                <div className="rk">#{String(i + 1).padStart(2, "0")}</div>
                <div className="pl">
                  {r.name}
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--ink-faint)",
                      letterSpacing: "0.1em",
                    }}
                  >
                    {new Date(r.createdAt).toLocaleDateString("es-ES")}
                  </div>
                </div>
                <div className="sc">{r.score.toLocaleString("es-ES")}</div>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

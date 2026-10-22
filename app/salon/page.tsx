"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getGames, type Game } from "@/lib/supabase/games";
import {
  getTopScores,
  getBestScore,
  type ScoreRow,
} from "@/lib/supabase/scores";
import { useUser } from "@/components/UserProvider";

export default function SalonPage() {
  const router = useRouter();
  const { user } = useUser();
  const [games, setGames] = useState<Game[] | null>(null);
  const [tab, setTab] = useState<string | null>(null);
  const [rows, setRows] = useState<ScoreRow[] | null>(null);
  const [bestScore, setBestScore] = useState<ScoreRow | null>(null);

  useEffect(() => {
    getGames().then((gs) => {
      setGames(gs);
      setTab((current) => current ?? gs[0]?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!tab) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRows(null);
    getTopScores(tab, 12).then(setRows);
  }, [tab]);

  useEffect(() => {
    if (!tab || !user?.alias) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBestScore(null);
      return;
    }
    getBestScore(tab, user.alias).then(setBestScore);
  }, [tab, user]);

  if (!games || !tab || !rows) {
    return (
      <div
        className="av-hall fade-in"
        style={{ textAlign: "center", padding: 80 }}
      >
        <div className="pixel">CARGANDO...</div>
      </div>
    );
  }

  const game = games.find((g) => g.id === tab)!;

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {games.map((g) => (
          <button
            key={g.id}
            className={"chip" + (tab === g.id ? " active" : "")}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: 80,
            color: "var(--ink-faint)",
          }}
        >
          SIN PUNTUACIONES TODAVÍA
        </div>
      ) : (
        <>
          <div className="podium">
            {rows[1] && (
              <div className="podium-slot silver">
                <div className="rank-num">02</div>
                <div className="name">{rows[1].name}</div>
                <div className="score">
                  {rows[1].score.toLocaleString("es-ES")}
                </div>
                <div className="date">
                  {new Date(rows[1].createdAt).toLocaleDateString("es-ES")}
                </div>
              </div>
            )}
            {rows[0] && (
              <div className="podium-slot gold">
                <div
                  className="pixel"
                  style={{
                    fontSize: 9,
                    color: "var(--gold)",
                    letterSpacing: "0.18em",
                  }}
                >
                  CAMPEÓN
                </div>
                <div
                  className="rank-num"
                  style={{ fontSize: 36, marginTop: 4 }}
                >
                  01
                </div>
                <div className="name">{rows[0].name}</div>
                <div className="score" style={{ fontSize: 20 }}>
                  {rows[0].score.toLocaleString("es-ES")}
                </div>
                <div className="date">
                  {new Date(rows[0].createdAt).toLocaleDateString("es-ES")}
                </div>
              </div>
            )}
            {rows[2] && (
              <div className="podium-slot bronze">
                <div className="rank-num">03</div>
                <div className="name">{rows[2].name}</div>
                <div className="score">
                  {rows[2].score.toLocaleString("es-ES")}
                </div>
                <div className="date">
                  {new Date(rows[2].createdAt).toLocaleDateString("es-ES")}
                </div>
              </div>
            )}
          </div>

          <div className="hall-table">
            <div className="th">
              <div>RANGO</div>
              <div>JUGADOR</div>
              <div>PUNTUACIÓN</div>
              <div>FECHA</div>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.id}
                className={
                  "tr" +
                  (i === 0
                    ? " top1"
                    : i === 1
                      ? " top2"
                      : i === 2
                        ? " top3"
                        : "")
                }
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="rk">#{String(i + 1).padStart(2, "0")}</div>
                <div className="pl">{r.name}</div>
                <div className="sc">{r.score.toLocaleString("es-ES")}</div>
                <div className="dt">
                  {new Date(r.createdAt).toLocaleDateString("es-ES")}
                </div>
              </div>
            ))}
            {user && bestScore && (
              <>
                <div className="tr you-label">
                  ▸ TU MEJOR MARCA EN {game.title}
                </div>
                <div
                  className="tr you"
                  style={{ animationDelay: `${rows.length * 50 + 50}ms` }}
                >
                  <div className="rk" style={{ color: "var(--yellow)" }}>
                    ★
                  </div>
                  <div className="pl" style={{ color: "var(--yellow)" }}>
                    {bestScore.name}
                  </div>
                  <div
                    className="sc"
                    style={{
                      color: "var(--yellow)",
                      textShadow: "0 0 6px rgba(245,255,0,0.5)",
                    }}
                  >
                    {bestScore.score.toLocaleString("es-ES")}
                  </div>
                  <div className="dt">
                    {new Date(bestScore.createdAt).toLocaleDateString("es-ES")}
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <button className="btn lg" onClick={() => router.push("/biblioteca")}>
          VOLVER A LA BIBLIOTECA
        </button>
      </div>
    </div>
  );
}

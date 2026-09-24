"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CATS } from "@/lib/data";
import { getGames, type Game } from "@/lib/supabase/games";
import { GameCard } from "@/components/GameCard";

export default function Biblioteca() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("TODOS");
  const [games, setGames] = useState<Game[] | null>(null);

  useEffect(() => {
    getGames().then(setGames);
  }, []);

  const filtered = useMemo(
    () =>
      (games ?? []).filter(
        (g) =>
          (cat === "TODOS" || g.cat === cat) &&
          g.title.toLowerCase().includes(q.toLowerCase()),
      ),
    [games, q, cat],
  );

  if (!games) {
    return (
      <div className="fade-in" style={{ textAlign: "center", padding: 80 }}>
        <div className="pixel">CARGANDO...</div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <section className="av-hero">
        <h1 className="flicker">ARCADE VAULT</h1>
        <div className="sub">
          INSERTA UNA MONEDA PARA JUGAR <span className="blink">_</span>
        </div>
      </section>

      <div className="av-filters">
        <div className="av-search">
          <span className="ico">⌕</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar un juego por nombre…"
          />
        </div>
        <div className="av-chips">
          {CATS.map((c) => (
            <button
              key={c}
              className={"chip" + (cat === c ? " active" : "")}
              onClick={() => setCat(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="av-grid">
        {filtered.map((g) => (
          <GameCard
            key={g.id}
            game={g}
            onSelect={(game) => router.push(`/juego/${game.id}`)}
          />
        ))}
        {filtered.length === 0 && (
          <div
            style={{
              gridColumn: "1 / -1",
              textAlign: "center",
              padding: 80,
              color: "var(--ink-faint)",
            }}
          >
            <div
              className="pixel"
              style={{
                fontSize: 14,
                color: "var(--magenta)",
                marginBottom: 12,
              }}
            >
              NO HAY RESULTADOS
            </div>
            <div>Intenta otra búsqueda o categoría.</div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { PerfSnapshot } from "@/lib/games/types";

interface PerfOverlayProps {
  gameId: string;
  skin: string;
  getPerf: () => PerfSnapshot | undefined;
}

// Recuadro de diagnóstico (solo con ?perf=1). Consulta el motor una vez por segundo.
export default function PerfOverlay({
  gameId,
  skin,
  getPerf,
}: PerfOverlayProps) {
  const [perf, setPerf] = useState<PerfSnapshot | null>(null);

  // El padre pasa una función nueva en cada render; se guarda en un ref para
  // que el intervalo de 1 s no se reinicie con cada cambio de estado del juego.
  const getPerfRef = useRef(getPerf);
  useEffect(() => {
    getPerfRef.current = getPerf;
  });

  useEffect(() => {
    const t = setInterval(() => setPerf(getPerfRef.current() ?? null), 1000);
    return () => clearInterval(t);
  }, []);

  const f = (n: number, d = 1) => n.toFixed(d);

  return (
    <div
      className="mono"
      style={{
        position: "absolute",
        top: 8,
        left: 8,
        zIndex: 6,
        padding: "6px 8px",
        fontSize: 11,
        lineHeight: 1.4,
        color: "var(--green)",
        background: "rgba(0,0,0,0.75)",
        border: "1px solid var(--green)",
        pointerEvents: "none",
        whiteSpace: "pre",
      }}
    >
      {`${gameId} · ${skin}`}
      {perf
        ? `\nfps ${f(perf.fps, 0)} · raf ${f(perf.rafFps, 0)}\navg ${f(perf.avgMs, 2)} · p95 ${f(perf.p95Ms, 2)} · max ${f(perf.maxMs, 2)} ms`
        : "\nmidiendo..."}
    </div>
  );
}

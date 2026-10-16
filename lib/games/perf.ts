import type { PerfSnapshot } from "./types";

const MUESTRAS = 120;
const VENTANA_MS = 2000;

// Buffer circular de marcas de tiempo (y, opcionalmente, duraciones).
class Anillo {
  readonly t = new Float64Array(MUESTRAS);
  readonly ms = new Float64Array(MUESTRAS);
  private cabeza = 0;
  private total = 0;

  push(t: number): void {
    this.t[this.cabeza] = t;
    this.ms[this.cabeza] = 0;
    this.cabeza = (this.cabeza + 1) % MUESTRAS;
    if (this.total < MUESTRAS) this.total++;
  }

  /** Guarda la duración de la última muestra añadida. */
  setUltimoMs(ms: number): void {
    if (this.total === 0) return;
    this.ms[(this.cabeza - 1 + MUESTRAS) % MUESTRAS] = ms;
  }

  /** Índices de las muestras con `t >= desde`, de la más antigua a la más nueva. */
  indices(desde: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.total; i++) {
      const idx = (this.cabeza - this.total + i + MUESTRAS) % MUESTRAS;
      if (this.t[idx] >= desde) out.push(idx);
    }
    return out;
  }
}

function tasa(anillo: Anillo, idx: number[]): number {
  if (idx.length < 2) return 0;
  const span = anillo.t[idx[idx.length - 1]] - anillo.t[idx[0]];
  return span > 0 ? ((idx.length - 1) * 1000) / span : 0;
}

export class FramePacer {
  private readonly intervalo: number;
  private readonly raf = new Anillo();
  private readonly run = new Anillo();
  private ultimoRun = -Infinity;
  private inicio = 0;

  constructor(maxFps: number = Infinity) {
    this.intervalo = 1000 / maxFps;
  }

  /** Una vez por callback de rAF. Devuelve false si el tope pide saltarlo. */
  shouldRun(ts: number): boolean {
    this.raf.push(ts);
    if (ts - this.ultimoRun < this.intervalo - 1) return false;
    this.ultimoRun = ts;
    this.run.push(ts);
    return true;
  }

  begin(): void {
    this.inicio = performance.now();
  }

  end(): void {
    this.run.setUltimoMs(performance.now() - this.inicio);
  }

  snapshot(): PerfSnapshot {
    const vacio: PerfSnapshot = {
      fps: 0,
      rafFps: 0,
      avgMs: 0,
      p95Ms: 0,
      maxMs: 0,
    };
    const ahora = this.raf.indices(-Infinity);
    if (ahora.length === 0) return vacio;
    const desde = this.raf.t[ahora[ahora.length - 1]] - VENTANA_MS;

    const rafIdx = this.raf.indices(desde);
    const runIdx = this.run.indices(desde);
    if (runIdx.length === 0)
      return { ...vacio, rafFps: tasa(this.raf, rafIdx) };

    const duraciones = runIdx.map((i) => this.run.ms[i]).sort((a, b) => a - b);
    const suma = duraciones.reduce((a, b) => a + b, 0);
    const p95 =
      duraciones[
        Math.min(duraciones.length - 1, Math.floor(duraciones.length * 0.95))
      ];

    return {
      fps: tasa(this.run, runIdx),
      rafFps: tasa(this.raf, rafIdx),
      avgMs: suma / duraciones.length,
      p95Ms: p95,
      maxMs: duraciones[duraciones.length - 1],
    };
  }
}

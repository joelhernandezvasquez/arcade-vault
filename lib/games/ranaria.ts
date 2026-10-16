// Motor de Frogger (RANARIA), diseñado desde cero (specs/game-jam/frogger/frogger-core.md).
// Todo se dibuja con primitivas de canvas; no hay imágenes ni sonido.

import { DEFAULT_SKIN, getSkin, grosorTrazo } from "./skins";
import type { GameEngine, GameState, SkinDefinition } from "./types";

// ── Constants ─────────────────────────────────────────────────────────────────
const COLS = 20;
const ROWS = 15;
const CELL = 40; // 20×15 celdas de 40 px = lienzo lógico de 800×600
const W = COLS * CELL;
const H = ROWS * CELL;

// Filas (0 = arriba).
const ROW_GOALS = 0;
const ROW_RIVER_TOP = 1;
const ROW_RIVER_BOT = 6;
const ROW_MEDIAN = 7;
const ROW_ROAD_TOP = 8;
const ROW_ROAD_BOT = 12;
const ROW_START = 13;
const ROW_TIMER = 14;

const START_COL = Math.floor(COLS / 2);
const START_LIVES = 3;
const JUMP_MS = 120;
const FROG_HITBOX_MARGIN = 0.15; // celdas recortadas a cada lado en colisiones

// Bocas destino: 5 de 2 columnas (cols 1–2, 5–6, 9–10, 13–14, 17–18).
const GOALS = 5;
const GOAL_FIRST_COL = 1;
const GOAL_STRIDE = 4;
const GOAL_WIDTH = 2;
const MAX_DT = 0.05; // s

// Puntuación.
const ROW_POINTS = 10; // por cada fila nueva alcanzada hacia arriba
const GOAL_POINTS = 50;
const TIME_BONUS_PER_S = 10; // × segundos enteros restantes, al ocupar una boca
const ROUND_POINTS = 200;

// Temporizador de ronda: 15 s en el nivel 1, −1 s por nivel, mínimo 8 s.
const BASE_TIME_S = 15;
const MIN_TIME_S = 8;
const roundTime = (level: number) =>
  Math.max(MIN_TIME_S, BASE_TIME_S - (level - 1));

// Colores por skin. En clásico son los literales originales (sin cambios); en
// neón y retro salen de la paleta de la skin.
interface Colores {
  fondo: string;
  muro: string;
  boca: string;
  bocaBorde: string;
  seguro: string;
  agua: string;
  ondas: string;
  carretera: string;
  lineaCarril: string;
  rana: string;
  ojo: string;
  pupila: string;
  coches: string[];
  camiones: string[];
  cabina: string;
  parabrisas: string;
  ruedas: string;
  tronco: string;
  vetaTronco: string;
  tortuga: string;
  caparazon: string;
  tortugaSumergida: string;
  barraFondo: string;
  barraBien: string;
  barraAviso: string;
  barraPeligro: string;
  barraBorde: string;
}

function coloresDe(skin: SkinDefinition): Colores {
  const p = skin.paleta;
  switch (skin.id) {
    case "neon":
      return {
        fondo: p.fondo,
        muro: "#07070d",
        boca: "#052a1a",
        bocaBorde: p.resalte,
        seguro: "#0b2a1c",
        agua: "#06142e",
        ondas: "rgba(0,245,255,0.14)",
        carretera: "#0d0d14",
        lineaCarril: "rgba(245,255,0,0.35)",
        rana: p.acento,
        ojo: "#fff",
        pupila: p.fondo,
        coches: [p.secundario, p.resalte, p.primario],
        camiones: [p.primario, p.resalte, p.acento],
        cabina: p.alerta,
        parabrisas: p.fondo,
        ruedas: p.fondo,
        tronco: p.alerta,
        vetaTronco: p.fondo,
        tortuga: p.acento,
        caparazon: p.fondo,
        tortugaSumergida: "rgba(0,255,136,0.35)",
        barraFondo: p.fondo,
        barraBien: p.acento,
        barraAviso: p.resalte,
        barraPeligro: p.secundario,
        barraBorde: p.primario,
      };
    case "retro":
      return {
        fondo: "#000",
        muro: "#000",
        boca: "#005800",
        bocaBorde: p.resalte,
        seguro: "#005800",
        agua: "#0000bc",
        ondas: "#0058f8",
        carretera: "#000",
        lineaCarril: "#7c7c7c",
        rana: p.primario,
        ojo: p.secundario,
        pupila: "#000",
        coches: [p.alerta, p.resalte, p.acento],
        camiones: [p.secundario, p.resalte, p.acento],
        cabina: p.alerta,
        parabrisas: p.acento,
        ruedas: "#000",
        tronco: "#a85800",
        vetaTronco: "#503000",
        tortuga: p.primario,
        caparazon: "#005800",
        tortugaSumergida: "#005800",
        barraFondo: "#000",
        barraBien: p.primario,
        barraAviso: p.resalte,
        barraPeligro: p.alerta,
        barraBorde: p.secundario,
      };
    default:
      return {
        fondo: "#000",
        muro: "#06210f",
        boca: "#1f8a45",
        bocaBorde: "#f5c542",
        seguro: "#14532d",
        agua: "#0b2e66",
        ondas: "rgba(255,255,255,0.07)",
        carretera: "#1a1a1f",
        lineaCarril: "rgba(255,255,255,0.25)",
        rana: "#39ff6a",
        ojo: "#fff",
        pupila: "#000",
        coches: ["#ff3b3b", "#ffd23b", "#3b8bff"],
        camiones: ["#9aa0a6", "#d98a2b", "#c8c8c8"],
        cabina: "#c0392b",
        parabrisas: "rgba(180,230,255,0.85)",
        ruedas: "#050505",
        tronco: "#7a4a21",
        vetaTronco: "#4e2d10",
        tortuga: "#2fb552",
        caparazon: "#1a7a34",
        tortugaSumergida: "rgba(120,220,150,0.35)",
        barraFondo: "#111",
        barraBien: "#00ff88",
        barraAviso: "#f5ff00",
        barraPeligro: "#ff2d55",
        barraBorde: "rgba(255,255,255,0.3)",
      };
  }
}

const FACING_ANGLE: Record<Direction, number> = {
  up: 0,
  right: Math.PI / 2,
  down: Math.PI,
  left: -Math.PI / 2,
};

type Direction = "up" | "down" | "left" | "right";

type EntityKind = "car" | "truck" | "log" | "turtle";

interface Entity {
  col: number; // columna del borde izquierdo; fraccionaria
  width: number; // en celdas
  kind: EntityKind;
  variant: number; // índice de color/aspecto al dibujar
  phase: number; // s dentro del ciclo de inmersión (solo tortugas)
}

interface Lane {
  row: number;
  speed: number; // celdas por segundo (siempre positiva)
  dir: 1 | -1;
  span: number; // largo del circuito en celdas; ≥ COLS + ancho de la entidad
  entities: Entity[];
}

interface LaneTemplate {
  row: number;
  kind: EntityKind;
  width: number;
  count: number;
  spacing: number; // celdas entre bordes izquierdos; count × spacing = span
  speed: number; // celdas/s en el nivel 1
  dir: 1 | -1;
}

// Carretera (filas 8–12) y río (filas 1–6). En cada carril el hueco entre
// entidades (spacing − width) es de al menos 3 celdas y span ≥ COLS + width,
// para que al reaparecer la entidad ya esté fuera del lienzo.
const LANE_TEMPLATES: readonly LaneTemplate[] = [
  { row: 1, kind: "log", width: 3, count: 4, spacing: 7, speed: 1.5, dir: -1 },
  {
    row: 2,
    kind: "turtle",
    width: 2,
    count: 5,
    spacing: 5,
    speed: 1.2,
    dir: 1,
  },
  { row: 3, kind: "log", width: 4, count: 3, spacing: 8, speed: 2.4, dir: -1 },
  { row: 4, kind: "log", width: 2, count: 5, spacing: 5, speed: 1.8, dir: 1 },
  {
    row: 5,
    kind: "turtle",
    width: 3,
    count: 4,
    spacing: 7,
    speed: 1.6,
    dir: -1,
  },
  { row: 6, kind: "log", width: 4, count: 3, spacing: 8, speed: 3.0, dir: 1 },
  { row: 8, kind: "car", width: 1, count: 4, spacing: 6, speed: 2.2, dir: -1 },
  { row: 9, kind: "truck", width: 3, count: 3, spacing: 9, speed: 1.8, dir: 1 },
  { row: 10, kind: "car", width: 1, count: 5, spacing: 5, speed: 3.2, dir: -1 },
  {
    row: 11,
    kind: "truck",
    width: 2,
    count: 4,
    spacing: 7,
    speed: 2.6,
    dir: 1,
  },
  { row: 12, kind: "car", width: 1, count: 3, spacing: 8, speed: 4.5, dir: -1 },
];

const SPEED_PER_LEVEL = 1.15; // multiplicador acumulado por nivel
const TURTLE_VISIBLE_S = 3;
const TURTLE_SUBMERGED_S = 1.5;
const TURTLE_CYCLE_S = TURTLE_VISIBLE_S + TURTLE_SUBMERGED_S;
const VARIANTS = 3; // aspectos distintos de coches y camiones

function buildLanes(level: number): Lane[] {
  const mult = Math.pow(SPEED_PER_LEVEL, level - 1);
  return LANE_TEMPLATES.map((t) => {
    const span = t.count * t.spacing;
    // Desfase propio de cada carril para que no queden alineados.
    const offset = (t.row * 1.7) % t.spacing;
    const entities: Entity[] = [];
    for (let i = 0; i < t.count; i++) {
      entities.push({
        col: i * t.spacing + offset - t.width,
        width: t.width,
        kind: t.kind,
        variant: (i + t.row) % VARIANTS,
        // Cada grupo de tortugas arranca en un punto distinto del ciclo.
        phase: (i * TURTLE_CYCLE_S) / t.count,
      });
    }
    return { row: t.row, speed: t.speed * mult, dir: t.dir, span, entities };
  });
}

// Una tortuga sumergida no sostiene a la rana.
const isSubmerged = (e: Entity) =>
  e.kind === "turtle" && e.phase >= TURTLE_VISIBLE_S;

interface Frog {
  col: number; // fraccionaria cuando viaja sobre un tronco
  row: number;
  animating: boolean;
  animT: number; // ms
  fromCol: number;
  fromRow: number;
  toCol: number;
  toRow: number;
}

const KEY_DIRS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

export class RanariaGame implements GameEngine {
  private ctx: CanvasRenderingContext2D;
  private skin: SkinDefinition;
  private col: Colores;
  // Lienzo reducido para los píxeles gruesos de la skin retro.
  private lowCanvas: HTMLCanvasElement | null = null;
  private lowCtx: CanvasRenderingContext2D | null = null;

  private lanes: Lane[] = [];
  private frog: Frog = this.newFrog();
  private pendingDir: Direction | null = null;
  private facing: Direction = "up";
  private goals: boolean[] = new Array(GOALS).fill(false);
  private bestRow = ROW_START; // fila más alta alcanzada por la rana actual
  private timeLeft = 0; // s
  private timeLimit = BASE_TIME_S; // s, duración total de esta ronda

  private score = 0;
  private lives = START_LIVES;
  private level = 1;
  private gameOver = false;

  private destroyed = false;
  private paused = false;
  private lastTime: number | null = null;
  private rafId: number | null = null;
  private onStateChangeCb: ((s: GameState) => void) | null = null;
  private lastReported: GameState | null = null;

  // Ignora teclas con modificadores y cualquier campo de texto (p. ej. el nombre
  // del modal de fin de partida), para no bloquear letras como "a", "s", "w", "d".
  private gameDir(e: KeyboardEvent): Direction | null {
    if (e.ctrlKey || e.metaKey || e.altKey) return null;
    const t = e.target;
    if (
      t instanceof HTMLElement &&
      (t.isContentEditable ||
        t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.tagName === "SELECT")
    ) {
      return null;
    }
    return KEY_DIRS[e.key] ?? KEY_DIRS[e.key.toLowerCase()] ?? null;
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    const dir = this.gameDir(e);
    if (!dir) return;
    e.preventDefault();
    if (this.paused || this.gameOver) return;
    this.pendingDir = dir;
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    if (this.gameDir(e)) e.preventDefault();
  };

  constructor(canvas: HTMLCanvasElement, skin?: SkinDefinition) {
    this.skin = skin ?? getSkin(DEFAULT_SKIN);
    this.col = coloresDe(this.skin);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas");
    this.ctx = ctx;

    document.addEventListener("keydown", this.handleKeyDown);
    document.addEventListener("keyup", this.handleKeyUp);

    this.initGame();
  }

  onStateChange(cb: (s: GameState) => void) {
    this.onStateChangeCb = cb;
  }

  start() {
    if (this.destroyed) return;
    this.lastTime = null;
    this.draw();
    this.reportState();
    this.startLoop();
  }

  // Cambia la skin en caliente: no reinicia la partida ni emite estado. Se
  // repinta siempre para que la pausa y el fin de partida muestren la skin nueva.
  setSkin(skin: SkinDefinition) {
    this.skin = skin;
    this.col = coloresDe(skin);
    if (!this.destroyed) this.draw();
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    this.lastTime = null;
  }

  reset() {
    if (this.destroyed) return;
    this.stopLoop();
    this.initGame();
    this.draw();
    this.reportState();
    this.startLoop();
  }

  forceGameOver() {
    this.endGame();
  }

  destroy() {
    this.destroyed = true;
    this.stopLoop();
    document.removeEventListener("keydown", this.handleKeyDown);
    document.removeEventListener("keyup", this.handleKeyUp);
  }

  private startLoop() {
    if (this.rafId === null && !this.destroyed && !this.gameOver) {
      this.rafId = requestAnimationFrame(this.loop);
    }
  }

  private stopLoop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private newFrog(): Frog {
    return {
      col: START_COL,
      row: ROW_START,
      animating: false,
      animT: 0,
      fromCol: START_COL,
      fromRow: ROW_START,
      toCol: START_COL,
      toRow: ROW_START,
    };
  }

  private initGame() {
    this.score = 0;
    this.lives = START_LIVES;
    this.level = 1;
    this.gameOver = false;
    this.goals = new Array(GOALS).fill(false);
    this.pendingDir = null;
    this.lastTime = null;
    this.lanes = buildLanes(this.level);
    this.respawnFrog();
  }

  // Rana nueva en la fila de inicio, con el temporizador de la ronda completo.
  private respawnFrog() {
    this.frog = this.newFrog();
    this.pendingDir = null;
    this.facing = "up";
    this.bestRow = ROW_START;
    this.timeLimit = roundTime(this.level);
    this.timeLeft = this.timeLimit;
  }

  // ── Reglas ──────────────────────────────────────────────────────────────────
  // Avanza cada entidad y la reintroduce por el lado opuesto al salir.
  private moveLanes(dt: number) {
    for (const lane of this.lanes) {
      const dx = lane.speed * lane.dir * dt;
      for (const e of lane.entities) {
        e.col += dx;
        if (lane.dir === 1 && e.col >= COLS) e.col -= lane.span;
        else if (lane.dir === -1 && e.col + e.width <= 0) e.col += lane.span;
        if (e.kind === "turtle") e.phase = (e.phase + dt) % TURTLE_CYCLE_S;
      }
    }
  }

  private laneAt(row: number): Lane | undefined {
    return this.lanes.find((l) => l.row === row);
  }

  // Entidad que sostiene a la rana (su centro cae dentro de ella), o null.
  // Solo cuenta troncos y tortugas visibles.
  private getSupport(): { lane: Lane; entity: Entity } | null {
    if (this.frog.row < ROW_RIVER_TOP || this.frog.row > ROW_RIVER_BOT) {
      return null;
    }
    const lane = this.laneAt(this.frog.row);
    if (!lane) return null;
    const center = this.frog.col + 0.5;
    for (const entity of lane.entities) {
      if (isSubmerged(entity)) continue;
      if (center >= entity.col && center < entity.col + entity.width) {
        return { lane, entity };
      }
    }
    return null;
  }

  // Inicia el salto pendiente. Siempre cae en una celda entera: sobre un tronco
  // la columna es fraccionaria y se redondea. Un salto fuera del tablero (bordes
  // laterales, bajo la fila de inicio o más arriba de las bocas) se descarta.
  private startJump() {
    const dir = this.pendingDir;
    this.pendingDir = null;
    if (!dir) return;
    const f = this.frog;
    const baseCol = Math.round(f.col);
    let toCol = baseCol;
    let toRow = f.row;
    if (dir === "left") toCol -= 1;
    else if (dir === "right") toCol += 1;
    else if (dir === "up") toRow -= 1;
    else toRow += 1;
    if (toCol < 0 || toCol >= COLS) return;
    if (toRow < ROW_GOALS || toRow > ROW_START) return;
    this.facing = dir;
    f.animating = true;
    f.animT = 0;
    f.fromCol = f.col;
    f.fromRow = f.row;
    f.toCol = toCol;
    f.toRow = toRow;
  }

  // +10 por cada fila nueva alcanzada hacia arriba por la rana actual.
  private scoreRows() {
    const f = this.frog;
    if (f.row < this.bestRow) {
      this.score += (this.bestRow - f.row) * ROW_POINTS;
      this.bestRow = f.row;
    }
  }

  private updateFrog(dt: number) {
    const f = this.frog;
    if (!f.animating) this.startJump();

    if (f.animating) {
      f.animT += dt * 1000;
      const t = Math.min(f.animT / JUMP_MS, 1);
      f.col = f.fromCol + (f.toCol - f.fromCol) * t;
      f.row = f.fromRow + (f.toRow - f.fromRow) * t;
      if (t >= 1) {
        f.animating = false;
        f.col = f.toCol;
        f.row = f.toRow;
        this.scoreRows();
      }
      return;
    }

    // En el río, la rana viaja con lo que la sostiene.
    const support = this.getSupport();
    if (support) f.col += support.lane.speed * support.lane.dir * dt;
  }

  // ¿Algún vehículo toca a la rana? Usa una caja algo menor que la celda.
  private hitByVehicle(): boolean {
    const row = Math.round(this.frog.row);
    if (row < ROW_ROAD_TOP || row > ROW_ROAD_BOT) return false;
    const lane = this.laneAt(row);
    if (!lane) return false;
    const left = this.frog.col + FROG_HITBOX_MARGIN;
    const right = this.frog.col + 1 - FROG_HITBOX_MARGIN;
    return lane.entities.some((e) => left < e.col + e.width && right > e.col);
  }

  // Índice de la boca destino que cubre la columna, o -1 si es muro.
  private goalAt(col: number): number {
    for (let i = 0; i < GOALS; i++) {
      const start = GOAL_FIRST_COL + i * GOAL_STRIDE;
      if (col >= start && col < start + GOAL_WIDTH) return i;
    }
    return -1;
  }

  // La rana está en la fila de bocas: ocupa una libre o muere.
  private enterGoal() {
    const i = this.goalAt(Math.round(this.frog.col));
    if (i < 0 || this.goals[i]) {
      this.killFrog();
      return;
    }
    this.goals[i] = true;
    this.score += GOAL_POINTS + Math.floor(this.timeLeft) * TIME_BONUS_PER_S;
    if (this.goals.every(Boolean)) this.completeRound();
    else this.respawnFrog();
  }

  private completeRound() {
    this.score += ROUND_POINTS;
    this.level += 1;
    this.goals = this.goals.map(() => false);
    this.lanes = buildLanes(this.level);
    this.respawnFrog();
  }

  // Único camino de muerte. Con la última vida termina la partida.
  private killFrog() {
    this.lives = Math.max(0, this.lives - 1);
    if (this.lives === 0) {
      this.endGame();
      return;
    }
    this.respawnFrog();
  }

  // Reglas que dependen de dónde está la rana tras mover carriles y rana.
  private resolveFrog() {
    const f = this.frog;
    if (this.hitByVehicle()) {
      this.killFrog();
      return;
    }
    if (f.animating) return;

    // Arrastrada fuera del lienzo por el río.
    const center = f.col + 0.5;
    if (center < 0 || center >= COLS) {
      this.killFrog();
      return;
    }
    if (f.row === ROW_GOALS) {
      this.enterGoal();
      return;
    }
    // Agua, o tortuga que se sumergió bajo la rana.
    if (
      f.row >= ROW_RIVER_TOP &&
      f.row <= ROW_RIVER_BOT &&
      !this.getSupport()
    ) {
      this.killFrog();
    }
  }

  private update(dt: number) {
    this.moveLanes(dt);
    this.updateFrog(dt);
    this.resolveFrog();
    if (this.gameOver) return;

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) this.killFrog();
  }

  // Único camino de fin de partida (sin vidas y FIN): emite el estado una vez
  // y detiene el loop.
  private endGame() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.stopLoop();
    this.draw();
    this.reportState();
  }

  private reportState() {
    const s: GameState = {
      score: this.score,
      lives: this.lives,
      level: this.level,
      gameOver: this.gameOver,
    };
    const last = this.lastReported;
    if (
      !last ||
      last.score !== s.score ||
      last.lives !== s.lives ||
      last.level !== s.level ||
      last.gameOver !== s.gameOver
    ) {
      this.lastReported = s;
      this.onStateChangeCb?.(s);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  private draw() {
    const skin = this.skin;
    const px = skin.pixelado;
    const main = this.ctx;
    let ctx = main;

    if (px > 1) {
      // Se dibuja en un lienzo reducido (coordenadas lógicas intactas vía
      // transform) y se amplía sin suavizado para obtener píxeles gruesos.
      if (!this.lowCanvas || this.lowCanvas.width !== Math.ceil(W / px)) {
        this.lowCanvas = document.createElement("canvas");
        this.lowCanvas.width = Math.ceil(W / px);
        this.lowCanvas.height = Math.ceil(H / px);
        this.lowCtx = this.lowCanvas.getContext("2d");
      }
      if (this.lowCtx) {
        ctx = this.lowCtx;
        ctx.setTransform(1 / px, 0, 0, 1 / px, 0, 0);
      }
    }

    ctx.imageSmoothingEnabled = skin.suavizado;
    ctx.fillStyle = this.col.fondo;
    ctx.fillRect(0, 0, W, H);
    this.drawBoard(ctx);
    this.drawGoals(ctx);
    for (const lane of this.lanes) {
      for (const e of lane.entities) this.drawEntity(ctx, lane, e);
    }
    this.drawFrog(ctx);
    this.drawTimerBar(ctx);

    if (ctx !== main && this.lowCanvas) {
      main.imageSmoothingEnabled = false;
      main.drawImage(this.lowCanvas, 0, 0, W, H);
    } else {
      main.imageSmoothingEnabled = skin.suavizado;
    }
  }

  // Glow de neón; se restablece con noGlow tras cada uso.
  private glow(ctx: CanvasRenderingContext2D, color: string) {
    if (this.skin.brillo <= 0) return;
    ctx.shadowColor = color;
    ctx.shadowBlur = this.skin.brillo;
  }

  private noGlow(ctx: CanvasRenderingContext2D) {
    if (this.skin.brillo <= 0) return;
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
  }

  // Grosor de trazo según la skin (clásico: el valor base).
  private lw(base: number) {
    return grosorTrazo(this.skin, base);
  }

  private fillRows(
    ctx: CanvasRenderingContext2D,
    color: string,
    from: number,
    to: number,
  ) {
    ctx.fillStyle = color;
    ctx.fillRect(0, from * CELL, W, (to - from + 1) * CELL);
  }

  // Zonas: bocas/muro, río, mediana, carretera, inicio y franja del tiempo.
  private drawBoard(ctx: CanvasRenderingContext2D) {
    this.fillRows(ctx, this.col.muro, ROW_GOALS, ROW_GOALS);
    this.fillRows(ctx, this.col.agua, ROW_RIVER_TOP, ROW_RIVER_BOT);
    this.fillRows(ctx, this.col.seguro, ROW_MEDIAN, ROW_MEDIAN);
    this.fillRows(ctx, this.col.carretera, ROW_ROAD_TOP, ROW_ROAD_BOT);
    this.fillRows(ctx, this.col.seguro, ROW_START, ROW_START);
    this.fillRows(ctx, this.col.fondo, ROW_TIMER, ROW_TIMER);

    // Ondas del río.
    ctx.strokeStyle = this.col.ondas;
    ctx.lineWidth = this.lw(2);
    for (let r = ROW_RIVER_TOP; r <= ROW_RIVER_BOT; r++) {
      ctx.beginPath();
      for (let x = (r % 2) * 40; x < W; x += 120) {
        ctx.moveTo(x, r * CELL + 12);
        ctx.lineTo(x + 28, r * CELL + 12);
        ctx.moveTo(x + 50, r * CELL + 28);
        ctx.lineTo(x + 78, r * CELL + 28);
      }
      ctx.stroke();
    }

    // Líneas discontinuas entre carriles de carretera.
    ctx.strokeStyle = this.col.lineaCarril;
    ctx.lineWidth = this.lw(2);
    ctx.setLineDash([16, 16]);
    ctx.beginPath();
    for (let r = ROW_ROAD_TOP + 1; r <= ROW_ROAD_BOT; r++) {
      ctx.moveTo(0, r * CELL);
      ctx.lineTo(W, r * CELL);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawGoals(ctx: CanvasRenderingContext2D) {
    const c = this.col;
    for (let i = 0; i < GOALS; i++) {
      const x = (GOAL_FIRST_COL + i * GOAL_STRIDE) * CELL;
      const w = GOAL_WIDTH * CELL;
      ctx.fillStyle = c.boca;
      ctx.fillRect(x, ROW_GOALS * CELL, w, CELL);
      this.glow(ctx, c.bocaBorde);
      ctx.strokeStyle = c.bocaBorde;
      ctx.lineWidth = this.lw(3);
      ctx.strokeRect(x + 1.5, ROW_GOALS * CELL + 1.5, w - 3, CELL - 3);
      this.noGlow(ctx);
      if (this.goals[i]) {
        this.drawFrogShape(ctx, x + w / 2, CELL / 2, "up", false);
      }
    }
  }

  private drawEntity(ctx: CanvasRenderingContext2D, lane: Lane, e: Entity) {
    const c = this.col;
    const x = e.col * CELL;
    const y = lane.row * CELL;
    const w = e.width * CELL;
    const frontRight = lane.dir === 1;
    const duro = this.skin.pixelado > 1;

    switch (e.kind) {
      case "car": {
        const color = c.coches[e.variant % c.coches.length];
        this.glow(ctx, color);
        ctx.fillStyle = color;
        ctx.fillRect(x + 3, y + 9, w - 6, CELL - 18);
        this.noGlow(ctx);
        // Parabrisas en el frente.
        ctx.fillStyle = c.parabrisas;
        ctx.fillRect(frontRight ? x + w - 14 : x + 7, y + 12, 7, CELL - 24);
        this.drawWheels(ctx, x, y, w);
        break;
      }
      case "truck": {
        const cabW = 30;
        const cabX = frontRight ? x + w - cabW - 2 : x + 2;
        const trailerX = frontRight ? x + 2 : x + cabW + 2;
        const color = c.camiones[e.variant % c.camiones.length];
        this.glow(ctx, color);
        ctx.fillStyle = color;
        ctx.fillRect(trailerX, y + 7, w - cabW - 4, CELL - 14);
        this.noGlow(ctx);
        this.glow(ctx, c.cabina);
        ctx.fillStyle = c.cabina;
        ctx.fillRect(cabX, y + 9, cabW, CELL - 18);
        this.noGlow(ctx);
        ctx.fillStyle = c.parabrisas;
        ctx.fillRect(
          frontRight ? cabX + cabW - 9 : cabX + 2,
          y + 13,
          7,
          CELL - 26,
        );
        this.drawWheels(ctx, x, y, w);
        break;
      }
      case "log": {
        this.glow(ctx, c.tronco);
        ctx.fillStyle = c.tronco;
        ctx.fillRect(x + 1, y + 6, w - 2, CELL - 12);
        this.noGlow(ctx);
        ctx.strokeStyle = c.vetaTronco;
        ctx.lineWidth = this.lw(2);
        ctx.beginPath();
        for (let lx = x + 14; lx < x + w - 6; lx += 22) {
          ctx.moveTo(lx, y + 9);
          ctx.lineTo(lx, y + CELL - 9);
        }
        ctx.stroke();
        break;
      }
      case "turtle": {
        const hidden = isSubmerged(e);
        for (let k = 0; k < e.width; k++) {
          const cx = x + k * CELL + CELL / 2;
          const cy = y + CELL / 2;
          if (hidden) {
            ctx.strokeStyle = c.tortugaSumergida;
            ctx.lineWidth = this.lw(2);
            ctx.beginPath();
            if (duro) ctx.rect(cx - 12, cy - 12, 24, 24);
            else ctx.arc(cx, cy, 14, 0, Math.PI * 2);
            ctx.stroke();
            continue;
          }
          this.glow(ctx, c.tortuga);
          ctx.fillStyle = c.tortuga;
          ctx.beginPath();
          if (duro) ctx.rect(cx - 14, cy - 14, 28, 28);
          else ctx.arc(cx, cy, 15, 0, Math.PI * 2);
          ctx.fill();
          this.noGlow(ctx);
          ctx.strokeStyle = c.caparazon;
          ctx.lineWidth = this.lw(2);
          ctx.beginPath();
          if (duro) ctx.rect(cx - 8, cy - 8, 16, 16);
          else ctx.arc(cx, cy, 8, 0, Math.PI * 2);
          ctx.moveTo(cx - 8, cy);
          ctx.lineTo(cx + 8, cy);
          ctx.moveTo(cx, cy - 8);
          ctx.lineTo(cx, cy + 8);
          ctx.stroke();
        }
        if (!hidden) {
          // Cabeza al frente del grupo.
          const hx = frontRight ? x + w - 2 : x + 2;
          this.glow(ctx, c.tortuga);
          ctx.fillStyle = c.tortuga;
          ctx.beginPath();
          if (duro) ctx.rect(hx - 6, y + CELL / 2 - 6, 12, 12);
          else ctx.arc(hx, y + CELL / 2, 6, 0, Math.PI * 2);
          ctx.fill();
          this.noGlow(ctx);
        }
        break;
      }
    }
  }

  private drawWheels(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
  ) {
    const duro = this.skin.pixelado > 1;
    ctx.fillStyle = this.col.ruedas;
    const xs = [x + 9, x + w - 9];
    for (const wx of xs) {
      for (const wy of [y + 8, y + CELL - 8]) {
        ctx.beginPath();
        if (duro) ctx.rect(wx - 4, wy - 4, 8, 8);
        else ctx.arc(wx, wy, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawFrog(ctx: CanvasRenderingContext2D) {
    const f = this.frog;
    this.drawFrogShape(
      ctx,
      f.col * CELL + CELL / 2,
      f.row * CELL + CELL / 2,
      this.facing,
      f.animating,
    );
  }

  // Rana vista desde arriba, girada según hacia dónde mira; con las patas
  // extendidas mientras salta.
  private drawFrogShape(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    facing: Direction,
    leaping: boolean,
  ) {
    const c = this.col;
    const duro = this.skin.pixelado > 1;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(FACING_ANGLE[facing]);
    this.glow(ctx, c.rana);

    ctx.strokeStyle = c.rana;
    ctx.lineWidth = duro ? this.lw(5) : 5;
    ctx.lineCap = duro ? "square" : "round";
    const reach = leaping ? 1 : 0.6;
    ctx.beginPath();
    for (const sx of [-1, 1]) {
      ctx.moveTo(sx * 10, -6);
      ctx.lineTo(sx * 10 + sx * 8 * reach, -6 - 8 * reach);
      ctx.moveTo(sx * 10, 7);
      ctx.lineTo(sx * 10 + sx * 8 * reach, 7 + 8 * reach);
    }
    ctx.stroke();

    ctx.fillStyle = c.rana;
    ctx.beginPath();
    if (duro) ctx.rect(-11, -13, 22, 26);
    else ctx.ellipse(0, 0, 12, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    this.noGlow(ctx);

    for (const sx of [-1, 1]) {
      ctx.fillStyle = c.ojo;
      ctx.beginPath();
      if (duro) ctx.rect(sx * 6 - 4, -13, 8, 8);
      else ctx.arc(sx * 6, -9, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = c.pupila;
      ctx.beginPath();
      if (duro) ctx.rect(sx * 6 - 2, -12, 4, 4);
      else ctx.arc(sx * 6, -10, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Barra de tiempo de la ronda en la fila 14: verde → amarillo → rojo.
  private drawTimerBar(ctx: CanvasRenderingContext2D) {
    const c = this.col;
    const ratio = Math.max(0, Math.min(1, this.timeLeft / this.timeLimit));
    const y = ROW_TIMER * CELL + 12;
    ctx.fillStyle = c.barraFondo;
    ctx.fillRect(8, y, W - 16, 16);
    const barra =
      ratio > 0.5 ? c.barraBien : ratio > 0.25 ? c.barraAviso : c.barraPeligro;
    this.glow(ctx, barra);
    ctx.fillStyle = barra;
    ctx.fillRect(8, y, (W - 16) * ratio, 16);
    this.noGlow(ctx);
    ctx.strokeStyle = c.barraBorde;
    ctx.lineWidth = this.lw(2);
    ctx.strokeRect(8, y, W - 16, 16);
  }

  private loop = (ts: number) => {
    this.rafId = null;
    if (!this.paused) {
      const dt =
        this.lastTime === null
          ? 0
          : Math.min((ts - this.lastTime) / 1000, MAX_DT);
      this.lastTime = ts;
      this.update(dt);
      if (this.gameOver) return;
      this.draw();
      this.reportState();
    } else {
      this.lastTime = null;
    }
    this.rafId = requestAnimationFrame(this.loop);
  };
}

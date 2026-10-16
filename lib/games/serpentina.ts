// Motor de Snake (SERPENTINA), diseñado desde cero (spec 10). Las frutas salen de
// references/snake-assets/ (fruits.png + SPRITE_ATLAS de sprites.js), portadas aquí
// como constante de solo lectura en vez de depender de window.SPRITE_ATLAS.

import { DEFAULT_SKIN, getSkin } from "./skins";
import type {
  GameEngine,
  GameState,
  PerfSnapshot,
  SkinDefinition,
} from "./types";
import { FramePacer } from "./perf";

// ── Constants ─────────────────────────────────────────────────────────────────
const COLS = 20;
const ROWS = 15;
const CELL = 40; // 20×15 celdas de 40 px = lienzo lógico de 800×600
const W = COLS * CELL;
const H = ROWS * CELL;

const START_LENGTH = 3;
const FRUIT_POINTS = 10;
const FRUITS_PER_LEVEL = 5;
const BASE_TICK_MS = 140;
const TICK_STEP_MS = 10; // menos ms por tick en cada nivel
const MIN_TICK_MS = 60;
const MAX_DT = 0.05; // s
const MAX_PENDING_TURNS = 2;

const BOARD_LIGHT = "#a7d948";
const BOARD_DARK = "#8ecc39";
const SNAKE_COLOR = "#4675e9";
const FRUIT_FALLBACK_COLOR = "#e5392b";
const SNAKE_WIDTH = 28;
const FRUIT_SIZE = CELL - 8; // margen de 4 px

// Colores por skin. En clásico son los literales originales (sin cambios); en
// neón y retro salen de la paleta de la skin.
interface Colores {
  tableroClaro: string;
  tableroOscuro: string;
  serpiente: string;
  fruta: string;
  brilloFruta: string;
  ojo: string;
  pupila: string;
}

function coloresDe(skin: SkinDefinition): Colores {
  const p = skin.paleta;
  switch (skin.id) {
    case "neon":
      return {
        tableroClaro: "#12121c",
        tableroOscuro: p.fondo,
        serpiente: p.primario,
        fruta: p.secundario,
        brilloFruta: p.resalte,
        ojo: "#fff",
        pupila: p.fondo,
      };
    case "retro":
      return {
        tableroClaro: "#0c2c0c",
        tableroOscuro: p.fondo,
        serpiente: p.primario,
        fruta: p.alerta,
        brilloFruta: p.resalte,
        ojo: p.secundario,
        pupila: p.fondo,
      };
    default:
      return {
        tableroClaro: BOARD_LIGHT,
        tableroOscuro: BOARD_DARK,
        serpiente: SNAKE_COLOR,
        fruta: FRUIT_FALLBACK_COLOR,
        brilloFruta: FRUIT_FALLBACK_COLOR,
        ojo: "#fff",
        pupila: "#111",
      };
  }
}

const RETRO_NIVELES = 4; // niveles por canal al reducir la paleta de las frutas

const FRUITS_SRC = "/games/serpentina/fruits.png";

interface Cell {
  x: number;
  y: number;
}

interface Dir {
  dx: number;
  dy: number;
}

interface FruitSprite {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Fila central pixel-art de fruits.png (y = 136–295), de SPRITE_ATLAS.fruits.
const FRUITS: readonly FruitSprite[] = [
  { x: 34, y: 136, w: 110, h: 160 }, // banana
  { x: 186, y: 136, w: 150, h: 160 }, // orange
  { x: 378, y: 136, w: 110, h: 160 }, // grape
  { x: 540, y: 136, w: 130, h: 160 }, // garlic
  { x: 712, y: 136, w: 130, h: 160 }, // eggplant
  { x: 894, y: 136, w: 110, h: 160 }, // strawberry
  { x: 1066, y: 136, w: 110, h: 160 }, // cherry
  { x: 1228, y: 136, w: 130, h: 160 }, // carrot
  { x: 1400, y: 136, w: 130, h: 160 }, // mushroom
  { x: 1582, y: 136, w: 110, h: 160 }, // broccoli
  { x: 1734, y: 136, w: 150, h: 160 }, // watermelon
  { x: 1906, y: 136, w: 150, h: 160 }, // pepper
  { x: 2068, y: 136, w: 170, h: 160 }, // kiwi
  { x: 2250, y: 136, w: 140, h: 160 }, // lemon
  { x: 2432, y: 136, w: 130, h: 160 }, // peach
  { x: 2604, y: 136, w: 130, h: 160 }, // peanut
  { x: 2786, y: 136, w: 110, h: 160 }, // apple
  { x: 2948, y: 136, w: 130, h: 160 }, // tomato
  { x: 3110, y: 136, w: 150, h: 160 }, // berries
  { x: 3302, y: 136, w: 110, h: 160 }, // grapes2
  { x: 3454, y: 136, w: 150, h: 160 }, // pineapple
  { x: 3637, y: 136, w: 130, h: 160 }, // melon
];

const DIR_LEFT: Dir = { dx: -1, dy: 0 };
const DIR_RIGHT: Dir = { dx: 1, dy: 0 };
const DIR_UP: Dir = { dx: 0, dy: -1 };
const DIR_DOWN: Dir = { dx: 0, dy: 1 };

const KEY_DIRS: Record<string, Dir> = {
  ArrowLeft: DIR_LEFT,
  ArrowRight: DIR_RIGHT,
  ArrowUp: DIR_UP,
  ArrowDown: DIR_DOWN,
  a: DIR_LEFT,
  d: DIR_RIGHT,
  w: DIR_UP,
  s: DIR_DOWN,
};

const sameDir = (a: Dir, b: Dir) => a.dx === b.dx && a.dy === b.dy;
const isOpposite = (a: Dir, b: Dir) => a.dx === -b.dx && a.dy === -b.dy;

export class SerpentinaGame implements GameEngine {
  private ctx: CanvasRenderingContext2D;
  private img: HTMLImageElement;
  private skin: SkinDefinition;
  private retroImg: HTMLCanvasElement | null = null; // frutas con paleta reducida
  private lowCanvas: HTMLCanvasElement | null = null;
  private lowCtx: CanvasRenderingContext2D | null = null;

  // snake[0] es la cabeza, el último elemento es la cola.
  private snake: Cell[] = [];
  private dir: Dir = DIR_RIGHT;
  private pendingTurns: Dir[] = [];
  private fruit: Cell = { x: 0, y: 0 };
  private fruitSprite: FruitSprite = FRUITS[0];
  private eaten = 0;
  private score = 0;
  private gameOver = false;
  private tickAcc = 0; // ms

  private imgLoaded = false;
  private destroyed = false;
  private paused = false;
  private lastTime: number | null = null;
  private pacer = new FramePacer(60);
  private rafId: number | null = null;
  private onStateChangeCb: ((s: GameState) => void) | null = null;
  private lastReported: GameState | null = null;

  private get level() {
    return 1 + Math.floor(this.eaten / FRUITS_PER_LEVEL);
  }

  private get tickMs() {
    return Math.max(
      MIN_TICK_MS,
      BASE_TICK_MS - (this.level - 1) * TICK_STEP_MS,
    );
  }

  // Ignora teclas con modificadores y cualquier campo de texto (p. ej. el nombre
  // del modal de fin de partida), para no bloquear letras como "a", "s", "w", "d".
  private gameDir(e: KeyboardEvent): Dir | null {
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
    const last = this.pendingTurns[this.pendingTurns.length - 1] ?? this.dir;
    if (sameDir(dir, last) || isOpposite(dir, last)) return;
    if (this.pendingTurns.length >= MAX_PENDING_TURNS) return;
    this.pendingTurns.push(dir);
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    if (this.gameDir(e)) e.preventDefault();
  };

  constructor(canvas: HTMLCanvasElement, skin?: SkinDefinition) {
    this.skin = skin ?? getSkin(DEFAULT_SKIN);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas");
    this.ctx = ctx;

    document.addEventListener("keydown", this.handleKeyDown);
    document.addEventListener("keyup", this.handleKeyUp);

    this.img = new Image();
    this.img.onload = () => {
      if (this.destroyed) return;
      this.imgLoaded = true;
      // Si el juego está en pausa o terminado el loop no dibuja: repinta una vez
      // para que la fruta de respaldo pase a sprite.
      this.draw();
    };
    this.img.onerror = () =>
      console.error("No se pudo cargar las frutas de SERPENTINA");
    this.img.src = FRUITS_SRC;

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
  // repinta siempre para que pausa y fin de partida muestren la skin nueva.
  setSkin(skin: SkinDefinition) {
    this.skin = skin;
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
    this.img.onload = null;
    this.img.onerror = null;
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

  private initGame() {
    const cx = Math.floor(COLS / 2);
    const cy = Math.floor(ROWS / 2);
    this.snake = [];
    for (let i = 0; i < START_LENGTH; i++)
      this.snake.push({ x: cx - i, y: cy });
    this.dir = DIR_RIGHT;
    this.pendingTurns = [];
    this.eaten = 0;
    this.score = 0;
    this.gameOver = false;
    this.tickAcc = 0;
    this.lastTime = null;
    this.spawnFruit();
  }

  // ── Reglas ──────────────────────────────────────────────────────────────────
  // Elige entre las celdas libres (no por reintentos). Devuelve false si el
  // tablero está lleno.
  private spawnFruit(): boolean {
    const occupied = new Set(this.snake.map((c) => c.y * COLS + c.x));
    const free: Cell[] = [];
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++)
        if (!occupied.has(y * COLS + x)) free.push({ x, y });
    if (free.length === 0) return false;
    this.fruit = free[Math.floor(Math.random() * free.length)];
    this.fruitSprite = FRUITS[Math.floor(Math.random() * FRUITS.length)];
    return true;
  }

  private step() {
    const turn = this.pendingTurns.shift();
    if (turn) this.dir = turn;

    const head = this.snake[0];
    const next: Cell = { x: head.x + this.dir.dx, y: head.y + this.dir.dy };

    if (next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS) {
      this.endGame();
      return;
    }

    const eating = next.x === this.fruit.x && next.y === this.fruit.y;
    // Si no come, la cola se mueve en este mismo tick y su celda queda libre.
    const bodyEnd = eating ? this.snake.length : this.snake.length - 1;
    for (let i = 0; i < bodyEnd; i++) {
      if (this.snake[i].x === next.x && this.snake[i].y === next.y) {
        this.endGame();
        return;
      }
    }

    this.snake.unshift(next);
    if (!eating) {
      this.snake.pop();
      return;
    }

    this.eaten++;
    this.score += FRUIT_POINTS;
    if (!this.spawnFruit()) this.endGame(); // tablero lleno
  }

  private update(dt: number) {
    this.tickAcc += dt * 1000;
    while (this.tickAcc >= this.tickMs && !this.gameOver) {
      this.tickAcc -= this.tickMs;
      this.step();
    }
  }

  // Único camino de fin de partida (choque, tablero lleno y FIN): emite el
  // estado una vez y detiene el loop.
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
      lives: null,
      level: this.level,
      gameOver: this.gameOver,
    };
    const last = this.lastReported;
    if (
      !last ||
      last.score !== s.score ||
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

    const col = coloresDe(skin);
    ctx.imageSmoothingEnabled = skin.suavizado;

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        ctx.fillStyle =
          (x + y) % 2 === 0 ? col.tableroClaro : col.tableroOscuro;
        ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
      }
    }

    this.drawFruit(ctx, skin, col);
    this.drawSnake(ctx, skin, col);

    if (ctx !== main && this.lowCanvas) {
      main.imageSmoothingEnabled = false;
      main.drawImage(this.lowCanvas, 0, 0, W, H);
    } else {
      main.imageSmoothingEnabled = skin.suavizado;
    }
  }

  // Copia de las frutas con la paleta reducida (4 niveles por canal), creada
  // una sola vez la primera vez que se usa retro.
  private getRetroImg(): CanvasImageSource {
    if (this.retroImg) return this.retroImg;
    try {
      const c = document.createElement("canvas");
      c.width = this.img.naturalWidth;
      c.height = this.img.naturalHeight;
      const cx = c.getContext("2d");
      if (!cx) return this.img;
      cx.drawImage(this.img, 0, 0);
      const data = cx.getImageData(0, 0, c.width, c.height);
      const d = data.data;
      const k = 255 / (RETRO_NIVELES - 1);
      for (let i = 0; i < d.length; i += 4) {
        d[i] = Math.round(d[i] / k) * k;
        d[i + 1] = Math.round(d[i + 1] / k) * k;
        d[i + 2] = Math.round(d[i + 2] / k) * k;
        d[i + 3] = d[i + 3] < 128 ? 0 : 255; // sin semitransparencias
      }
      cx.putImageData(data, 0, 0);
      this.retroImg = c;
      return c;
    } catch {
      return this.img;
    }
  }

  private drawFruit(
    ctx: CanvasRenderingContext2D,
    skin: SkinDefinition,
    col: Colores,
  ) {
    const { fruit, fruitSprite: s } = this;
    const cx = fruit.x * CELL + CELL / 2;
    const cy = fruit.y * CELL + CELL / 2;
    ctx.save();
    if (skin.brillo > 0) {
      ctx.shadowColor = col.brilloFruta;
      ctx.shadowBlur = skin.brillo;
    }
    if (!this.imgLoaded) {
      ctx.fillStyle = col.fruta;
      ctx.beginPath();
      ctx.arc(cx, cy, FRUIT_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    const scale = Math.min(FRUIT_SIZE / s.w, FRUIT_SIZE / s.h);
    const dw = s.w * scale;
    const dh = s.h * scale;
    const src = skin.id === "retro" ? this.getRetroImg() : this.img;
    ctx.drawImage(src, s.x, s.y, s.w, s.h, cx - dw / 2, cy - dh / 2, dw, dh);
    ctx.restore();
  }

  private drawSnake(
    ctx: CanvasRenderingContext2D,
    skin: SkinDefinition,
    col: Colores,
  ) {
    const { snake } = this;
    const duro = skin.pixelado > 1;
    const center = (c: Cell) => ({
      x: c.x * CELL + CELL / 2,
      y: c.y * CELL + CELL / 2,
    });

    ctx.save();
    if (skin.brillo > 0) {
      ctx.shadowColor = col.serpiente;
      ctx.shadowBlur = skin.brillo;
    }
    ctx.strokeStyle = col.serpiente;
    ctx.lineWidth = SNAKE_WIDTH;
    ctx.lineCap = duro ? "square" : "round";
    ctx.lineJoin = duro ? "miter" : "round";
    ctx.beginPath();
    snake.forEach((c, i) => {
      const p = center(c);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.restore();

    // Ojos: desplazados a los lados de la dirección en que mira la cabeza.
    const head = center(snake[0]);
    const { dx, dy } = this.dir;
    const fx = dx * 6;
    const fy = dy * 6;
    const px = -dy * 7;
    const py = dx * 7;
    for (const sign of [1, -1]) {
      const ex = head.x + fx + px * sign;
      const ey = head.y + fy + py * sign;
      ctx.fillStyle = col.ojo;
      ctx.beginPath();
      ctx.arc(ex, ey, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = col.pupila;
      ctx.beginPath();
      ctx.arc(ex + dx * 1.5, ey + dy * 1.5, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  getPerf(): PerfSnapshot {
    return this.pacer.snapshot();
  }

  private loop = (ts: number) => {
    if (!this.pacer.shouldRun(ts)) {
      this.rafId = requestAnimationFrame(this.loop);
      return;
    }
    this.rafId = null;
    if (!this.paused) {
      const dt =
        this.lastTime === null
          ? 0
          : Math.min((ts - this.lastTime) / 1000, MAX_DT);
      this.lastTime = ts;
      this.pacer.begin();
      this.update(dt);
      if (this.gameOver) {
        this.pacer.end();
        return;
      }
      this.draw();
      this.pacer.end();
      this.reportState();
    } else {
      this.lastTime = null;
    }
    this.rafId = requestAnimationFrame(this.loop);
  };
}

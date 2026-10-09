// Motor de Arkanoid (BLOQUE BUSTER) portado de references/started-games/04-arkanoid/
// (game.js, levels.js, assets/spritesheet.js), encapsulado en una clase agnóstica de React.

import { DEFAULT_SKIN, getSkin, grosorTrazo } from "./skins";
import type { GameEngine, GameState, SkinDefinition } from "./types";

// ── Constants ─────────────────────────────────────────────────────────────────
const W = 800;
const H = 600;

const PADDLE_SPEED = 400;
const PADDLE_W = 81;
const PADDLE_H = 14;
const PADDLE_Y = 560;
const BALL_SIZE = 16;
const BLOCK_COLS = 10;
const BLOCK_W = 64;
const BLOCK_H = 24;
const BLOCKS_ORIGIN_X = (W - BLOCK_COLS * BLOCK_W) / 2;
const BLOCKS_ORIGIN_Y = 80;
const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;
const BLOCK_POINTS = 10;
const START_LIVES = 3;
const MAX_DT = 0.05; // s
const EXPLOSION_DURATION = 150; // ms
const EXPLOSION_FRAME_COUNT = 4;

const SPRITESHEET_SRC = "/games/bloque-buster/spritesheet-breakout.png";

type BlockColor =
  "red" | "yellow" | "cyan" | "magenta" | "hotpink" | "green" | "gray";

interface Frame {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

// Posiciones en spritesheet-breakout.png (de assets/spritesheet.js del original).
const PADDLE_SPRITE: Frame = { sx: 32, sy: 112, sw: 162, sh: 14 };
const BALL_SPRITE: Frame = { sx: 32, sy: 32, sw: 16, sh: 16 };
const BLOCK_SPRITE_Y: Record<BlockColor, number> = {
  gray: 288,
  red: 176,
  yellow: 240,
  cyan: 192,
  magenta: 224,
  hotpink: 256,
  green: 208,
};
// Cada color tiene una fila de 4 frames de 32×16 a partir de x = 256.
// `gray` reutiliza la fila de `red`, igual que el original.
const EXPLOSION_SPRITE_Y: Record<BlockColor, number> = {
  red: 176,
  cyan: 192,
  green: 208,
  magenta: 224,
  yellow: 240,
  hotpink: 256,
  gray: 176,
};

// Colores de bloque por skin. `clasico` usa los sprites originales; neón y
// retro dibujan con primitivas y estas paletas (retro: paleta reducida estilo NES).
const NEON_BLOCK: Record<BlockColor, string> = {
  red: "#ff8200",
  yellow: "#f5ff00", // --yellow
  cyan: "#00f5ff", // --cyan
  magenta: "#c77dff",
  hotpink: "#ff006e", // --magenta
  green: "#00ff88", // --green
  gray: "#e6e6f0",
};
const RETRO_BLOCK: Record<BlockColor, string> = {
  red: "#fc5454",
  yellow: "#fcfc54",
  cyan: "#54fcfc",
  magenta: "#fc54fc",
  hotpink: "#fc9838",
  green: "#58f858",
  gray: "#fcfcfc",
};

interface LevelBlock {
  col: number;
  row: number;
  color: BlockColor;
}

interface Level {
  speed: number;
  blocks: LevelBlock[];
}

const buildLevels = (): Level[] => {
  const rowColors1: BlockColor[] = [
    "red",
    "yellow",
    "cyan",
    "magenta",
    "hotpink",
    "green",
  ];
  const rowColors2: BlockColor[] = [
    "gray",
    "cyan",
    "hotpink",
    "yellow",
    "magenta",
    "green",
  ];
  const rowColors4: BlockColor[] = [
    "cyan",
    "magenta",
    "green",
    "yellow",
    "hotpink",
    "red",
  ];

  const l1: LevelBlock[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      l1.push({ col, row, color: rowColors1[row] });

  const l2: LevelBlock[] = [];
  const pyStart = [4, 3, 2, 1, 0, 0];
  const pyEnd = [5, 6, 7, 8, 9, 9];
  for (let row = 0; row < 6; row++)
    for (let col = pyStart[row]; col <= pyEnd[row]; col++)
      l2.push({ col, row, color: rowColors2[row] });

  const l3: LevelBlock[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      if ((col + row) % 2 === 0)
        l3.push({ col, row, color: row < 3 ? "yellow" : "magenta" });

  const gaps4 = [
    [2, 5, 8],
    [0, 4, 7, 9],
    [1, 3, 6],
    [2, 5, 8, 9],
    [0, 4, 7],
    [1, 3, 6, 9],
  ];
  const l4: LevelBlock[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      if (!gaps4[row].includes(col))
        l4.push({ col, row, color: rowColors4[row] });

  const l5: LevelBlock[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++) {
      const isFrame = col === 0 || col === 9 || row === 0 || row === 5;
      const isCross = col === 4 || row === 2;
      if (isFrame || isCross)
        l5.push({
          col,
          row,
          color: isCross && !isFrame ? "hotpink" : "cyan",
        });
    }

  return [
    { speed: 1.0, blocks: l1 },
    { speed: 1.1, blocks: l2 },
    { speed: 1.21, blocks: l3 },
    { speed: 1.33, blocks: l4 },
    { speed: 1.46, blocks: l5 },
  ];
};

const LEVELS = buildLevels();
const LAST_LEVEL = LEVELS.length;

interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  alive: boolean;
}

interface Explosion {
  x: number;
  y: number;
  w: number;
  h: number;
  color: BlockColor;
  elapsed: number; // ms
}

export class BloqueBusterGame implements GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sheet: HTMLImageElement;
  private skin: SkinDefinition;
  // Lienzo auxiliar de baja resolución para los píxeles gruesos (retro).
  private lowCanvas: HTMLCanvasElement | null = null;
  private lowCtx: CanvasRenderingContext2D | null = null;

  private paddle = { x: 0, y: PADDLE_Y, w: PADDLE_W, h: PADDLE_H };
  private ball = { x: 0, y: 0, w: BALL_SIZE, h: BALL_SIZE, vx: 0, vy: 0 };
  private blocks: Block[] = [];
  private explosions: Explosion[] = [];
  private lives = START_LIVES;
  private score = 0;
  private level = 1;
  private gameOver = false;
  private keys = { ArrowLeft: false, ArrowRight: false };

  private loaded = false;
  private started = false;
  private destroyed = false;
  private paused = false;
  private lastTime: number | null = null;
  private rafId: number | null = null;
  private onStateChangeCb: ((s: GameState) => void) | null = null;
  private lastReported: GameState | null = null;

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      return;
    }
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    this.keys[e.key] = true;
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    this.keys[e.key] = false;
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (this.paused || this.gameOver) return;
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const mouseX = (e.clientX - rect.left) * scaleX;
    this.paddle.x = Math.max(
      0,
      Math.min(W - this.paddle.w, mouseX - this.paddle.w / 2),
    );
  };

  constructor(canvas: HTMLCanvasElement, skin?: SkinDefinition) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas");
    this.canvas = canvas;
    this.ctx = ctx;
    this.skin = skin ?? getSkin(DEFAULT_SKIN);

    document.addEventListener("keydown", this.handleKeyDown);
    document.addEventListener("keyup", this.handleKeyUp);
    canvas.addEventListener("mousemove", this.handleMouseMove);

    this.sheet = new Image();
    this.sheet.onload = () => {
      if (this.destroyed) return;
      this.loaded = true;
      if (this.started) this.begin();
    };
    this.sheet.onerror = () =>
      console.error("No se pudo cargar el spritesheet de BLOQUE BUSTER");
    this.sheet.src = SPRITESHEET_SRC;

    this.initGame();
  }

  onStateChange(cb: (s: GameState) => void) {
    this.onStateChangeCb = cb;
  }

  start() {
    if (this.destroyed) return;
    this.started = true;
    this.reportState();
    if (this.loaded) this.begin();
  }

  setSkin(skin: SkinDefinition) {
    this.skin = skin;
    // Con el loop detenido (pausa o fin) se redibuja el frame con la nueva skin.
    if (this.started && this.loaded && (this.paused || this.gameOver))
      this.draw();
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
    this.sheet.onload = null;
    this.sheet.onerror = null;
    document.removeEventListener("keydown", this.handleKeyDown);
    document.removeEventListener("keyup", this.handleKeyUp);
    this.canvas.removeEventListener("mousemove", this.handleMouseMove);
  }

  // Arranca dibujo y loop una vez que hay spritesheet y start() ya fue llamado.
  private begin() {
    this.lastTime = null;
    this.draw();
    this.reportState();
    this.startLoop();
  }

  private startLoop() {
    if (
      this.rafId === null &&
      this.loaded &&
      !this.destroyed &&
      !this.gameOver
    ) {
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
    this.score = 0;
    this.lives = START_LIVES;
    this.gameOver = false;
    this.lastTime = null;
    this.paddle.x = (W - this.paddle.w) / 2;
    this.loadLevel(1);
  }

  // ── Reglas ──────────────────────────────────────────────────────────────────
  private placeBall() {
    const { speed } = LEVELS[this.level - 1];
    this.ball.x = this.paddle.x + (this.paddle.w - this.ball.w) / 2;
    this.ball.y = this.paddle.y - this.ball.h;
    this.ball.vx = BASE_BALL_VX * speed;
    this.ball.vy = BASE_BALL_VY * speed;
  }

  private loadLevel(n: number) {
    this.level = n;
    this.blocks = LEVELS[n - 1].blocks.map((b) => ({
      x: BLOCKS_ORIGIN_X + b.col * BLOCK_W,
      y: BLOCKS_ORIGIN_Y + b.row * BLOCK_H,
      w: BLOCK_W,
      h: BLOCK_H,
      color: b.color,
      alive: true,
    }));
    this.explosions = [];
    this.placeBall();
  }

  private collideAABB(block: Block): boolean {
    const { ball } = this;
    return (
      ball.x < block.x + block.w &&
      ball.x + ball.w > block.x &&
      ball.y < block.y + block.h &&
      ball.y + ball.h > block.y
    );
  }

  private update(dt: number) {
    const { ball, paddle } = this;

    if (this.keys.ArrowLeft)
      paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (this.keys.ArrowRight)
      paddle.x = Math.min(W - paddle.w, paddle.x + PADDLE_SPEED * dt);

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
    }
    if (ball.x + ball.w >= W) {
      ball.x = W - ball.w;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
    }

    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
    }

    // Un bloque por frame, como el original.
    for (const block of this.blocks) {
      if (!block.alive) continue;
      if (this.collideAABB(block)) {
        block.alive = false;
        this.explosions.push({
          x: block.x,
          y: block.y,
          w: block.w,
          h: block.h,
          color: block.color,
          elapsed: 0,
        });
        this.score += BLOCK_POINTS;
        ball.vy = -ball.vy;
        if (this.blocks.every((b) => !b.alive)) {
          if (this.level < LAST_LEVEL) this.loadLevel(this.level + 1);
          else this.endGame();
        }
        break;
      }
    }
    if (this.gameOver) return;

    for (const exp of this.explosions) exp.elapsed += dt * 1000;
    this.explosions = this.explosions.filter(
      (exp) => exp.elapsed < EXPLOSION_DURATION,
    );

    if (ball.y > H) {
      this.lives--;
      if (this.lives <= 0) {
        this.lives = 0;
        this.endGame();
      } else {
        this.placeBall();
      }
    }
  }

  // Único camino de fin de partida (sin vidas, victoria en el nivel 5 y FIN):
  // emite el estado una vez y detiene el loop.
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
  private drawFrame(frame: Frame, x: number, y: number, w: number, h: number) {
    this.ctx.drawImage(
      this.sheet,
      frame.sx,
      frame.sy,
      frame.sw,
      frame.sh,
      x,
      y,
      w,
      h,
    );
  }

  private draw() {
    const skin = this.skin;
    if (skin.id === "clasico") {
      this.drawClasico();
      return;
    }
    const px = skin.pixelado;
    const main = this.ctx;
    let ctx = main;
    if (px > 1) {
      // Se dibuja en un lienzo W/px x H/px (coordenadas lógicas intactas vía
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
    ctx.fillStyle = skin.paleta.fondo;
    ctx.fillRect(0, 0, W, H);
    this.drawPrimitivas(ctx, skin, ctx !== main);
    if (ctx !== main && this.lowCanvas) {
      main.imageSmoothingEnabled = false;
      main.drawImage(this.lowCanvas, 0, 0, W, H);
    } else {
      main.imageSmoothingEnabled = true;
    }
  }

  // Neón y retro: formas con primitivas, sin spritesheet.
  private drawPrimitivas(
    ctx: CanvasRenderingContext2D,
    skin: SkinDefinition,
    gruesos: boolean,
  ) {
    const retro = skin.pixelado > 1;
    const colores = retro ? RETRO_BLOCK : NEON_BLOCK;
    const p = skin.pixelado;
    // En retro todo se ajusta a la rejilla de píxeles gruesos.
    const snap = (v: number) => (gruesos ? Math.round(v / p) * p : v);

    const caja = (
      x: number,
      y: number,
      w: number,
      h: number,
      color: string,
      relleno: boolean,
    ) => {
      ctx.save();
      if (skin.brillo > 0) {
        ctx.shadowColor = color;
        ctx.shadowBlur = skin.brillo;
      }
      if (relleno) {
        ctx.fillStyle = color;
        ctx.fillRect(snap(x), snap(y), snap(w), snap(h));
      } else {
        const g = grosorTrazo(skin, 1);
        ctx.strokeStyle = color;
        ctx.lineWidth = g;
        ctx.strokeRect(x + g / 2, y + g / 2, w - g, h - g);
      }
      ctx.restore();
    };

    for (const block of this.blocks) {
      if (!block.alive) continue;
      const c = colores[block.color];
      if (retro) {
        // Borde oscuro de un píxel grueso para separar bloques.
        caja(block.x, block.y, block.w, block.h, c, true);
        ctx.fillStyle = skin.paleta.fondo;
        ctx.fillRect(block.x, block.y + block.h - p, block.w, p);
        ctx.fillRect(block.x + block.w - p, block.y, p, block.h);
      } else {
        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = c;
        ctx.fillRect(block.x + 1, block.y + 1, block.w - 2, block.h - 2);
        ctx.restore();
        caja(block.x + 1, block.y + 1, block.w - 2, block.h - 2, c, false);
      }
    }

    for (const exp of this.explosions) {
      const t = Math.min(exp.elapsed / EXPLOSION_DURATION, 1);
      const c = colores[exp.color];
      if (retro) {
        // 4 pasos: el bloque se encoge sin transparencia.
        const paso = Math.min(Math.floor(t * EXPLOSION_FRAME_COUNT), 3);
        const m = paso * p;
        caja(exp.x + m, exp.y + m, exp.w - 2 * m, exp.h - 2 * m, c, true);
      } else {
        const m = -t * 8;
        ctx.save();
        ctx.globalAlpha = 1 - t;
        caja(exp.x + m, exp.y + m, exp.w - 2 * m, exp.h - 2 * m, c, false);
        ctx.restore();
      }
    }

    const { paddle, ball } = this;
    if (retro) {
      caja(paddle.x, paddle.y, paddle.w, paddle.h, skin.paleta.primario, true);
      caja(ball.x, ball.y, ball.w, ball.h, skin.paleta.secundario, true);
    } else {
      caja(paddle.x, paddle.y, paddle.w, paddle.h, skin.paleta.primario, true);
      ctx.save();
      ctx.fillStyle = skin.paleta.resalte;
      ctx.shadowColor = skin.paleta.resalte;
      ctx.shadowBlur = skin.brillo;
      ctx.beginPath();
      ctx.arc(
        ball.x + ball.w / 2,
        ball.y + ball.h / 2,
        ball.w / 2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();
    }
  }

  // Skin clásica: spritesheet original, sin cambios.
  private drawClasico() {
    const { ctx } = this;
    ctx.fillStyle = this.skin.paleta.fondo;
    ctx.fillRect(0, 0, W, H);
    if (!this.loaded) return;

    for (const block of this.blocks) {
      if (!block.alive) continue;
      this.drawFrame(
        { sx: 32, sy: BLOCK_SPRITE_Y[block.color], sw: 32, sh: 16 },
        block.x,
        block.y,
        block.w,
        block.h,
      );
    }

    for (const exp of this.explosions) {
      const i = Math.min(
        Math.floor((exp.elapsed / EXPLOSION_DURATION) * EXPLOSION_FRAME_COUNT),
        EXPLOSION_FRAME_COUNT - 1,
      );
      this.drawFrame(
        { sx: 256 + i * 32, sy: EXPLOSION_SPRITE_Y[exp.color], sw: 32, sh: 16 },
        exp.x,
        exp.y,
        exp.w,
        exp.h,
      );
    }

    const { paddle, ball } = this;
    this.drawFrame(PADDLE_SPRITE, paddle.x, paddle.y, paddle.w, paddle.h);
    this.drawFrame(BALL_SPRITE, ball.x, ball.y, ball.w, ball.h);
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

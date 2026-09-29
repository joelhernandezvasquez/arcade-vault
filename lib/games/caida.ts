// Motor de Tetris (CAÍDA) portado de references/started-games/03-tetris/game.js,
// encapsulado en una clase agnóstica de React.

import type { GameEngine, GameState } from "./types";

// ── Constants ─────────────────────────────────────────────────────────────────
const W = 800;
const H = 600;
const COLS = 10;
const ROWS = 20;
const BLOCK = 30;
const BOARD_X = (W - COLS * BLOCK) / 2; // 250

const COLORS: (string | null)[] = [
  null,
  "#4dd0e1", // I - cyan
  "#ffd54f", // O - yellow
  "#ba68c8", // T - purple
  "#81c784", // S - green
  "#e57373", // Z - red
  "#90caf9", // J - pale blue
  "#ffb74d", // L - orange
  "#9e9e9e", // N - tuerca (gris metálico)
];

const PIECES: (number[][] | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // N (tuerca)
];

const LINE_SCORES = [0, 100, 300, 500, 800];
const KICKS = [0, -1, 1, -2, 2];
const MAX_DT = 50; // ms

const BG = "#07070d";
const BOARD_BG = "#0d0d18";
const GRID_LINE = "rgba(255,255,255,0.07)";
const PANEL_TITLE = "#ff2bd6";
const PANEL_TEXT = "#c9c9d6";
const PANEL_DIM = "#7a7a8c";

interface Piece {
  type: number;
  shape: number[][];
  x: number;
  y: number;
}

const createBoard = (): number[][] =>
  Array.from({ length: ROWS }, () => new Array<number>(COLS).fill(0));

const randomPiece = (): Piece => {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type]!.map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
};

const rotateCW = (shape: number[][]): number[][] => {
  const rows = shape.length;
  const cols = shape[0].length;
  const result = Array.from({ length: cols }, () =>
    new Array<number>(rows).fill(0),
  );
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  return result;
};

export class CaidaGame implements GameEngine {
  private ctx: CanvasRenderingContext2D;

  private board: number[][] = createBoard();
  private current!: Piece;
  private next!: Piece;
  private score = 0;
  private lines = 0;
  private level = 1;
  private gameOver = false;
  private dropAccum = 0;
  private dropInterval = 1000;

  private paused = false;
  private lastTime: number | null = null;
  private rafId: number | null = null;
  private onStateChangeCb: ((s: GameState) => void) | null = null;
  private lastReported: GameState | null = null;

  private handleKeyDown = (e: KeyboardEvent) => {
    switch (e.code) {
      case "ArrowLeft":
      case "ArrowRight":
      case "ArrowDown":
      case "ArrowUp":
      case "KeyX":
      case "Space":
        e.preventDefault();
        break;
      default:
        return;
    }
    if (this.paused || this.gameOver) return;

    switch (e.code) {
      case "ArrowLeft":
        if (
          !this.collide(this.current.shape, this.current.x - 1, this.current.y)
        )
          this.current.x--;
        break;
      case "ArrowRight":
        if (
          !this.collide(this.current.shape, this.current.x + 1, this.current.y)
        )
          this.current.x++;
        break;
      case "ArrowDown":
        this.softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        this.tryRotate();
        break;
      case "Space":
        this.hardDrop();
        break;
    }
    this.draw();
    this.reportState();
  };

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas");
    this.ctx = ctx;
    document.addEventListener("keydown", this.handleKeyDown);
    this.initGame();
  }

  onStateChange(cb: (s: GameState) => void) {
    this.onStateChangeCb = cb;
  }

  start() {
    this.lastTime = null;
    this.draw();
    this.reportState();
    this.startLoop();
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    this.lastTime = null;
  }

  reset() {
    this.initGame();
    this.draw();
    this.reportState();
    this.startLoop();
  }

  forceGameOver() {
    this.endGame();
  }

  destroy() {
    this.stopLoop();
    document.removeEventListener("keydown", this.handleKeyDown);
  }

  private startLoop() {
    if (this.rafId === null && !this.gameOver) {
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
    this.board = createBoard();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.gameOver = false;
    this.dropInterval = 1000;
    this.dropAccum = 0;
    this.lastTime = null;
    this.next = randomPiece();
    this.spawn();
  }

  // ── Reglas ──────────────────────────────────────────────────────────────────
  private collide(shape: number[][], ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && this.board[ny][nx]) return true;
      }
    }
    return false;
  }

  private tryRotate() {
    const rotated = rotateCW(this.current.shape);
    for (const kick of KICKS) {
      if (!this.collide(rotated, this.current.x + kick, this.current.y)) {
        this.current.shape = rotated;
        this.current.x += kick;
        return;
      }
    }
  }

  private merge() {
    const { shape, x, y } = this.current;
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        if (shape[r][c]) this.board[y + r][x + c] = shape[r][c];
  }

  private clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.board[r].every((v) => v !== 0)) {
        this.board.splice(r, 1);
        this.board.unshift(new Array<number>(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      this.lines += cleared;
      this.score += (LINE_SCORES[cleared] || 0) * this.level;
      this.level = Math.floor(this.lines / 10) + 1;
      this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 90);
    }
  }

  private ghostY(): number {
    let gy = this.current.y;
    while (!this.collide(this.current.shape, this.current.x, gy + 1)) gy++;
    return gy;
  }

  private hardDrop() {
    const gy = this.ghostY();
    this.score += (gy - this.current.y) * 2;
    this.current.y = gy;
    this.lockPiece();
  }

  private softDrop() {
    if (!this.collide(this.current.shape, this.current.x, this.current.y + 1)) {
      this.current.y++;
      this.score += 1;
    } else {
      this.lockPiece();
    }
  }

  private lockPiece() {
    this.merge();
    this.clearLines();
    this.spawn();
  }

  private spawn() {
    this.current = this.next;
    this.next = randomPiece();
    if (this.collide(this.current.shape, this.current.x, this.current.y)) {
      this.endGame();
    }
  }

  // Único camino de fin de partida: emite el estado una vez y detiene el loop.
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
  private drawBlock(
    x: number,
    y: number,
    colorIndex: number,
    ox: number,
    oy: number,
    alpha = 1,
  ) {
    if (!colorIndex) return;
    const { ctx } = this;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLORS[colorIndex]!;
    ctx.fillRect(ox + x * BLOCK + 1, oy + y * BLOCK + 1, BLOCK - 2, BLOCK - 2);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(ox + x * BLOCK + 1, oy + y * BLOCK + 1, BLOCK - 2, 4);
    ctx.globalAlpha = 1;
  }

  private drawGrid() {
    const { ctx } = this;
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let c = 1; c < COLS; c++) {
      ctx.moveTo(BOARD_X + c * BLOCK, 0);
      ctx.lineTo(BOARD_X + c * BLOCK, ROWS * BLOCK);
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.moveTo(BOARD_X, r * BLOCK);
      ctx.lineTo(BOARD_X + COLS * BLOCK, r * BLOCK);
    }
    ctx.stroke();
  }

  private drawNext() {
    const { ctx } = this;
    const cx = BOARD_X / 2; // centro del panel izquierdo
    ctx.textAlign = "center";
    ctx.fillStyle = PANEL_TITLE;
    ctx.font = "bold 20px monospace";
    ctx.fillText("NEXT", cx, 60);

    const size = 4 * BLOCK;
    const px = cx - size / 2;
    const py = 84;
    ctx.fillStyle = BOARD_BG;
    ctx.fillRect(px, py, size, size);
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);

    const shape = this.next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        this.drawBlock(offX + c, offY + r, shape[r][c], px, py);
  }

  private drawControls() {
    const { ctx } = this;
    const cx = BOARD_X + COLS * BLOCK + BOARD_X / 2; // centro del panel derecho
    ctx.textAlign = "center";
    ctx.fillStyle = PANEL_TITLE;
    ctx.font = "bold 20px monospace";
    ctx.fillText("CONTROLES", cx, 60);

    const rows: [string, string][] = [
      ["← →", "mover"],
      ["↑ / X", "rotar"],
      ["↓", "bajar"],
      ["ESPACIO", "caída"],
    ];
    rows.forEach(([key, action], i) => {
      const y = 110 + i * 56;
      ctx.fillStyle = PANEL_TEXT;
      ctx.font = "bold 18px monospace";
      ctx.fillText(key, cx, y);
      ctx.fillStyle = PANEL_DIM;
      ctx.font = "16px monospace";
      ctx.fillText(action, cx, y + 22);
    });
  }

  private draw() {
    const { ctx } = this;
    ctx.globalAlpha = 1;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = BOARD_BG;
    ctx.fillRect(BOARD_X, 0, COLS * BLOCK, ROWS * BLOCK);
    this.drawGrid();

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        this.drawBlock(c, r, this.board[r][c], BOARD_X, 0);

    const { shape, x, y } = this.current;
    const gy = this.ghostY();
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        if (shape[r][c])
          this.drawBlock(x + c, gy + r, shape[r][c], BOARD_X, 0, 0.2);

    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        this.drawBlock(x + c, y + r, shape[r][c], BOARD_X, 0);

    this.drawNext();
    this.drawControls();
  }

  private loop = (ts: number) => {
    this.rafId = null;
    if (!this.paused) {
      const dt =
        this.lastTime === null ? 0 : Math.min(ts - this.lastTime, MAX_DT);
      this.lastTime = ts;
      this.dropAccum += dt;
      if (this.dropAccum >= this.dropInterval) {
        this.dropAccum = 0;
        if (
          !this.collide(this.current.shape, this.current.x, this.current.y + 1)
        )
          this.current.y++;
        else this.lockPiece();
      }
      if (this.gameOver) return;
      this.draw();
      this.reportState();
    } else {
      this.lastTime = null;
    }
    this.rafId = requestAnimationFrame(this.loop);
  };
}

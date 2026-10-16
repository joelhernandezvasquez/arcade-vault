// Motor de Asteroids portado de references/started-games/02-asteroids/game.js,
// encapsulado en una clase agnóstica de React.

import { getSkin, grosorTrazo, DEFAULT_SKIN } from "./skins";
import type {
  GameEngine,
  GameState,
  PerfSnapshot,
  SkinDefinition,
} from "./types";
import { FramePacer } from "./perf";

const W = 800;
const H = 600;

// ── Utils ─────────────────────────────────────────────────────────────────────
const wrap = (v: number, max: number) => ((v % max) + max) % max;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));

// Aplica glow de la skin al contexto actual. Debe usarse entre save()/restore().
const glow = (
  ctx: CanvasRenderingContext2D,
  skin: SkinDefinition,
  color: string,
) => {
  if (skin.brillo <= 0) return;
  ctx.shadowColor = color;
  ctx.shadowBlur = skin.brillo;
};

// ── Constants ─────────────────────────────────────────────────────────────────
const POWERUP_DROP_CHANCE = 0.15;
const POWERUP_DURATION = 5;
const POWERUP_TTL = 12;
const TRIPLE_SPREAD = 0.18;
const RADII = [0, 16, 30, 50]; // por tamaño 1, 2, 3
const SPEEDS = [0, 85, 55, 32]; // velocidad base por tamaño
const POINTS = [0, 100, 50, 20]; // puntos por tamaño

// ── Bullet ────────────────────────────────────────────────────────────────────
class Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttl = 1.1;
  radius = 2;
  dead = false;

  constructor(x: number, y: number, angle: number) {
    this.x = x;
    this.y = y;
    const SPEED = 520;
    this.vx = Math.cos(angle) * SPEED;
    this.vy = Math.sin(angle) * SPEED;
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, skin: SkinDefinition) {
    ctx.save();
    ctx.fillStyle = skin.paleta.resalte;
    glow(ctx, skin, skin.paleta.resalte);
    ctx.beginPath();
    // En retro la bala es un cuadrado de un píxel grueso.
    if (skin.pixelado > 1) {
      const p = skin.pixelado;
      ctx.rect(this.x - p / 2, this.y - p / 2, p, p);
    } else {
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
  }
}

// ── Asteroid ──────────────────────────────────────────────────────────────────
class Asteroid {
  x: number;
  y: number;
  size: number;
  radius: number;
  dead = false;
  vx: number;
  vy: number;
  rotSpeed: number;
  rot: number;
  verts: [number, number][] = [];

  constructor(x: number, y: number, size = 3) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.radius = RADII[size];

    const angle = rand(0, Math.PI * 2);
    const speed = SPEEDS[size] + rand(-15, 15);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.rotSpeed = rand(-1.2, 1.2);
    this.rot = rand(0, Math.PI * 2);

    const n = randInt(8, 13);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * rand(0.6, 1.0);
      this.verts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.rot += this.rotSpeed * dt;
  }

  split(): Asteroid[] {
    if (this.size <= 1) return [];
    return [
      new Asteroid(this.x, this.y, this.size - 1),
      new Asteroid(this.x, this.y, this.size - 1),
    ];
  }

  draw(ctx: CanvasRenderingContext2D, skin: SkinDefinition) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.strokeStyle = skin.paleta.secundario;
    glow(ctx, skin, skin.paleta.secundario);
    ctx.lineWidth = grosorTrazo(skin, 1.5);
    ctx.lineJoin = skin.pixelado > 1 ? "miter" : "round";
    ctx.beginPath();
    ctx.moveTo(this.verts[0][0], this.verts[0][1]);
    for (let i = 1; i < this.verts.length; i++)
      ctx.lineTo(this.verts[i][0], this.verts[i][1]);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

// ── PowerUp ───────────────────────────────────────────────────────────────────
class PowerUp {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius = 12;
  ttl = POWERUP_TTL;
  dead = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(20, 40);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }

  update(dt: number) {
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, skin: SkinDefinition) {
    if (this.ttl < 2 && Math.floor(this.ttl * 8) % 2 === 0) return;
    const pulse = 0.85 + Math.sin(performance.now() / 150) * 0.15;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = skin.paleta.acento;
    glow(ctx, skin, skin.paleta.acento);
    ctx.lineWidth = grosorTrazo(skin, 2);
    const r = this.radius * pulse;
    ctx.strokeRect(-r, -r, r * 2, r * 2);
    ctx.restore();
    ctx.save();
    ctx.fillStyle = skin.paleta.acento;
    glow(ctx, skin, skin.paleta.acento);
    // A baja resolución (retro) el texto necesita más tamaño para leerse.
    ctx.font = `bold ${skin.pixelado > 1 ? 24 : 12}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("3x", this.x, this.y);
    ctx.restore();
  }
}

// ── Ship ──────────────────────────────────────────────────────────────────────
class Ship {
  x = 0;
  y = 0;
  angle = 0;
  vx = 0;
  vy = 0;
  radius = 12;
  thrusting = false;
  invincible = 0;
  shootCooldown = 0;
  dead = false;
  tripleShot = 0;

  constructor() {
    this.reset();
  }

  reset() {
    this.x = W / 2;
    this.y = H / 2;
    this.angle = -Math.PI / 2;
    this.vx = 0;
    this.vy = 0;
    this.thrusting = false;
    this.invincible = 3;
    this.shootCooldown = 0;
    this.dead = false;
  }

  update(dt: number, keys: Record<string, boolean>) {
    if (this.dead) return;
    if (this.invincible > 0) this.invincible -= dt;
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.tripleShot > 0) this.tripleShot -= dt;

    const ROT = 3.5;
    const THRUST = 260;
    const DRAG = 0.987;

    if (keys["ArrowLeft"]) this.angle -= ROT * dt;
    if (keys["ArrowRight"]) this.angle += ROT * dt;

    this.thrusting = !!keys["ArrowUp"];
    if (this.thrusting) {
      this.vx += Math.cos(this.angle) * THRUST * dt;
      this.vy += Math.sin(this.angle) * THRUST * dt;
    }

    this.vx *= DRAG;
    this.vy *= DRAG;
    this.x = wrap(this.x + this.vx * dt, W);
    this.y = wrap(this.y + this.vy * dt, H);
  }

  tryShoot(): Bullet[] {
    if (this.shootCooldown > 0 || this.dead) return [];
    this.shootCooldown = 0.2;
    const NOSE = 21;
    const ox = this.x + Math.cos(this.angle) * NOSE;
    const oy = this.y + Math.sin(this.angle) * NOSE;
    if (this.tripleShot > 0) {
      return [
        new Bullet(ox, oy, this.angle - TRIPLE_SPREAD),
        new Bullet(ox, oy, this.angle),
        new Bullet(ox, oy, this.angle + TRIPLE_SPREAD),
      ];
    }
    return [new Bullet(ox, oy, this.angle)];
  }

  draw(ctx: CanvasRenderingContext2D, skin: SkinDefinition) {
    if (this.dead) return;
    if (this.invincible > 0 && Math.floor(this.invincible * 8) % 2 === 0)
      return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.strokeStyle = skin.paleta.primario;
    glow(ctx, skin, skin.paleta.primario);
    ctx.lineWidth = grosorTrazo(skin, 1.5);
    ctx.lineJoin = skin.pixelado > 1 ? "miter" : "round";

    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(-12, -9);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-12, 9);
    ctx.closePath();
    ctx.stroke();

    if (this.thrusting && Math.random() > 0.35) {
      ctx.beginPath();
      ctx.moveTo(-8, -4);
      ctx.lineTo(-8 - rand(6, 14), 0);
      ctx.lineTo(-8, 4);
      ctx.strokeStyle = skin.paleta.alerta;
      glow(ctx, skin, skin.paleta.alerta);
      ctx.globalAlpha = skin.desvanecer ? 0.85 : 1;
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Partículas (explosión) ────────────────────────────────────────────────────
class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  dead = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    const angle = rand(0, Math.PI * 2);
    const speed = rand(30, 130);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.life = rand(0.4, 1.1);
    this.ttl = this.life;
  }

  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.ttl -= dt;
    if (this.ttl <= 0) this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D, skin: SkinDefinition) {
    const alpha = this.ttl / this.life;
    // Sin degradados (retro): la partícula se apaga a la mitad de su vida.
    if (!skin.desvanecer && alpha < 0.5) return;
    ctx.save();
    ctx.strokeStyle = skin.paleta.secundario;
    glow(ctx, skin, skin.paleta.secundario);
    ctx.globalAlpha = skin.desvanecer ? Number(alpha.toFixed(2)) : 1;
    ctx.lineWidth = grosorTrazo(skin, 1);
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.05, this.y - this.vy * 0.05);
    ctx.stroke();
    ctx.restore();
  }
}

type EngineState = "playing" | "dead" | "gameover";

export class AsteroidsGame implements GameEngine {
  private ctx: CanvasRenderingContext2D;
  private skin: SkinDefinition;
  // Lienzo auxiliar de baja resolución para los píxeles gruesos (retro).
  private lowCanvas: HTMLCanvasElement | null = null;
  private lowCtx: CanvasRenderingContext2D | null = null;
  private keys: Record<string, boolean> = {};
  private spacePressed = false;
  private spaceHeld = false;

  private ship!: Ship;
  private bullets: Bullet[] = [];
  private asteroids: Asteroid[] = [];
  private particles: Particle[] = [];
  private powerUps: PowerUp[] = [];
  private score = 0;
  private lives = 3;
  private level = 1;
  private state: EngineState = "playing";
  private deadTimer = 0;
  private powerUpSpawned = false;
  private killsSinceSpawn = 0;

  private paused = false;
  private lastTime: number | null = null;
  private pacer = new FramePacer(60);
  private rafId: number | null = null;
  private onStateChangeCb: ((s: GameState) => void) | null = null;
  private lastReported: GameState | null = null;

  private handleKeyDown = (e: KeyboardEvent) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(e.code))
      e.preventDefault();
    if (!this.keys[e.code]) {
      if (e.code === "Space") this.spacePressed = true;
    }
    this.keys[e.code] = true;
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(e.code))
      e.preventDefault();
    this.keys[e.code] = false;
  };

  constructor(canvas: HTMLCanvasElement, skin?: SkinDefinition) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas");
    this.ctx = ctx;
    this.skin = skin ?? getSkin(DEFAULT_SKIN);
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    this.initGame();
  }

  onStateChange(cb: (s: GameState) => void) {
    this.onStateChangeCb = cb;
  }

  start() {
    this.lastTime = null;
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(this.loop);
    }
  }

  setSkin(skin: SkinDefinition) {
    this.skin = skin;
    // En pausa el loop no dibuja: se redibuja el frame congelado con la nueva skin.
    if (this.paused && this.rafId !== null) this.draw();
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
    this.reportState();
  }

  forceGameOver() {
    if (this.state === "gameover") return;
    this.state = "gameover";
    this.reportState();
  }

  destroy() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
  }

  private pressedSpace(): boolean {
    const val = this.spacePressed;
    this.spacePressed = false;
    return val;
  }

  private spawnAsteroids(count: number) {
    const SAFE_DIST = 130;
    for (let i = 0; i < count; i++) {
      let x, y;
      do {
        x = rand(0, W);
        y = rand(0, H);
      } while (Math.hypot(x - W / 2, y - H / 2) < SAFE_DIST);
      this.asteroids.push(new Asteroid(x, y, 3));
    }
  }

  private initGame() {
    this.ship = new Ship();
    this.bullets = [];
    this.asteroids = [];
    this.particles = [];
    this.powerUps = [];
    this.powerUpSpawned = false;
    this.killsSinceSpawn = 0;
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.state = "playing";
    this.spawnAsteroids(4);
  }

  private nextLevel() {
    this.level++;
    this.bullets = [];
    this.particles = [];
    this.powerUps = [];
    this.powerUpSpawned = false;
    this.killsSinceSpawn = 0;
    this.ship.reset();
    this.spawnAsteroids(3 + this.level);
  }

  private explode(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) this.particles.push(new Particle(x, y));
  }

  private killShip() {
    this.explode(this.ship.x, this.ship.y, 14);
    this.ship.dead = true;
    this.lives--;
    if (this.lives <= 0) {
      this.state = "gameover";
    } else {
      this.state = "dead";
      this.deadTimer = 2;
    }
  }

  private reportState() {
    const s: GameState = {
      score: this.score,
      lives: this.lives,
      level: this.level,
      gameOver: this.state === "gameover",
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

  private update(dt: number) {
    if (this.state === "gameover") {
      this.particles.forEach((p) => p.update(dt));
      this.particles = this.particles.filter((p) => !p.dead);
      return;
    }

    if (this.state === "dead") {
      this.deadTimer -= dt;
      this.particles.forEach((p) => p.update(dt));
      this.particles = this.particles.filter((p) => !p.dead);
      this.asteroids.forEach((a) => a.update(dt));
      if (this.deadTimer <= 0) {
        this.state = "playing";
        this.ship.reset();
      }
      return;
    }

    if (this.pressedSpace()) {
      this.bullets.push(...this.ship.tryShoot());
    }

    this.ship.update(dt, this.keys);
    this.bullets.forEach((b) => b.update(dt));
    this.asteroids.forEach((a) => a.update(dt));
    this.particles.forEach((p) => p.update(dt));
    this.powerUps.forEach((p) => p.update(dt));

    this.bullets = this.bullets.filter((b) => !b.dead);
    this.particles = this.particles.filter((p) => !p.dead);
    this.powerUps = this.powerUps.filter((p) => !p.dead);

    for (const p of this.powerUps) {
      if (!p.dead && dist(this.ship, p) < this.ship.radius + p.radius) {
        p.dead = true;
        this.ship.tripleShot = POWERUP_DURATION;
      }
    }

    const newAsteroids: Asteroid[] = [];
    for (const b of this.bullets) {
      for (const a of this.asteroids) {
        if (!a.dead && !b.dead && dist(b, a) < a.radius) {
          b.dead = true;
          a.dead = true;
          this.score += POINTS[a.size];
          this.explode(a.x, a.y, a.size * 5);
          newAsteroids.push(...a.split());
          if (!this.powerUpSpawned) {
            this.killsSinceSpawn++;
            const guaranteed = this.killsSinceSpawn >= 5;
            if (guaranteed || Math.random() < POWERUP_DROP_CHANCE) {
              this.powerUps.push(new PowerUp(a.x, a.y));
              this.powerUpSpawned = true;
            }
          }
        }
      }
    }
    this.asteroids = this.asteroids.filter((a) => !a.dead).concat(newAsteroids);
    this.bullets = this.bullets.filter((b) => !b.dead);

    if (this.ship.invincible <= 0) {
      for (const a of this.asteroids) {
        if (dist(this.ship, a) < this.ship.radius + a.radius * 0.82) {
          this.killShip();
          break;
        }
      }
    }

    if (this.asteroids.length === 0) this.nextLevel();
  }

  private draw() {
    const skin = this.skin;
    const px = skin.pixelado;
    const main = this.ctx;
    let ctx = main;

    if (px > 1) {
      // Se dibuja en un lienzo W/px x H/px (coordenadas lógicas intactas vía
      // scale) y se amplía sin suavizado para obtener píxeles gruesos.
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

    this.particles.forEach((p) => p.draw(ctx, skin));
    this.asteroids.forEach((a) => a.draw(ctx, skin));
    this.powerUps.forEach((p) => p.draw(ctx, skin));
    this.bullets.forEach((b) => b.draw(ctx, skin));
    this.ship.draw(ctx, skin);

    if (ctx !== main && this.lowCanvas) {
      main.imageSmoothingEnabled = false;
      main.drawImage(this.lowCanvas, 0, 0, W, H);
    } else {
      main.imageSmoothingEnabled = skin.suavizado;
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
    if (!this.paused) {
      const dt =
        this.lastTime === null
          ? 0
          : Math.min((ts - this.lastTime) / 1000, 0.05);
      this.lastTime = ts;
      this.pacer.begin();
      this.update(dt);
      this.draw();
      this.pacer.end();
      this.reportState();
    } else {
      this.lastTime = null;
    }
    this.rafId = requestAnimationFrame(this.loop);
  };
}

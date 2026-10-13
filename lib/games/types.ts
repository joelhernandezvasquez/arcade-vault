export interface GameState {
  score: number;
  lives: number | null;
  level: number;
  gameOver: boolean;
}

export type SkinId = "clasico" | "neon" | "retro";

// Paleta genérica: cada motor decide qué elemento usa cada rol.
export interface SkinPaleta {
  fondo: string;
  primario: string;
  secundario: string;
  acento: string;
  resalte: string;
  alerta: string;
}

export interface SkinDefinition {
  id: SkinId;
  nombre: string;
  paleta: SkinPaleta;
  /** Radio de glow (`shadowBlur`); 0 = sin brillo. */
  brillo: number;
  /** Valor de `imageSmoothingEnabled`. */
  suavizado: boolean;
  /** Tamaño del píxel lógico; 1 = resolución completa, >1 = píxeles gruesos. */
  pixelado: number;
  /** Multiplicador del grosor de trazo (ignorado si `pixelado` > 1). */
  grosorLinea: number;
  /** Si es false, los efectos no usan transparencia gradual. */
  desvanecer: boolean;
}

export interface GameEngine {
  start(): void;
  pause(): void;
  resume(): void;
  reset(): void;
  forceGameOver(): void;
  destroy(): void;
  onStateChange(cb: (s: GameState) => void): void;
  /** Cambia la skin en caliente, sin reiniciar la partida ni emitir estado. */
  setSkin?(skin: SkinDefinition): void;
}

export interface ControlTactil {
  /** Texto del botón, p. ej. "◀", "DISPARO". */
  etiqueta: string;
  /** `KeyboardEvent.key`, p. ej. "ArrowLeft", " ". */
  key: string;
  /** `KeyboardEvent.code`, p. ej. "ArrowLeft", "Space". */
  code: string;
  /** Lado del gamepad donde se dibuja. */
  zona: "izquierda" | "derecha";
  /** Si existe, repite `keydown` con ese intervalo mientras esté presionado. */
  repetirMs?: number;
}

export interface GameDefinition {
  width: number;
  height: number;
  /** Skins que ofrece el juego; si falta, el reproductor no muestra selector. */
  skins?: SkinId[];
  /** Botones del gamepad virtual; si falta, el reproductor no lo muestra. */
  controlesTactiles?: ControlTactil[];
  create(canvas: HTMLCanvasElement, skin?: SkinDefinition): GameEngine;
}

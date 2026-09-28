export interface GameState {
  score: number;
  lives: number | null;
  level: number;
  gameOver: boolean;
}

export interface GameEngine {
  start(): void;
  pause(): void;
  resume(): void;
  reset(): void;
  forceGameOver(): void;
  destroy(): void;
  onStateChange(cb: (s: GameState) => void): void;
}

export interface GameDefinition {
  width: number;
  height: number;
  create(canvas: HTMLCanvasElement): GameEngine;
}

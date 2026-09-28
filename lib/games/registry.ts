import { AsteroidsGame } from "./asteroids";
import type { GameDefinition } from "./types";

export const ENGINES: Record<string, GameDefinition> = {
  asteroids: {
    width: 800,
    height: 600,
    create: (canvas) => new AsteroidsGame(canvas),
  },
};

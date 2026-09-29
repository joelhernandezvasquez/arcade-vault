import { AsteroidsGame } from "./asteroids";
import { CaidaGame } from "./caida";
import type { GameDefinition } from "./types";

export const ENGINES: Record<string, GameDefinition> = {
  asteroids: {
    width: 800,
    height: 600,
    create: (canvas) => new AsteroidsGame(canvas),
  },
  caida: {
    width: 800,
    height: 600,
    create: (canvas) => new CaidaGame(canvas),
  },
};

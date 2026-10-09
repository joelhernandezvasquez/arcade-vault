import { AsteroidsGame } from "./asteroids";
import { BloqueBusterGame } from "./bloque-buster";
import { CaidaGame } from "./caida";
import { SerpentinaGame } from "./serpentina";
import { SKIN_IDS, getSkin } from "./skins";
import type { GameDefinition } from "./types";

export const ENGINES: Record<string, GameDefinition> = {
  asteroids: {
    width: 800,
    height: 600,
    skins: SKIN_IDS,
    create: (canvas, skin) =>
      new AsteroidsGame(canvas, skin ?? getSkin("clasico")),
  },
  caida: {
    width: 800,
    height: 600,
    create: (canvas) => new CaidaGame(canvas),
  },
  "bloque-buster": {
    width: 800,
    height: 600,
    skins: SKIN_IDS,
    create: (canvas, skin) =>
      new BloqueBusterGame(canvas, skin ?? getSkin("clasico")),
  },
  serpentina: {
    width: 800,
    height: 600,
    skins: SKIN_IDS,
    create: (canvas, skin) =>
      new SerpentinaGame(canvas, skin ?? getSkin("clasico")),
  },
};

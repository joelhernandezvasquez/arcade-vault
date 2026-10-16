import { AsteroidsGame } from "./asteroids";
import { BloqueBusterGame } from "./bloque-buster";
import { CaidaGame } from "./caida";
import { RanariaGame } from "./ranaria";
import { SerpentinaGame } from "./serpentina";
import { SKIN_IDS, getSkin } from "./skins";
import type { ControlTactil, GameDefinition } from "./types";

// Los valores key/code siguen lo que lee cada motor: asteroids y caida usan
// `code`; bloque-buster y serpentina usan `key`. Se rellenan ambos.
const flecha = (
  nombre: "Left" | "Right" | "Up" | "Down",
  etiqueta: string,
  extra: Partial<ControlTactil> = {},
): ControlTactil => ({
  etiqueta,
  key: `Arrow${nombre}`,
  code: `Arrow${nombre}`,
  zona: "izquierda",
  ...extra,
});

const ESPACIO = { key: " ", code: "Space" } as const;

export const ENGINES: Record<string, GameDefinition> = {
  asteroids: {
    width: 800,
    height: 600,
    skins: SKIN_IDS,
    controlesTactiles: [
      flecha("Left", "◀"),
      flecha("Right", "▶"),
      flecha("Up", "EMPUJE", { zona: "derecha" }),
      { etiqueta: "DISPARO", ...ESPACIO, zona: "derecha" },
    ],
    create: (canvas, skin) =>
      new AsteroidsGame(canvas, skin ?? getSkin("clasico")),
  },
  caida: {
    width: 800,
    height: 600,
    controlesTactiles: [
      flecha("Left", "◀", { repetirMs: 120 }),
      flecha("Right", "▶", { repetirMs: 120 }),
      flecha("Down", "▼", { repetirMs: 60 }),
      flecha("Up", "GIRAR", { zona: "derecha" }),
      { etiqueta: "CAER", ...ESPACIO, zona: "derecha" },
    ],
    create: (canvas) => new CaidaGame(canvas),
  },
  "bloque-buster": {
    width: 800,
    height: 600,
    skins: SKIN_IDS,
    controlesTactiles: [flecha("Left", "◀"), flecha("Right", "▶")],
    create: (canvas, skin) =>
      new BloqueBusterGame(canvas, skin ?? getSkin("clasico")),
  },
  serpentina: {
    width: 800,
    height: 600,
    skins: SKIN_IDS,
    controlesTactiles: [
      flecha("Up", "▲"),
      flecha("Left", "◀"),
      flecha("Right", "▶"),
      flecha("Down", "▼"),
    ],
    create: (canvas, skin) =>
      new SerpentinaGame(canvas, skin ?? getSkin("clasico")),
  },
  ranaria: {
    width: 800,
    height: 600,
    skins: SKIN_IDS,
    // Un toque, un salto: sin repetición.
    controlesTactiles: [
      flecha("Up", "▲"),
      flecha("Left", "◀"),
      flecha("Right", "▶"),
      flecha("Down", "▼"),
    ],
    create: (canvas, skin) =>
      new RanariaGame(canvas, skin ?? getSkin("clasico")),
  },
};

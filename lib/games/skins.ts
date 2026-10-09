// Skins compartidas por los motores. Los colores de neón replican las
// variables del tema de app/globals.css (--cyan, --magenta, --yellow,
// --green); el canvas no puede leer variables CSS de forma barata, por eso
// se copian como constantes.

import type { SkinDefinition, SkinId } from "./types";

export const SKIN_IDS: SkinId[] = ["clasico", "neon", "retro"];
export const DEFAULT_SKIN: SkinId = "clasico";
const STORAGE_KEY = "av_skin";

const SKINS: Record<SkinId, SkinDefinition> = {
  clasico: {
    id: "clasico",
    nombre: "CLÁSICO",
    paleta: {
      fondo: "#000",
      primario: "#fff",
      secundario: "#fff",
      acento: "#0ff",
      resalte: "#fff",
      alerta: "#ff8200",
    },
    brillo: 0,
    suavizado: true,
    pixelado: 1,
    grosorLinea: 1,
    desvanecer: true,
  },
  neon: {
    id: "neon",
    nombre: "NEÓN",
    paleta: {
      fondo: "#0a0a0f", // --bg
      primario: "#00f5ff", // --cyan
      secundario: "#ff006e", // --magenta
      acento: "#00ff88", // --green
      resalte: "#f5ff00", // --yellow
      alerta: "#ff8200",
    },
    brillo: 12,
    suavizado: true,
    pixelado: 1,
    grosorLinea: 1.5,
    desvanecer: true,
  },
  retro: {
    id: "retro",
    nombre: "RETRO",
    paleta: {
      fondo: "#000",
      primario: "#58f858",
      secundario: "#fcfcfc",
      acento: "#54fcfc",
      resalte: "#fcfc54",
      alerta: "#fc5454",
    },
    brillo: 0,
    suavizado: false,
    pixelado: 4,
    grosorLinea: 1,
    desvanecer: false,
  },
};

export function getSkin(id: SkinId): SkinDefinition {
  return SKINS[id] ?? SKINS[DEFAULT_SKIN];
}

/** Grosor de trazo para la skin: en retro es siempre un píxel grueso. */
export function grosorTrazo(skin: SkinDefinition, base: number): number {
  return skin.pixelado > 1 ? skin.pixelado : base * skin.grosorLinea;
}

export function esSkinId(v: unknown): v is SkinId {
  return typeof v === "string" && (SKIN_IDS as string[]).includes(v);
}

export function leerSkinGuardada(): SkinId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return esSkinId(v) ? v : DEFAULT_SKIN;
  } catch {
    return DEFAULT_SKIN;
  }
}

export function guardarSkin(id: SkinId) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignorar fallos de almacenamiento
  }
}

"use client";

import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { ControlTactil } from "@/lib/games/types";

interface TouchControlsProps {
  controles: ControlTactil[];
  deshabilitado: boolean;
}

interface Presionado {
  control: ControlTactil;
  pointerId: number;
  intervalo: ReturnType<typeof setInterval> | null;
}

function dispararTecla(tipo: "keydown" | "keyup", control: ControlTactil) {
  document.dispatchEvent(
    new KeyboardEvent(tipo, {
      key: control.key,
      code: control.code,
      bubbles: true,
      cancelable: true,
    }),
  );
}

export default function TouchControls({
  controles,
  deshabilitado,
}: TouchControlsProps) {
  // Un botón presionado a la vez por índice; un pointerId por botón.
  const presionados = useRef<Map<number, Presionado>>(new Map());

  const soltar = useCallback((indice: number) => {
    const activo = presionados.current.get(indice);
    if (!activo) return;
    if (activo.intervalo) clearInterval(activo.intervalo);
    presionados.current.delete(indice);
    dispararTecla("keyup", activo.control);
  }, []);

  const soltarTodo = useCallback(() => {
    for (const indice of [...presionados.current.keys()]) soltar(indice);
  }, [soltar]);

  // Al pausar o terminar la partida, y al desmontar, no queda ninguna tecla presionada.
  useEffect(() => {
    if (deshabilitado) soltarTodo();
  }, [deshabilitado, soltarTodo]);

  useEffect(() => soltarTodo, [soltarTodo]);

  const presionar = (
    e: ReactPointerEvent<HTMLButtonElement>,
    indice: number,
  ) => {
    if (deshabilitado || presionados.current.has(indice)) return;
    const control = controles[indice];
    e.currentTarget.setPointerCapture(e.pointerId);
    dispararTecla("keydown", control);
    const intervalo = control.repetirMs
      ? setInterval(() => dispararTecla("keydown", control), control.repetirMs)
      : null;
    presionados.current.set(indice, {
      control,
      pointerId: e.pointerId,
      intervalo,
    });
  };

  const liberar = (e: ReactPointerEvent<HTMLButtonElement>, indice: number) => {
    if (presionados.current.get(indice)?.pointerId !== e.pointerId) return;
    soltar(indice);
  };

  // Con setPointerCapture el navegador no emite pointerleave al deslizar fuera,
  // así que se comprueba a mano si el dedo salió del botón.
  const mover = (e: ReactPointerEvent<HTMLButtonElement>, indice: number) => {
    if (presionados.current.get(indice)?.pointerId !== e.pointerId) return;
    const r = e.currentTarget.getBoundingClientRect();
    const fuera =
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom;
    if (fuera) soltar(indice);
  };

  const renderZona = (zona: ControlTactil["zona"]) => (
    <div className={`touch-controls__zona touch-controls__zona--${zona}`}>
      {controles.map((control, indice) =>
        control.zona !== zona ? null : (
          <button
            key={indice}
            type="button"
            className="touch-btn"
            disabled={deshabilitado}
            onPointerDown={(e) => presionar(e, indice)}
            onPointerUp={(e) => liberar(e, indice)}
            onPointerCancel={(e) => liberar(e, indice)}
            onPointerLeave={(e) => liberar(e, indice)}
            onPointerMove={(e) => mover(e, indice)}
            onContextMenu={(e) => e.preventDefault()}
          >
            {control.etiqueta}
          </button>
        ),
      )}
    </div>
  );

  return (
    <div className="touch-controls" aria-label="Controles táctiles">
      {renderZona("izquierda")}
      {renderZona("derecha")}
    </div>
  );
}

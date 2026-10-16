"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { getSkin } from "@/lib/games/skins";
import type {
  GameDefinition,
  GameState,
  PerfSnapshot,
  SkinId,
} from "@/lib/games/types";

export interface GameCanvasHandle {
  reset: () => void;
  forceGameOver: () => void;
  getPerf: () => PerfSnapshot | undefined;
}

interface GameCanvasProps {
  definition: GameDefinition;
  paused: boolean;
  skin: SkinId;
  onStateChange: (state: GameState) => void;
}

const GameCanvas = forwardRef<GameCanvasHandle, GameCanvasProps>(
  function GameCanvas({ definition, paused, skin, onStateChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<ReturnType<GameDefinition["create"]> | null>(null);

    useEffect(() => {
      if (!canvasRef.current) return;
      const engine = definition.create(canvasRef.current, getSkin(skin));
      engineRef.current = engine;
      engine.onStateChange(onStateChange);
      engine.start();
      return () => {
        engine.destroy();
        engineRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      if (paused) engineRef.current?.pause();
      else engineRef.current?.resume();
    }, [paused]);

    useEffect(() => {
      engineRef.current?.setSkin?.(getSkin(skin));
    }, [skin]);

    useImperativeHandle(ref, () => ({
      reset: () => engineRef.current?.reset(),
      forceGameOver: () => engineRef.current?.forceGameOver(),
      getPerf: () => engineRef.current?.getPerf?.(),
    }));

    return (
      <canvas
        ref={canvasRef}
        width={definition.width}
        height={definition.height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    );
  },
);

export default GameCanvas;

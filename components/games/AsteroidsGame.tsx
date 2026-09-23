"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import {
  AsteroidsGame as AsteroidsEngine,
  AsteroidsState,
} from "@/lib/games/asteroids";

export interface AsteroidsGameHandle {
  reset: () => void;
  forceGameOver: () => void;
}

interface AsteroidsGameProps {
  paused: boolean;
  onStateChange: (state: AsteroidsState) => void;
}

const AsteroidsGame = forwardRef<AsteroidsGameHandle, AsteroidsGameProps>(
  function AsteroidsGame({ paused, onStateChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<AsteroidsEngine | null>(null);

    useEffect(() => {
      if (!canvasRef.current) return;
      const engine = new AsteroidsEngine(canvasRef.current);
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

    useImperativeHandle(ref, () => ({
      reset: () => engineRef.current?.reset(),
      forceGameOver: () => engineRef.current?.forceGameOver(),
    }));

    return (
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    );
  },
);

export default AsteroidsGame;

import { useEffect, useRef, useState } from "react";
import { Scene3D, Stage, WebGLUnavailable } from "../visuals/stage";

/** Mounts a WebGL scene in a full-size canvas and cleans it up on unmount. */
export function Visual<T extends Scene3D>({
  create,
  onReady,
  fallback,
}: {
  create: (stage: Stage) => T;
  onReady?: (scene: T, stage: Stage) => void;
  fallback: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    let stage: Stage | null = null;
    try {
      stage = new Stage(ref.current);
      const scene = create(stage);
      stage.mount(scene);
      onReady?.(scene, stage);
    } catch (e) {
      setError(e instanceof WebGLUnavailable ? fallback : `Errore grafico: ${(e as Error).message}`);
      stage?.dispose();
      stage = null;
    }
    return () => stage?.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="canvas-wrap">
      <canvas ref={ref} aria-hidden="true" />
      {error && <div className="fallback">{error}</div>}
    </div>
  );
}

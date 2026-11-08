import { useEffect, useRef } from "react";

/** Histogram drawn as columns of dots (as in the dashboard reference).
 *  Values are drawn to scale; the max label names the real maximum. */
export function DotBars({ values, labels, height = 120, title }: {
  values: number[];
  labels?: string[];
  height?: number;
  title: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const max = Math.max(0, ...values);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = c.clientWidth;
    const h = height;
    c.width = w * dpr;
    c.height = h * dpr;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    const padB = 16;
    const plotH = h - padB - 4;
    // faint grid
    ctx.fillStyle = "rgba(233,236,241,0.10)";
    for (let gy = 0; gy <= 4; gy++) {
      const y = 4 + (plotH * gy) / 4;
      for (let x = 0; x < w; x += 4) ctx.fillRect(x, y, 1, 1);
    }
    const n = values.length || 1;
    const colW = w / n;
    const step = 3;
    values.forEach((v, i) => {
      const barH = max > 0 ? (v / max) * plotH : 0;
      const cx = i * colW + colW / 2;
      const dots = Math.round(barH / step);
      for (let k = 0; k < dots; k++) {
        const y = 4 + plotH - k * step;
        const a = 0.35 + 0.65 * (k / Math.max(1, dots));
        ctx.fillStyle = `rgba(236,239,244,${a})`;
        ctx.fillRect(Math.round(cx - 0.75), Math.round(y), 1.5, 1.5);
        if (colW > 6) ctx.fillRect(Math.round(cx + 1.5), Math.round(y), 1, 1);
      }
      if (i === values.length - 1 && v > 0) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(cx - 1.5, 4 + plotH - dots * step - 1, 3, 3);
      }
    });
    ctx.fillStyle = "rgba(233,236,241,0.35)";
    ctx.fillRect(0, 4 + plotH + 2, w, 1);
    if (labels?.length) {
      ctx.fillStyle = "rgba(233,236,241,0.45)";
      ctx.font = "9px IBM Plex Mono, monospace";
      const every = Math.ceil(labels.length / 6);
      labels.forEach((l, i) => {
        if (i % every !== 0 && i !== labels.length - 1) return;
        ctx.fillText(l, Math.min(w - 30, Math.max(0, i * colW)), h - 3);
      });
    }
  }, [values, labels, height, max]);
  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="label">{title}</span>
        <span className="label num">max {max}</span>
      </div>
      <canvas ref={ref} style={{ width: "100%", height }} role="img"
        aria-label={`${title}: ${values.join(", ")}`} />
    </div>
  );
}

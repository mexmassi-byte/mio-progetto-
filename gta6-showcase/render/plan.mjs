// Scroll + cursor choreography for the website (site time ts, viewport CSS px).
// Built from the page's measured layout so it adapts to any content change.

// Monotone cubic Hermite interpolation (no overshoot => scrolling never reverses).
export function monotone(xs, ys) {
  const n = xs.length;
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const m = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) { m[i] = 0; continue; }
    const h0 = xs[i] - xs[i - 1], h1 = xs[i + 1] - xs[i];
    const w1 = 2 * h1 + h0, w2 = h1 + 2 * h0;
    m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h;
    const t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

export function buildPlan(info) {
  const A = info.anchors, vh = info.vh;
  const maxY = info.docH - vh;
  const c = (r) => [r.x + r.w / 2, r.y + r.h / 2];

  // ---------------- scroll keyframes [ts, y]
  const K = [];
  const add = (t, y) => K.push([t, clamp(Math.round(y), 0, maxY)]);
  const rel = (t, dy) => add(t, K[K.length - 1][1] + dy);
  add(0, 0); add(8.6, 0);
  add(11.8, A.statement.y + A.statement.h / 2 - vh * 0.47); rel(12.8, 70);
  add(15.5, A.features.y + 30); rel(16.4, 60);
  add(18.5, A.bento.y + 135); rel(19.2, 45);
  add(21.6, A.places.y - 290); rel(24.4, 40);
  add(26.4, A.duo.y - 150); rel(28.4, 30);
  add(30.4, A.media.y + 10); rel(31.0, 30);
  add(32.4, A.film.y - 64); rel(33.6, 0);
  add(35.4, A.reel.y - 150); rel(36.2, 40);
  add(38.6, A.editionCards.y - 74); rel(41.0, 0);
  add(44.0, maxY); add(60, maxY);
  const scroll = monotone(K.map((k) => k[0]), K.map((k) => k[1]));
  const yAt = (t) => scroll(t);

  // ---------------- cursor waypoints {t, x, y} (viewport coords) + hold segments
  const rest = [1000, 560];
  const toView = (docPt, t) => [docPt[0], docPt[1] - yAt(t)];
  const W = [];
  const at = (t, p, arc = 0.08) => W.push({ t, x: p[0], y: p[1], arc });
  at(2.6, [1130, 650]);
  at(3.75, c(A.navOverview), 0.12); at(4.35, c(A.navOverview));
  at(4.95, c(A.navMedia), 0.05); at(5.55, c(A.navMedia));
  at(6.05, c(A.navEditions), 0.05); at(6.6, c(A.navEditions));
  const cta = c(A.heroCta);
  at(7.6, [cta[0] + 18, cta[1] + 4], 0.1); at(8.7, [cta[0] + 18, cta[1] + 4]);
  at(9.9, rest, 0.1); at(22.2, rest);
  // sweep across the Leonida place cards (right -> left)
  const placesY = A.places.y + A.places.h * 0.72;
  at(22.8, [1080, placesY - yAt(22.8)], 0.02);
  at(24.6, [330, placesY - yAt(24.6)], 0.0);
  // cast: rest briefly on Cal Hampton, then visit Lucia's card
  at(26.5, [330, 560], 0.04); at(27.0, [330, 560]);
  const lucia = [A.duo.x + A.duo.w * 0.78, A.duo.y + A.duo.h * 0.55];
  at(27.9, toView(lucia, 27.9), 0.1); at(28.6, toView(lucia, 28.6));
  at(29.6, rest, 0.08); at(31.6, rest);
  // launch trailer play button
  const play = c(A.filmPlay);
  at(32.5, toView(play, 32.5), 0.1); at(33.5, toView(play, 33.5));
  // Trailer 2 thumbnail in the reel
  const clipX = A.reel.x + ((A.reel.w - 60) / 4 + 20) * 2 + (A.reel.w - 60) / 8;
  const clip = [clipX, A.reel.y + 80];
  at(35.4, toView(clip, 35.4), 0.08); at(36.3, toView(clip, 36.3));
  at(37.2, rest, 0.06); at(38.0, rest);
  // Ultimate edition card, then its CTA
  const ult = [A.ultimate.x + A.ultimate.w * 0.55, A.ultimate.y + A.ultimate.h * 0.42];
  at(38.9, toView(ult, 38.9), 0.08); at(39.5, toView(ult, 39.5));
  const ub = c(A.ultimateBtn);
  at(40.2, toView([ub[0] + 10, ub[1] + 2], 40.2), 0.06); at(41.2, toView([ub[0] + 10, ub[1] + 2], 41.2));
  at(42.4, [1010, 520], 0.08); at(44.0, [1010, 520]);
  const fin = c(A.finalCta);
  at(45.0, toView([fin[0] + 12, fin[1] + 3], 45.0), 0.1); at(60, toView([fin[0] + 12, fin[1] + 3], 60));

  function cursor(t) {
    const alpha = clamp((t - 2.6) / 0.35, 0, 1);
    if (t <= W[0].t) return { x: W[0].x, y: W[0].y, a: alpha };
    for (let i = 0; i < W.length - 1; i++) {
      const a = W[i], b = W[i + 1];
      if (t >= a.t && t <= b.t) {
        const u = easeInOut((t - a.t) / (b.t - a.t));
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        // slight perpendicular arc for a natural hand movement
        const arc = Math.sin(Math.PI * u) * b.arc * len;
        const nx = len ? -dy / len : 0, ny = len ? dx / len : 0;
        return { x: a.x + dx * u + nx * arc, y: a.y + dy * u + ny * arc, a: alpha };
      }
    }
    const l = W[W.length - 1];
    return { x: l.x, y: l.y, a: alpha };
  }
  return { scroll, cursor, keyframes: K, waypoints: W, maxY };
}

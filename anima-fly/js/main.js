/* ANIMA FLY: the flight is the scroll.
   Every moving thing is a pure function of the scroll position (plus a clock for the ticker),
   so the page renders the same frame for the same scroll, in a browser or in record mode (?rec). */
(() => {
  const html = document.documentElement;
  const REC = html.classList.contains('rec');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const easeOut = (u) => 1 - Math.pow(1 - u, 3);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  /* ------------------------------------------------ the film and the cabin photographs */
  const N = 289;
  const frames = new Array(N + 1);
  const src = (i) => `assets/hero/f_${String(i).padStart(4, '0')}.webp`;
  const order = [];
  const seen = new Set();
  for (const step of [48, 16, 8, 4, 2, 1]) for (let i = 1; i <= N; i += step) if (!seen.has(i)) { seen.add(i); order.push(i); }
  if (!seen.has(N)) order.push(N);
  let loadedCount = 0;
  function loadFrame(i) {
    return new Promise((res) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { frames[i] = img; loadedCount++; res(); if (i === want) draw(); };
      img.onerror = res;
      img.src = src(i);
    });
  }
  const stills = {};
  function loadStill(key, url) {
    return new Promise((res) => { const img = new Image(); img.onload = () => { stills[key] = img; res(); draw(); }; img.onerror = res; img.src = url; });
  }
  // first frame, then a coarse pass, then everything (a few at a time)
  const firstLoad = loadFrame(1);
  const allLoaded = (async () => {
    await firstLoad;
    await Promise.all([loadStill('cabin', 'assets/img/cabin.jpg'), loadStill('menu', 'assets/img/champagne.jpg')]);
    let k = 1;
    const workers = Array.from({ length: 6 }, async () => { while (k < order.length) { const i = order[k++]; if (!frames[i]) await loadFrame(i); } });
    await Promise.all(workers);
  })();
  function nearest(i) {
    if (frames[i]) return frames[i];
    for (let d = 1; d < N; d++) { if (frames[i - d]) return frames[i - d]; if (frames[i + d]) return frames[i + d]; }
    return null;
  }

  /* ------------------------------------------------ canvas */
  const flight = $('[data-flight]');
  const canvas = $('[data-canvas]');
  const ctx = canvas.getContext('2d', { alpha: false });
  let CW = 0, CH = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    CW = canvas.clientWidth; CH = canvas.clientHeight;
    canvas.width = Math.round(CW * DPR); canvas.height = Math.round(CH * DPR);
    draw();
  }
  // draw an image to cover the canvas, scaled about a focus point (fx, fy in 0..1 of the image)
  function cover(img, alpha, scale, fx, fy) {
    if (!img || alpha <= 0.001) return;
    const W = canvas.width, H = canvas.height;
    const s = Math.max(W / img.width, H / img.height) * scale;
    const dw = img.width * s, dh = img.height * s;
    // keep the focus point where it would sit, clamped so the picture always covers
    let x = W / 2 - fx * dw, y = H / 2 - fy * dh;
    x = Math.min(0, Math.max(W - dw, x)); y = Math.min(0, Math.max(H - dh, y));
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, x, y, dw, dh);
  }

  /* ------------------------------------------------ the flight plan: progress p (0..1) -> picture */
  // film frame by progress, in legs
  const LEGS = [
    [0.0, 0.16, 1, 50],      // the apron, the camera walks to the door
    [0.16, 0.30, 50, 86],    // the door, the airstair (the film dissolves to the wing after 86)
    [0.58, 0.70, 99, 150],   // the wing, the tail, lift-off
    [0.70, 0.86, 150, 236],  // above the clouds
    [0.86, 1.0, 236, 289],   // the island runway
  ];
  // reduced motion: each leg holds one still instead of playing the film under the scroll
  const STILL = [20, 80, 130, 205, 262];
  function filmAt(p) {
    if (reduce.matches) { for (let i = 0; i < LEGS.length; i++) if (p <= LEGS[i][1] || i === LEGS.length - 1) return STILL[i]; }
    for (const [a, b, f0, f1] of LEGS) if (p <= b || b === 1) { if (p < a) return f0; return Math.round(lerp(f0, f1, (p - a) / (b - a))); }
    return N;
  }
  // where the picture should stay in view on a narrow screen (x of the subject per frame)
  const FOCUS = [[1, 0.5], [50, 0.42], [86, 0.4], [99, 0.5], [130, 0.42], [150, 0.55], [236, 0.24], [289, 0.74]];
  function focusX(f) {
    for (let i = 0; i < FOCUS.length - 1; i++) if (f <= FOCUS[i + 1][0]) return lerp(FOCUS[i][1], FOCUS[i + 1][1], (f - FOCUS[i][0]) / (FOCUS[i + 1][0] - FOCUS[i][0]));
    return 0.6;
  }
  let want = 1;
  let P = 0;
  function draw() {
    if (!CW) return;
    const p = P;
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1a1210';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // film before the cabin
    if (p < 0.36) {
      const f = filmAt(Math.min(p, 0.30));
      want = f;
      const push = reduce.matches ? 1 : 1 + 0.9 * ease(seg(p, 0.30, 0.36));       // into the open door
      cover(nearest(f), 1, push, lerp(focusX(f), 0.36, seg(p, 0.30, 0.36)), lerp(0.5, 0.42, seg(p, 0.30, 0.36)));
    }
    // the cabin, then the table
    const aCabin = ease(seg(p, 0.335, 0.36)) * (1 - seg(p, 0.48, 0.51));
    if (aCabin > 0) cover(stills.cabin, aCabin, reduce.matches ? 1 : lerp(1.16, 1.02, easeOut(seg(p, 0.32, 0.51))), 0.5, 0.5);
    const aMenu = seg(p, 0.48, 0.51) * (1 - seg(p, 0.58, 0.61));
    if (aMenu > 0) cover(stills.menu, aMenu, reduce.matches ? 1 : lerp(1.0, 1.1, seg(p, 0.48, 0.61)), 0.5, 0.4);
    // film again: the wing, the climb, the island
    if (p >= 0.58) {
      const f = filmAt(p);
      want = f;
      cover(nearest(f), seg(p, 0.58, 0.61), 1, focusX(f), 0.5);
    }
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------ words and instruments */
  const chaps = $$('[data-chap]');
  // [in start, in end, out start, out end]
  const CHAP = [[-1, -1, 0.055, 0.1], [0.18, 0.21, 0.28, 0.31], [0.37, 0.4, 0.455, 0.48], [0.505, 0.53, 0.57, 0.595], [0.625, 0.65, 0.69, 0.715], [0.75, 0.78, 0.835, 0.86], [0.905, 0.935, 2, 3]];
  const SHADE = [0.62, 0.55, 0.6, 0.25, 0.55, 0.5, 0.2];
  const out = { gs: $('[data-gs]'), hdg: $('[data-hdg]'), ete: $('[data-ete]'), alt: $('[data-alt]'), prog: $('[data-progress]') };
  const altAt = (p) => {
    if (p < 0.676) return 0;
    if (p < 0.84) return 45000 * easeOut(seg(p, 0.676, 0.84));
    if (p < 0.86) return 45000;
    return 45000 * (1 - ease(seg(p, 0.86, 0.955)));
  };
  const gsAt = (p) => {
    if (p < 0.62) return 0;
    if (p < 0.676) return 150 * seg(p, 0.62, 0.676);
    if (p < 0.8) return lerp(150, 470, easeOut(seg(p, 0.676, 0.8)));
    if (p < 0.86) return 470;
    if (p < 0.955) return lerp(470, 140, seg(p, 0.86, 0.955));
    return lerp(140, 60, seg(p, 0.955, 1));
  };
  const hdgAt = (p) => (p < 0.62 ? 274 : Math.round(lerp(274, 236, seg(p, 0.62, 0.955))));
  const eteAt = (p) => { const m = Math.round(138 * (1 - seg(p, 0, 0.955))); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
  const fmt = (n) => Math.round(n / 100) * 100;
  let lastText = {};
  function setText(key, v) { if (lastText[key] !== v) { lastText[key] = v; out[key].textContent = v; } }
  function words(p) {
    chaps.forEach((el, i) => {
      const [a, b, c, d] = CHAP[i];
      const vin = a < 0 ? 1 : seg(p, a, b), vout = 1 - seg(p, c, d);
      const v = Math.min(vin, vout);
      el.style.opacity = v.toFixed(3);
      const y = (1 - vin) * 26 - (1 - vout) * 18;
      el.style.transform = `translateY(${y.toFixed(1)}px)`;
      el.style.filter = v < 0.999 ? `blur(${((1 - v) * 6).toFixed(1)}px)` : '';
      el.classList.toggle('is-on', v > 0.001);
      el.setAttribute('aria-hidden', v > 0.5 ? 'false' : 'true');
    });
    // the left fall-off follows whichever chapter is on screen
    let k = 0; for (let i = 0; i < CHAP.length; i++) if (p >= (CHAP[i][0] < 0 ? 0 : CHAP[i][0]) - 0.02) k = i;
    flight.style.setProperty('--shade-l', SHADE[k]);
    setText('alt', fmt(altAt(p)).toLocaleString('en-US'));
    setText('gs', `${Math.round(gsAt(p))} kt`);
    setText('hdg', `${String(hdgAt(p)).padStart(3, '0')}°`);
    setText('ete', eteAt(p));
    out.prog.style.setProperty('--p', p.toFixed(4));
  }

  /* ------------------------------------------------ page geometry */
  const bar = $('[data-bar]');
  const fleet = $('[data-fleet]'), track = $('[data-fleet-track]'), count = $('[data-fleet-count]');
  const words4 = $$('.jet__word');
  const hall = $$('.frame');
  const map = $('[data-map]'), arcs = $$('.map__arcs path');
  const metal = $('[data-metal] .metal__face');
  const race = $('[data-race]');
  const lastSky = $('.last__sky');
  const rise = $$('.plan__copy, .book, .time > .statement, .time > .body, .race, .fleet__head, .details__copy, .runways__copy, .map, .card__copy, .metal, .last__copy');
  rise.forEach((el) => el.setAttribute('data-rise', ''));
  const shown = new WeakMap();
  arcs.forEach((pth) => pth.style.setProperty('--len', pth.getTotalLength().toFixed(1)));
  let M = {};
  function measure() {
    const sy = window.scrollY;
    const r = (el) => { const b = el.getBoundingClientRect(); return { top: b.top + sy, left: b.left, width: b.width, height: b.height }; };
    M = { vh: window.innerHeight, vw: window.innerWidth, flight: r(flight), fleet: r(fleet), map: r(map), race: r(race), last: r($('.last')), trackW: track.scrollWidth };
    buildRoute();
  }

  /* ------------------------------------------------ the route: one gold line, drawn as you fly down */
  const wrap = $('[data-route-wrap]'), svg = $('[data-route]'), path = $('[data-route-path]'), done = $('[data-route-done]'), tip = $('[data-route-tip]');
  let samples = [], total = 0;
  function buildRoute() {
    const W = wrap.clientWidth, H = wrap.clientHeight;
    const top = wrap.getBoundingClientRect().top + window.scrollY;
    const y = (el, f = 0) => { const b = el.getBoundingClientRect(); return b.top + window.scrollY - top + b.height * f; };
    const narrow = W < 700;
    const rx = narrow ? W - 10 : W - Math.max(18, parseFloat(getComputedStyle(html).getPropertyValue('--margin')) / 2 || 32);
    const plan = $('#plan'), time = $('.time'), details = $('#details'), runways = $('#runways'), card = $('#card'), last = $('.last');
    const pill = $('[data-last-pill]').getBoundingClientRect();
    const pillX = pill.right - wrap.getBoundingClientRect().left + 26, pillY = pill.top + window.scrollY - top + pill.height / 2;
    const x0 = narrow ? W * 0.8 : W * 0.56;
    const cardTop = y($('[data-book]'), 0) - 24;
    const d = [
      `M${x0} 0`,
      `C${x0} ${cardTop * 0.55}, ${rx} ${cardTop * 0.22}, ${rx} ${cardTop}`,
      `L${rx} ${y(plan, 0.6)}`,
      `L${rx} ${y(time, 0.5)}`,
      `C${rx} ${y(time, 0.85)}, ${rx - 40} ${y(time, 0.95)}, ${rx} ${y(details, 0.05)}`,
      `L${rx} ${y(runways, 0.5)}`,
      `C${rx} ${y(runways, 0.8)}, ${rx - 30} ${y(card, 0.1)}, ${rx} ${y(card, 0.3)}`,
      `L${rx} ${y(last, 0.25)}`,
      `C${rx} ${y(last, 0.5)}, ${pillX + 80} ${pillY}, ${pillX} ${pillY}`,
    ].join(' ');
    path.setAttribute('d', d); done.setAttribute('d', d);
    total = path.getTotalLength();
    done.style.strokeDasharray = `${total} ${total}`;
    samples = [];
    for (let l = 0; l <= total; l += 6) { const pt = path.getPointAtLength(l); samples.push([l, pt.y, pt.x]); }
    M.wrapTop = top;
  }
  function routeAt(scrollY) {
    if (!samples.length) return;
    const yLine = scrollY + M.vh * 0.62 - M.wrapTop;
    let lo = 0, hi = samples.length - 1;
    // the path only moves downwards, so the samples are ordered by y
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (samples[mid][1] <= yLine) lo = mid; else hi = mid - 1; }
    let len = samples[lo][0];
    if (yLine <= 0) len = 0;
    if (yLine >= samples[samples.length - 1][1]) len = total;
    done.style.strokeDashoffset = (total - len).toFixed(1);
    const a = path.getPointAtLength(Math.max(0, len - 2)), b = path.getPointAtLength(Math.min(total, len + 0.01));
    const ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    tip.setAttribute('transform', `translate(${b.x.toFixed(1)} ${b.y.toFixed(1)}) rotate(${ang.toFixed(1)})`);
    tip.style.opacity = len > 4 ? 1 : 0;
  }

  /* ------------------------------------------------ one frame of the page */
  let T = 0; // clock for the ticker in record mode
  function frame(scrollY) {
    // the flight
    const fl = M.flight;
    const p = clamp((scrollY - fl.top) / (fl.height - M.vh));
    P = p;
    draw();
    words(p);
    bar.classList.toggle('is-solid', scrollY > fl.top + fl.height - M.vh * 1.02);
    // the fleet: the track slides left while the stage is pinned
    if (M.vw > 700) {
      const fp = clamp((scrollY - M.fleet.top) / (M.fleet.height - M.vh));
      const travel = Math.max(0, M.trackW - M.vw);
      track.style.transform = `translate3d(${(-travel * ease(fp)).toFixed(1)}px, 0, 0)`;
      const idx = Math.min(3, Math.floor(fp * 4 + 0.15));
      const label = String(idx + 1).padStart(2, '0');
      if (count.textContent !== label) count.textContent = label;
      words4.forEach((w, i) => w.style.setProperty('--wx', `${((fp * 3 - i) * -60).toFixed(1)}px`));
    }
    // reveals
    // reveals happen once: a block that has arrived stays arrived when you scroll back up
    for (const el of rise) {
      const b = el.getBoundingClientRect();
      const v = reduce.matches ? 1 : Math.max(shown.get(el) || 0, easeOut(clamp((M.vh * 0.94 - b.top) / (M.vh * 0.26))));
      shown.set(el, v);
      el.style.setProperty('--in', v.toFixed(3));
    }
    // the hall: the frames swing a little as they pass
    hall.forEach((f) => {
      const b = f.getBoundingClientRect();
      const u = (b.top + b.height / 2 - M.vh / 2) / M.vh;
      f.style.setProperty('--sway', reduce.matches ? 0 : (Math.sin(u * 3.2 + Number(f.style.getPropertyValue('--i')) * 1.7) * 2.2).toFixed(2));
    });
    // the map: routes draw out from Linate
    const mp = clamp((scrollY + M.vh * 0.85 - M.map.top) / (M.map.height * 0.9));
    arcs.forEach((a, i) => a.style.setProperty('--draw', reduce.matches ? 1 : ease(clamp(mp * 1.6 - i * 0.12)).toFixed(3)));
    // the race: bars grow to their minutes
    race.style.setProperty('--fill', reduce.matches ? 1 : easeOut(clamp((scrollY + M.vh * 0.8 - M.race.top) / (M.vh * 0.45))).toFixed(3));
    // the last call: the sky settles
    lastSky.style.setProperty('--sky-scale', (1.14 - 0.08 * clamp((scrollY + M.vh - M.last.top) / (M.vh * 1.6))).toFixed(4));
    routeAt(scrollY);
    if (REC) $('[data-ticker]').style.transform = `translateX(${(-((T / 48) % 1) * 50).toFixed(3)}%)`;
  }

  let ticking = false;
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; frame(window.scrollY); }); } }
  function onResize() { resize(); measure(); frame(window.scrollY); }

  /* ------------------------------------------------ the metal card follows the pointer */
  if (metal && matchMedia('(hover: hover)').matches) {
    const host = metal.parentElement;
    host.addEventListener('pointermove', (e) => {
      if (reduce.matches) return;
      const b = host.getBoundingClientRect();
      const x = (e.clientX - b.left) / b.width - 0.5, y = (e.clientY - b.top) / b.height - 0.5;
      metal.style.setProperty('--tilt-y', (-16 + x * 18).toFixed(2));
      metal.style.setProperty('--tilt-x', (8 - y * 14).toFixed(2));
    });
    host.addEventListener('pointerleave', () => { metal.style.removeProperty('--tilt-y'); metal.style.removeProperty('--tilt-x'); });
  }

  /* ------------------------------------------------ the booking form */
  const form = $('[data-book]');
  if (form) {
    let pax = 4;
    const outPax = $('[data-pax-out]', form);
    const minus = $('[data-pax="-1"]', form), plus = $('[data-pax="1"]', form);
    const showPax = () => { outPax.textContent = `${pax} ${pax === 1 ? 'guest' : 'guests'}`; minus.disabled = pax <= 1; plus.disabled = pax >= 16; };
    $$('[data-pax]', form).forEach((b) => b.addEventListener('click', () => { pax = clamp(pax + Number(b.dataset.pax), 1, 16); showPax(); }));
    showPax();
    $('[data-swap]', form).addEventListener('click', () => { const a = form.elements.from, b = form.elements.to; [a.value, b.value] = [b.value, a.value]; });
    const date = form.elements.date;
    const tomorrow = new Date(Date.now() + 864e5); tomorrow.setHours(8, 30, 0, 0);
    const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
    date.min = iso(new Date()); date.value = iso(tomorrow);
    const note = $('[data-book-note]', form);
    const fields = ['from', 'to', 'date'];
    fields.forEach((n) => form.elements[n].addEventListener('input', () => form.elements[n].closest('.field').classList.remove('is-error')));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const missing = fields.filter((n) => !form.elements[n].value.trim());
      fields.forEach((n) => form.elements[n].closest('.field').classList.toggle('is-error', missing.includes(n)));
      note.classList.remove('is-done');
      if (missing.length) {
        const names = { from: 'where you leave from', to: 'where you are going', date: 'when' };
        note.textContent = `Add ${missing.map((m) => names[m]).join(' and ')} to get a quote.`;
        form.elements[missing[0]].focus();
        return;
      }
      const btn = $('button[type="submit"]', form);
      btn.setAttribute('aria-busy', 'true'); btn.textContent = 'Checking aircraft…';
      setTimeout(() => {
        btn.removeAttribute('aria-busy'); btn.textContent = 'Get an instant quote';
        note.classList.add('is-done');
        note.textContent = `${form.elements.from.value} to ${form.elements.to.value}, ${pax} ${pax === 1 ? 'guest' : 'guests'}: this is a design concept, so nothing was sent.`;
      }, 900);
    });
  }

  /* ------------------------------------------------ start */
  resize(); measure(); frame(window.scrollY);
  firstLoad.then(() => { draw(); });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  document.fonts && document.fonts.ready.then(() => { measure(); frame(window.scrollY); });
  window.addEventListener('load', () => { measure(); frame(window.scrollY); });

  // record mode: the capture script scrolls and steps the clock itself
  window.__af = {
    ready: allLoaded.then(() => document.fonts.ready).then(() => { measure(); frame(window.scrollY); }),
    info: () => ({ flight: M.flight, fleet: M.fleet, docH: document.documentElement.scrollHeight, vh: M.vh }),
    step({ scroll, t = 0 }) { T = t; window.scrollTo(0, scroll); frame(window.scrollY); return window.scrollY; },
  };
})();

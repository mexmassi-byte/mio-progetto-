/* ==========================================================================
   app.js — animation engine for the GTA VI concept page.

   Every animation is a pure function of (time, scroll, pointer). In normal
   browsing the clock is real time. With ?rec the page exposes window.__rec and
   is advanced frame-by-frame by the video renderer (deterministic, no jitter).
   ========================================================================== */
(function () {
  'use strict';

  const REC = new URLSearchParams(location.search).has('rec');
  const root = document.documentElement;
  if (REC) root.classList.add('rec');
  root.style.overflowAnchor = 'none';

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const E = {
    outExpo: (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)),
    outQuart: (p) => 1 - Math.pow(1 - p, 4),
    outCubic: (p) => 1 - Math.pow(1 - p, 3),
    inOutCubic: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    inOutSine: (p) => -(Math.cos(Math.PI * p) - 1) / 2,
  };
  const setVar = (el, name, v, cache, key) => {
    const s = typeof v === 'number' ? v.toFixed(4) : v;
    if (cache && cache[key] === s) return;
    if (cache) cache[key] = s;
    el.style.setProperty(name, s);
  };

  /* ---------------------------------------------------------- text split */
  function splitWords(el, cls) {
    // Wraps every word (also inside inline children) in .sw > .swi, copying the
    // child's class to each word so gradient text keeps working per word.
    const words = [];
    const walk = (node, inheritedClass) => {
      const out = [];
      node.childNodes.forEach((n) => {
        if (n.nodeType === 3) {
          const parts = n.textContent.split(/(\s+)/);
          for (const part of parts) {
            if (!part) continue;
            if (/^\s+$/.test(part)) { out.push(document.createTextNode(' ')); continue; }
            const outer = document.createElement('span'); outer.className = cls || 'sw';
            const inner = document.createElement('span'); inner.className = (cls ? 'wi' : 'swi') + (inheritedClass ? ' ' + inheritedClass : '');
            inner.textContent = part;
            outer.appendChild(inner); out.push(outer); words.push(outer);
          }
        } else if (n.nodeType === 1) {
          out.push(...walk(n, n.className));
        }
      });
      return out;
    };
    const nodes = walk(el, '');
    el.textContent = '';
    nodes.forEach((n) => el.appendChild(n));
    return words;
  }
  function splitStatement(el) {
    const words = [];
    const walk = (node, gold) => {
      const out = [];
      node.childNodes.forEach((n) => {
        if (n.nodeType === 3) {
          for (const part of n.textContent.split(/(\s+)/)) {
            if (!part) continue;
            if (/^\s+$/.test(part)) { out.push(document.createTextNode(' ')); continue; }
            const s = document.createElement('span'); s.className = 'wd' + (gold ? ' g' : ''); s.textContent = part;
            out.push(s); words.push(s);
          }
        } else if (n.nodeType === 1) out.push(...walk(n, gold || n.classList.contains('g')));
      });
      return out;
    };
    const nodes = walk(el, false);
    el.textContent = '';
    nodes.forEach((n) => el.appendChild(n));
    return words;
  }
  function splitChars(el, wrapCls) {
    const text = el.textContent;
    el.textContent = '';
    const chars = [];
    for (const ch of text) {
      if (wrapCls) {
        const o = document.createElement('span'); o.className = wrapCls;
        const i = document.createElement('span'); i.textContent = ch;
        if (ch === '.') o.classList.add('sep');
        o.appendChild(i); el.appendChild(o); chars.push(o);
      } else {
        const s = document.createElement('span'); s.className = 'ch';
        s.textContent = ch === ' ' ? ' ' : ch;
        el.appendChild(s); chars.push(s);
      }
    }
    return chars;
  }

  /* ------------------------------------------------------------- state */
  const S = {
    t: 0, lastT: null, dt: 1 / 60,
    scroll: 0, vw: innerWidth, vh: innerHeight,
    mx: -9999, my: -9999, cursorA: 0, press: 0,
    dpr: Math.min(2, window.devicePixelRatio || 1),
  };
  const docTop = (el) => { const r = el.getBoundingClientRect(); return r.top + (REC ? S.scroll : window.scrollY); };

  // intro (time-based) animations
  const intros = [];
  // scroll-triggered reveals
  const reveals = [];
  // hover targets
  const hovers = [];
  let statementWords = [], statementEl = null;
  let tlEl, tlNodes = [], tlFill;
  let hero = null, heroEl = null, heroCanvas = null;
  let eqBars = [];
  const cache = new WeakMap();
  const C = (el) => { let c = cache.get(el); if (!c) { c = {}; cache.set(el, c); } return c; };

  function setup() {
    // hero chars
    const top = document.querySelector('[data-chars]');
    const chars = splitChars(top);
    const base = parseFloat(top.dataset.chars);
    chars.forEach((ch, i) => intros.push({ el: ch, delay: base + i * 0.034, dur: 1.0, ease: E.outCubic }));
    // hero intro items
    document.querySelectorAll('[data-intro]').forEach((el) => {
      intros.push({ el, delay: parseFloat(el.dataset.intro), dur: parseFloat(el.dataset.introDur || 1.1), ease: el.dataset.ease === 'expo' ? E.outExpo : E.outQuart });
    });
    // hero subtitle (word mask)
    document.querySelectorAll('[data-split-intro]').forEach((el) => {
      const base2 = parseFloat(el.dataset.splitIntro);
      splitWords(el).forEach((w, i) => intros.push({ el: w, delay: base2 + i * 0.05, dur: 1.15, ease: E.outExpo }));
    });
    // generic reveals
    document.querySelectorAll('[data-reveal]').forEach((el) => {
      reveals.push({ el, delay: parseFloat(el.dataset.delay || 0), dur: el.dataset.reveal === 'fade' ? 1.3 : 1.2, ease: E.outQuart, start: null });
    });
    document.querySelectorAll('[data-reveal-card]').forEach((el) => {
      reveals.push({ el, delay: parseFloat(el.dataset.delay || 0), dur: 1.35, ease: E.outQuart, start: null });
    });
    document.querySelectorAll('[data-split]').forEach((el) => {
      const words = splitWords(el);
      const group = { el, delay: 0.05, dur: 1.2, ease: E.outExpo, start: null, words };
      reveals.push(group);
    });
    // finale date odometer
    const fd = document.getElementById('finaleDate');
    if (fd) {
      const chars2 = splitChars(fd, 'dch');
      reveals.push({ el: fd, delay: 0.15, dur: 1.3, ease: E.outExpo, start: null, words: chars2, stagger: 0.06 });
    }
    // statement
    statementEl = document.getElementById('statement');
    statementWords = splitStatement(statementEl);
    // timeline
    tlEl = document.getElementById('timeline');
    tlNodes = [...tlEl.querySelectorAll('.tl-node')];
    tlFill = tlEl.querySelector('.tl-track');
    // eq bars
    const eq = document.querySelector('.eq');
    if (eq) for (let i = 0; i < 28; i++) { const b = document.createElement('i'); eq.appendChild(b); eqBars.push(b); }
    // hover targets
    document.querySelectorAll('[data-hover]').forEach((el) => {
      hovers.push({
        el, h: 0, spot: el.hasAttribute('data-spot'), sweep: el.hasAttribute('data-sweep'),
        sweepStart: -10, mx: -1000, my: -1000, was: false,
        hand: el.matches('a, button, .feature-film, .clip'),
      });
    });
    heroEl = document.querySelector('.hero');
    heroCanvas = document.getElementById('heroArt');
  }

  function buildArt() {
    const dpr = REC ? 2 : S.dpr;
    hero = new window.ViceArt.ViceHero(heroCanvas);
    const r = heroCanvas.getBoundingClientRect();
    hero.build(Math.round(r.width * dpr), Math.round(r.height * dpr));
    document.querySelectorAll('canvas[data-art]').forEach((cv) => {
      const rr = cv.getBoundingClientRect();
      cv.width = Math.round(rr.width * dpr); cv.height = Math.round(rr.height * dpr);
      window.ViceArt.scene(cv, cv.dataset.art);
    });
  }

  function measure() {
    S.vw = innerWidth; S.vh = innerHeight;
    for (const r of reveals) r.top = docTop(r.el);
    S.statementTop = docTop(statementEl);
    S.statementH = statementEl.offsetHeight;
    S.tlTop = docTop(tlEl);
    S.heroH = heroEl.offsetHeight;
    S.docH = document.documentElement.scrollHeight;
  }

  /* ------------------------------------------------------------- update */
  function update() {
    const { t, dt, scroll, vh } = S;

    // intro animations
    for (const it of intros) {
      const p = it.ease(clamp((t - it.delay) / it.dur, 0, 1));
      setVar(it.el, '--p', p, C(it.el), 'p');
    }

    // scroll-triggered reveals
    for (const r of reveals) {
      if (r.start === null && r.top < scroll + vh * 0.86) r.start = t;
      if (r.words) {
        const st = r.stagger || 0.045;
        r.words.forEach((w, i) => {
          const p = r.start === null ? 0 : r.ease(clamp((t - r.start - r.delay - i * st) / r.dur, 0, 1));
          setVar(w, '--p', p, C(w), 'p');
        });
      } else {
        const p = r.start === null ? 0 : r.ease(clamp((t - r.start - r.delay) / r.dur, 0, 1));
        setVar(r.el, '--p', p, C(r.el), 'p');
      }
    }

    // statement: scroll-linked word highlight
    {
      const start = S.statementTop - vh * 0.72;
      const end = S.statementTop + S.statementH - vh * 0.78;
      const prog = clamp((scroll - start) / Math.max(1, end - start), 0, 1);
      const n = statementWords.length;
      statementWords.forEach((w, i) => {
        const v = clamp(prog * (n + 6) - i, 0, 1);
        setVar(w, '--w', E.inOutSine(v), C(w), 'w');
      });
      const bg = document.querySelector('.statement-bg');
      setVar(bg, '--par', -(scroll - S.statementTop) * 0.22, C(bg), 'par');
    }

    // timeline fill: plays once (time-based) when the timeline comes into view
    {
      if (S.tlStart == null && S.tlTop < scroll + vh * 0.82) S.tlStart = t;
      const prog = S.tlStart == null ? 0 : clamp((t - S.tlStart - 0.25) / 2.6, 0, 1);
      const f = E.inOutCubic(prog);
      setVar(tlFill, '--tl', f, C(tlFill), 'tl');
      tlNodes.forEach((n, i) => {
        const at = i / (tlNodes.length - 1);
        const on = clamp((f - at + 0.04) / 0.06, 0, 1);
        setVar(n, '--on', on, C(n), 'on');
        n.classList.toggle('on', on > 0.5);
      });
    }

    // ambient time-based details
    const pulse = document.querySelector('.pulse');
    setVar(pulse, '--pulse', (t % 1.8) / 1.8, C(pulse), 'pulse');
    const cue = document.querySelector('.scroll-cue i');
    setVar(cue, '--cue', E.inOutSine((t % 2.2) / 2.2), C(cue), 'cue');
    const vi = document.querySelector('.ht-vi-text');
    const shineIntro = E.inOutCubic(clamp((t - 2.0) / 1.8, 0, 1));
    setVar(vi, '--shine', 0.05 + shineIntro * 0.62 + Math.sin(t * 0.35) * 0.06 * shineIntro, C(vi), 'shine');
    document.querySelectorAll('.brand-mark').forEach((b, i) => setVar(b, '--shine', 0.5 + Math.sin(t * 0.5 + i) * 0.35, C(b), 'shine'));
    document.querySelectorAll('.serif-i, .gold-text').forEach((g, i) => setVar(g, '--shine', 0.5 + Math.sin(t * 0.45 + i * 0.7) * 0.4, C(g), 'shine'));
    document.querySelectorAll('.finale-date .dch > span').forEach((g, i) => setVar(g, '--shine', 0.5 + Math.sin(t * 0.5 + i * 0.4) * 0.45, C(g), 'shine'));
    const bar = document.querySelector('.hc-bar');
    setVar(bar, '--bar', E.outCubic(clamp((t - 3.0) / 2.2, 0, 1)) * (8 / 9), C(bar), 'bar');
    const ring = document.getElementById('ffPlay');
    setVar(ring, '--ring', (t % 2.6) / 2.6, C(ring), 'ring');
    setVar(ring, '--ring2', ((t + 1.3) % 2.6) / 2.6, C(ring), 'ring2');
    const ult = document.getElementById('ultimate');
    setVar(ult, '--spin', t * 0.07, C(ult), 'spin');
    eqBars.forEach((b, i) => {
      const v = 0.18 + 0.82 * Math.abs(Math.sin(t * (1.6 + (i % 5) * 0.37) + i * 0.9) * Math.sin(t * 0.7 + i * 0.33));
      setVar(b, '--eq', v, C(b), 'eq');
    });
    const nav = document.getElementById('nav');
    setVar(nav, '--solid', clamp(scroll / 300, 0, 1), C(nav), 'solid');
    const prog = document.querySelector('#progress span');
    setVar(prog, '--sp', clamp(scroll / Math.max(1, S.docH - vh), 0, 1), C(prog), 'sp');

    // hover (pointer driven)
    const hovered = new Set();
    let hand = false;
    if (S.cursorA > 0.05 && S.mx > -1000) {
      let el = document.elementFromPoint(S.mx, S.my);
      while (el && el !== document.body) {
        if (el.hasAttribute && el.hasAttribute('data-hover')) hovered.add(el);
        el = el.parentElement;
      }
    }
    for (const h of hovers) {
      const on = hovered.has(h.el);
      if (on && h.hand) hand = true;
      if (on && !h.was && h.sweep) h.sweepStart = t;
      h.was = on;
      const tau = on ? 0.13 : 0.24;
      h.h += ((on ? 1 : 0) - h.h) * (1 - Math.exp(-dt / tau));
      if (Math.abs(h.h) < 0.0005) h.h = 0;
      setVar(h.el, '--h', h.h, C(h.el), 'h');
      setVar(h.el, '--press', on ? S.press : 0, C(h.el), 'press');
      if (h.spot && (on || h.h > 0.001)) {
        if (on) { const rr = h.el.getBoundingClientRect(); h.mx = S.mx - rr.left; h.my = S.my - rr.top; }
        setVar(h.el, '--mx', h.mx, C(h.el), 'mx');
        setVar(h.el, '--my', h.my, C(h.el), 'my');
      }
      if (h.sweep) setVar(h.el, '--sweep', E.inOutCubic(clamp((t - h.sweepStart) / 1.0, 0, 1)), C(h.el), 'sweep');
    }
    // one idle sweep on the hero CTA after the intro
    const hp = document.getElementById('heroPreorder');
    const hpH = hovers.find((x) => x.el === hp);
    if (hpH && hpH.sweepStart < 0 && t > 3.1) hpH.sweepStart = 3.1;

    // hero art
    if (hero && scroll < S.heroH + 50) {
      hero.draw(t, { intro: clamp(t / 4.2, 0, 1), fade: clamp(t / 1.5, 0, 1), scroll, dpr: REC ? 2 : S.dpr });
    }

    // simulated cursor
    if (REC) {
      cursor.style.opacity = S.cursorA.toFixed(3);
      cursor.style.transform = `translate3d(${S.mx.toFixed(2)}px, ${S.my.toFixed(2)}px, 0)`;
      const kind = hand ? 'hand' : 'arrow';
      if (cursor.dataset.kind !== kind) { cursor.dataset.kind = kind; cursor.innerHTML = kind === 'hand' ? HAND : ARROW; }
    }
  }

  /* -------------------------------------------------------- cursor art */
  // macOS-style arrow (tip at 0,0) and pointing hand (fingertip at ~6,1).
  const ARROW = '<svg viewBox="0 0 32 32"><path d="M1.2 1.2 L1.2 22.6 L6.3 17.7 L9.6 25.4 L13.2 23.9 L9.9 16.3 L16.9 16.3 Z" fill="#000" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  const HAND = '<svg viewBox="0 0 32 32" style="transform:translate(-7px,-1px)"><path d="M9.3 2.1c1.2 0 2 .9 2 2.1v7.6c.2-.6.9-1 1.6-1 1 0 1.7.7 1.8 1.6.3-.5.9-.8 1.5-.8 1 0 1.7.7 1.8 1.7.3-.4.8-.6 1.3-.6 1.1 0 1.9.9 1.9 2v5.6c0 4.2-2.6 7.3-6.9 7.3h-1.8c-2.4 0-4-.9-5.3-2.7l-4.1-5.8c-.6-.9-.4-2 .4-2.6.8-.6 1.9-.5 2.6.3l1.1 1.3V4.2c0-1.2.9-2.1 2-2.1z" fill="#fff" stroke="#000" stroke-width="1.3" stroke-linejoin="round"/><path d="M13 18.2v4.4M15.7 18.2v4.4M18.4 18.2v4.4" stroke="#000" stroke-width="1.1" stroke-linecap="round"/></svg>';
  const cursor = document.getElementById('rec-cursor');
  const scrollers = [...document.querySelectorAll('body > section, body > footer')];

  /* --------------------------------------------------------------- boot */
  let resolveReady;
  const ready = new Promise((r) => (resolveReady = r));

  async function boot() {
    await document.fonts.ready;
    await Promise.all([...document.fonts].filter((f) => f.status !== 'loaded').map((f) => f.load().catch(() => {})));
    setup();
    buildArt();
    measure();
    if (!REC) {
      const t0 = performance.now();
      window.addEventListener('scroll', () => { S.scroll = window.scrollY; }, { passive: true });
      window.addEventListener('pointermove', (e) => { S.mx = e.clientX; S.my = e.clientY; S.cursorA = 1; });
      window.addEventListener('pointerleave', () => { S.cursorA = 0; });
      window.addEventListener('resize', () => { measure(); });
      const loop = (now) => {
        const t = (now - t0) / 1000;
        S.dt = S.lastT == null ? 1 / 60 : clamp(t - S.lastT, 0, 0.1);
        S.lastT = t; S.t = t; S.scroll = window.scrollY;
        update();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    } else {
      for (const el of scrollers) { el.style.willChange = 'transform'; el.style.transform = 'translate3d(0, 0px, 0)'; }
      S.frac = '0.00';
      update();
    }
    resolveReady();
  }

  // Deterministic control surface for the video renderer.
  window.__rec = {
    ready,
    info() {
      measure();
      // measure the settled layout: temporarily force every animated element to p=1
      const animated = [...document.querySelectorAll('[data-intro], [data-reveal], [data-reveal-card], .sw, .ch, .dch')];
      const saved = animated.map((el) => el.style.getPropertyValue('--p'));
      animated.forEach((el) => el.style.setProperty('--p', '1'));
      const rect = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left, y: r.top + S.scroll, w: r.width, h: r.height };
      };
      return {
        vw: S.vw, vh: S.vh, docH: S.docH,
        anchors: {
          navOverview: rect('.nav-link:nth-child(1)'), navPreorder: rect('.nav-link:nth-child(2)'),
          navMedia: rect('.nav-link:nth-child(3)'), navEditions: rect('.nav-link:nth-child(4)'),
          heroCta: rect('#heroPreorder'), heroTrailer: rect('.hero-ctas .btn-glass'),
          story: rect('#story'), statement: rect('#statement'), features: rect('#features'), bento: rect('.bento'),
          cardXL: rect('.card-xl'), places: rect('.places'), leonida: rect('#leonida'), cast: rect('#cast'), duo: rect('.duo'),
          supporting: rect('.supporting'), media: rect('#media'), film: rect('#launchTrailer'), filmPlay: rect('#ffPlay'),
          reel: rect('.reel'), timeline: rect('#timeline'), editions: rect('#editions'), editionCards: rect('.editions'),
          ultimate: rect('#ultimate'), ultimateBtn: rect('#ultimateBtn'), bonus: rect('.bonus-strip'),
          finale: rect('#preorder'), finalCta: rect('#finalCta'), footer: rect('.footer'),
        },
        restore: animated.forEach((el, i) => el.style.setProperty('--p', saved[i])),
      };
    },
    step(s) {
      S.dt = S.lastT == null ? 1 / 60 : clamp(s.t - S.lastT, 0, 0.1);
      S.lastT = s.t; S.t = s.t;
      S.scroll = s.scroll;
      // Retina-accurate scrolling: Chromium snaps scroll offsets to whole CSS px, a real
      // MacBook scrolls in device pixels (0.5 CSS px at 2x). Scroll natively by the integer
      // part and move the page content by the remaining half pixel (fixed nav/cursor stay put).
      const yd = Math.round(s.scroll * 2) / 2;
      const yi = Math.floor(yd);
      window.scrollTo(0, yi);
      const frac = (yd - yi).toFixed(2);
      if (frac !== S.frac) { S.frac = frac; for (const el of scrollers) el.style.transform = `translate3d(0, ${-frac}px, 0)`; }
      S.mx = s.mx; S.my = s.my; S.cursorA = s.cursor; S.press = s.press || 0;
      update();
      return window.scrollY;
    },
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();

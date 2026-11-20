/* Vice City After Dark — behaviour.
   Live: the light switch (defaults to the real time in Miami), scroll-linked reel and film track,
   reveals once, loops that pause off screen, the fan film player.
   Record mode (?rec): every moving thing is a pure function of (t, scroll, lights) driven by
   window.__rec.step(), so the video renderer gets the same frame every time. */
(() => {
  const html = document.documentElement;
  const REC = html.classList.contains('rec');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const smooth = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
  const expoOut = (u) => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * u));
  const quintOut = (u) => 1 - Math.pow(1 - u, 5);
  const inOut = (u) => (u < 0.5 ? 8 * u ** 4 : 1 - Math.pow(-2 * u + 2, 4) / 2);

  /* ---------------------------------------------------------- signs: one span per letter */
  // the signs are drawn in the markup as SVG (one <text> per letter), so they light without script too

  /* ---------------------------------------------------------- the light switch */
  const toggle = $('[data-lights-toggle]');
  const clock = $('[data-clock]');
  const setLights = (on) => {
    html.dataset.lights = on ? 'on' : 'off';
    toggle.setAttribute('aria-pressed', String(on));
    $('meta[name="theme-color"]').setAttribute('content', on ? '#082445' : '#f4bcc8');
  };
  function viceCityHour() {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(new Date());
    const get = (type) => parts.find((p) => p.type === type)?.value || '';
    const h12 = Number(get('hour')), m = Number(get('minute')), pm = get('dayPeriod').toLowerCase().startsWith('p');
    clock.textContent = `${h12}:${String(m).padStart(2, '0')} ${pm ? 'pm' : 'am'} in Vice City`; // taste-skill-ignore: a clock
    return (h12 % 12) + (pm ? 12 : 0) + m / 60;
  }
  if (!REC) {
    const hour = viceCityHour();
    // late-November sunset and sunrise in Miami
    setLights(hour >= 17.7 || hour < 6.8);
    setInterval(viceCityHour, 30000);
    toggle.addEventListener('click', () => setLights(html.dataset.lights !== 'on'));
  }

  /* ---------------------------------------------------------- layout measures */
  const hero = $('.hero'), reel = $('[data-reel]'), films = $('[data-films]'), track = $('[data-films-track]');
  const nFrames = $$('.reel__frame').length;
  const M = {};
  function measure() {
    const sy = REC ? S.scroll : scrollY;
    const top = (el) => el.getBoundingClientRect().top + sy;
    M.vh = innerHeight; M.vw = innerWidth;
    M.heroTop = top(hero); M.heroH = hero.offsetHeight;
    M.filmsTop = top(films); M.filmsH = films.offsetHeight;
    M.trackW = track.scrollWidth;
    M.pinned = getComputedStyle($('.films__stage')).position === 'sticky';
    M.docH = document.documentElement.scrollHeight;
  }

  /* ---------------------------------------------------------- scroll-linked: reel and films */
  function scrollFrame(y) {
    // the reel holds each picture, then travels to the next one
    const p = clamp((y - M.heroTop) / Math.max(1, M.heroH - M.vh), 0, 1) * (nFrames - 1);
    const base = Math.min(nFrames - 2, Math.floor(p));
    const step = reduce ? Math.round(p) : base + inOut(smooth(0.2, 0.8, p - base));
    reel.style.setProperty('--reel', step.toFixed(4));
    if (M.pinned && !reduce) {
      const q = clamp((y - M.filmsTop) / Math.max(1, M.filmsH - M.vh), 0, 1);
      const travel = Math.max(0, M.trackW - M.vw * 0.62);
      track.style.setProperty('--tx', `${(-q * travel).toFixed(1)}px`);
    }
  }

  /* ---------------------------------------------------------- loops: play only on screen */
  const loops = $$('video[data-loop]');
  if (!REC) {
    if (!reduce && 'IntersectionObserver' in window) {
      const vio = new IntersectionObserver((entries) => {
        for (const e of entries) { if (e.isIntersecting) e.target.play().catch(() => {}); else e.target.pause(); }
      }, { threshold: 0.15 });
      loops.forEach((v) => vio.observe(v));
    }
  }

  /* ---------------------------------------------------------- reveals: once, never hiding content for long */
  const reveals = $$('[data-reveal]');
  if (!REC) {
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      }, { rootMargin: '0px 0px -6% 0px', threshold: 0 });
      reveals.forEach((el) => io.observe(el));
    } else reveals.forEach((el) => el.classList.add('is-in'));
    addEventListener('load', () => setTimeout(() => reveals.forEach((el) => {
      const r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) el.classList.add('is-in');
    }), 2500));
  }

  /* ---------------------------------------------------------- the fan film player */
  const player = $('[data-player]'), playerVideo = $('[data-player-video]');
  $$('[data-open-film]').forEach((el) => el.addEventListener('click', (e) => {
    if (REC || !player.showModal) return;
    e.preventDefault();
    player.showModal();
    playerVideo.play().catch(() => {});
  }));
  $('[data-close-film]').addEventListener('click', () => { playerVideo.pause(); player.close(); });
  player.addEventListener('close', () => playerVideo.pause());

  /* ---------------------------------------------------------- live loop */
  const S = { t: 0, tl: 0, scroll: 0, frac: '0.00', lights: 0, lightsAt: null, reveal: new Map() };
  if (!REC) {
    measure();
    let ticking = false;
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; scrollFrame(scrollY); }); } };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', () => { measure(); scrollFrame(scrollY); });
    document.fonts.ready.then(() => { measure(); scrollFrame(scrollY); });
    scrollFrame(scrollY);
    return;
  }

  /* ========================================================== record mode */
  const scrollers = $$('body > header, body > main, body > footer');
  const heroA = $('.hero__a'), heroB = $('.hero__b'), lede = $('.hero__lede');
  const letters = $$('.sign-svg .l');
  // the keyframes of a tube catching (same as the CSS flicker)
  const FL = [[0, 0], [0.12, 1], [0.18, 0.15], [0.34, 1], [0.4, 0.35], [0.56, 1], [1, 1]];
  const flicker = (u) => {
    if (u <= 0) return 0; if (u >= 1) return 1;
    for (let i = 0; i < FL.length - 1; i++) if (u <= FL[i + 1][0]) {
      const [a, va] = FL[i], [b, vb] = FL[i + 1]; return va + (vb - va) * ((u - a) / (b - a));
    }
    return 1;
  };
  function setStyle(el, o, ty) { el.style.opacity = o.toFixed(3); el.style.transform = ty ? `translateY(${ty.toFixed(2)}px)` : ''; }

  async function seekVideos(t) {
    const jobs = [];
    for (const v of loops) {
      const r = v.getBoundingClientRect();
      if (r.bottom < -50 || r.top > innerHeight + 50 || !v.duration) continue;
      const want = (t % v.duration);
      if (Math.abs(v.currentTime - want) < 1 / 120) continue;
      jobs.push(new Promise((res) => { const done = () => { v.removeEventListener('seeked', done); res(); }; v.addEventListener('seeked', done); v.currentTime = want; setTimeout(res, 1500); }));
    }
    await Promise.all(jobs);
  }

  function update() {
    const { t } = S;
    // load sequence (settled by 1.2 s), on its own clock
    {
      const t = S.tl;
      setStyle(heroA, smooth(0, 0.25, t), (1 - expoOut(clamp(t / 0.9, 0, 1))) * 22);
      setStyle(heroB, smooth(0.09, 0.34, t), (1 - expoOut(clamp((t - 0.09) / 0.9, 0, 1))) * 22);
      const op = inOut(clamp((t - 0.12) / 1.2, 0, 1));
      reel.style.clipPath = op >= 1 ? '' : `inset(${(50 * (1 - op)).toFixed(2)}% 0 ${(50 * (1 - op)).toFixed(2)}% 0)`;
      setStyle(lede, quintOut(clamp((t - 0.38) / 0.7, 0, 1)), 0);
    }
    // reveals: fire once when the top passes 88% of the screen
    for (const el of reveals) {
      if (!S.reveal.has(el) && el.getBoundingClientRect().top < M.vh * 0.88) S.reveal.set(el, t);
      const t0 = S.reveal.get(el);
      if (t0 == null) { setStyle(el, 0, 24); continue; }
      setStyle(el, quintOut(clamp((t - t0) / 0.7, 0, 1)), (1 - expoOut(clamp((t - t0) / 0.9, 0, 1))) * 24);
    }
    // lights: the whole palette, then each sign letter catches
    html.dataset.lights = S.lights > 0.5 ? 'on' : 'off';
    html.style.setProperty('--k', S.lights.toFixed(4));
    for (const l of letters) {
      const i = Number(l.style.getPropertyValue('--i')) || 0;
      const off = S.lightsOffAt == null ? 1 : 1 - smooth(S.lightsOffAt, S.lightsOffAt + 0.25, t);
      const on = (S.lightsAt == null ? 0 : flicker((t - S.lightsAt - 0.26 - i * 0.07) / 0.62)) * off;
      l.style.setProperty('--on', on.toFixed(3));
    }
    scrollFrame(S.scroll);
  }

  let resolveReady;
  const ready = new Promise((r) => (resolveReady = r));
  (async () => {
    await document.fonts.ready;
    await Promise.all($$('img').map((img) => (img.complete ? null : new Promise((r) => { img.loading = 'eager'; img.onload = img.onerror = r; }))));
    await Promise.all(loops.map((v) => new Promise((r) => { v.preload = 'auto'; if (v.readyState >= 1) r(); else { v.onloadedmetadata = r; v.load(); setTimeout(r, 4000); } })));
    for (const el of scrollers) { el.style.willChange = 'transform'; el.style.transform = 'translate3d(0, 0px, 0)'; }
    measure();
    update();
    resolveReady();
  })();

  const rect = (el) => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top + S.scroll, w: r.width, h: r.height }; };
  window.__rec = {
    ready,
    info() {
      measure();
      return {
        vw: M.vw, vh: M.vh, docH: M.docH,
        anchors: {
          hero: rect(hero), walk: rect($('.walk')), places: rect($('.places')), curtain: rect($('.curtain')),
          duo: rect($('.duo')), films: rect(films), filmOurs: rect($('.film--ours .film__media')), road: rect($('.road')),
          close: rect($('.close')), foot: rect($('.foot')), lights: rect(toggle), cta: rect($('.bar .btn')),
        },
      };
    },
    // s: { t, tLoad (load-sequence clock, defaults to t), scroll, lights (0..1), lightsAt / lightsOffAt (s or null), press: css selector or null }
    async step(s) {
      S.t = s.t; S.tl = s.tLoad ?? s.t; S.scroll = s.scroll; S.lights = s.lights ?? 0; S.lightsAt = s.lightsAt ?? null; S.lightsOffAt = s.lightsOffAt ?? null;
      // device-pixel scrolling: native scroll to the whole pixel, the rest as a sub-pixel shift
      const yd = Math.round(s.scroll * 3) / 3, yi = Math.floor(yd), frac = (yd - yi).toFixed(2);
      window.scrollTo(0, yi);
      if (frac !== S.frac) { S.frac = frac; for (const el of scrollers) el.style.transform = `translate3d(0, ${-frac}px, 0)`; }
      $$('.is-pressed').forEach((el) => el.classList.remove('is-pressed'));
      if (s.press) $$(s.press).forEach((el) => el.classList.add('is-pressed'));
      update();
      await seekVideos(s.t);
      return window.scrollY;
    },
  };
})();

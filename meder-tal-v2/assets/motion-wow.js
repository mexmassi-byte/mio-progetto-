/* Meder & Tal: the element choreography (GSAP 3, ScrollTrigger, SplitText, self-hosted).
   Asked for by the client: the words, rows, cards, lines and buttons move too, cinematically.
   Rules kept from design-motion-principles: one easing family (expo/power out), entrances 0.8-1.4 s,
   transform, opacity, clip-path and filter only, nothing loops, everything plays once and rests,
   reduced motion shows every element in place at once. The kit's own moments
   (word-highlight, picture-develops, photo-chapters) are left alone. */
(function () {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  const curtain = document.querySelector('[data-curtain]');
  const CUT = 'mt-cut';

  /* ---------------------------------------------------------------- the cut between pages
     Two black bars close like a letterbox over the page, the next page's name shows, the bars open
     on the new page. Same-site links only; a new tab, a download or an anchor on the same page skip it. */
  function openCurtain(after) {
    if (!curtain) return after && after();
    const card = curtain.querySelector('[data-curtain-card]');
    let name = '';
    try { name = sessionStorage.getItem(CUT) || ''; sessionStorage.removeItem(CUT); } catch (e) { /* storage blocked */ }
    if (!name || reduced || !window.gsap) { curtain.hidden = true; root.classList.remove('is-cut'); return after && after(); }
    card.textContent = name;
    gsap.timeline({ onComplete: () => { curtain.hidden = true; root.classList.remove('is-cut'); } })
      .set(curtain, { autoAlpha: 1 })
      .set('[data-curtain-bar]', { scaleY: 1 })
      .fromTo(card, { autoAlpha: 1 }, { autoAlpha: 0, y: -10, duration: 0.35, ease: 'power2.in', delay: 0.15 })
      .to('[data-curtain-bar="top"]', { scaleY: 0, duration: 0.9, ease: 'expo.inOut' }, '<0.1')
      .to('[data-curtain-bar="bottom"]', { scaleY: 0, duration: 0.9, ease: 'expo.inOut' }, '<')
      .add(() => after && after(), '<0.35');
  }

  function closeCurtain(href, name) {
    if (!curtain || reduced || !window.gsap) { location.href = href; return; }
    try { sessionStorage.setItem(CUT, name); } catch (e) { location.href = href; return; }
    const card = curtain.querySelector('[data-curtain-card]');
    card.textContent = name;
    curtain.hidden = false;
    gsap.timeline({ onComplete: () => { location.href = href; } })
      .set(curtain, { autoAlpha: 1 })
      .fromTo('[data-curtain-bar]', { scaleY: 0 }, { scaleY: 1, duration: 0.6, ease: 'expo.inOut' })
      .fromTo(card, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power3.out' }, '-=0.2')
      .to({}, { duration: 0.15 });
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target && a.target !== '_self') return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !/\.html$|\/$/.test(url.pathname)) return;
    if (url.pathname === location.pathname) return; // anchors on this page scroll as usual
    e.preventDefault();
    const name = a.dataset.cut || (a.closest('.nav, .closing__links, .menu-col, .menu-card') ? a.textContent.trim().split('\n')[0] : '') || 'Meder & Tal';
    closeCurtain(url.href, name.length > 40 ? 'Meder & Tal' : name);
  });
  // back and forward: the browser may restore a page with the curtain still drawn
  addEventListener('pageshow', (e) => { if (e.persisted && curtain) { curtain.hidden = true; gsap && gsap.set('[data-curtain-bar]', { scaleY: 0 }); } });

  if (reduced || !window.gsap) { root.classList.remove('mt-pre'); openCurtain(); return; }

  gsap.registerPlugin(ScrollTrigger, SplitText);
  const ease = 'expo.out';

  /* lines of a heading rise out of a mask and come into focus */
  function riseLines(el, vars = {}) {
    if (!el) return null;
    const split = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'mt-line' });
    return gsap.from(split.lines, {
      yPercent: 115, filter: 'blur(6px)', duration: 1.25, ease, stagger: 0.09,
      ...vars, onComplete() { split.revert(); vars.onComplete && vars.onComplete(); },
    });
  }
  const once = (trigger, start = 'top 82%') => ({ trigger, start, once: true });

  /* the home film: the letterbox opens on the footage, then the words exhale in, word by word
     (MotionSites: cinematic video hero + staggered blur-rise + word-by-word blur-in) */
  function heroCine(hero) {
    const plate = hero.querySelector('.hero-cine__plate');
    const tl = gsap.timeline({ delay: 0.1 });
    tl.fromTo(plate, { clipPath: 'inset(13% 0% 13% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.8, ease: 'expo.inOut' }, 0)
      .from(plate.querySelector('video'), { scale: 1.14, duration: 2.8, ease: 'expo.out' }, 0)
      .from('.nav__logo, .nav__links, .nav__actions .btn', { y: -16, autoAlpha: 0, duration: 0.9, ease, stagger: 0.06 }, 0.9)
      .from(hero.querySelector('.hero-cine__badge'), { y: 16, autoAlpha: 0, filter: 'blur(8px)', duration: 0.9, ease }, 1.0);
    const h1 = hero.querySelector('h1');
    const split = SplitText.create(h1, { type: 'words', wordsClass: 'mt-word' });
    tl.from(split.words, { y: 34, autoAlpha: 0, filter: 'blur(14px)', duration: 1.2, ease, stagger: 0.07, onComplete: () => split.revert() }, 1.15)
      .from(hero.querySelector('.hero-cine__lead'), { y: 20, autoAlpha: 0, filter: 'blur(8px)', duration: 1, ease }, 1.7)
      .from(hero.querySelectorAll('.hero-cine__actions > *'), { y: 18, autoAlpha: 0, duration: 0.9, ease, stagger: 0.1 }, 1.9)
      .from(hero.querySelectorAll('.hero-cine__foot > *'), { y: 12, autoAlpha: 0, duration: 0.8, ease, stagger: 0.1 }, 2.1);
    // leaving the hero: the film sinks back and the words drift up, scrubbed to the scroll
    gsap.timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.5 } })
      .to(plate, { scale: 0.94, borderRadius: 28, ease: 'none' }, 0)
      .to(hero.querySelector('.hero-cine__content'), { yPercent: -18, autoAlpha: 0.2, ease: 'none' }, 0);
  }

  function heroes() {
    const cine = document.querySelector('[data-hero-cine]');
    if (cine) return heroCine(cine);
    const hero = document.querySelector('main .hero');
    if (!hero) return;
    const tl = gsap.timeline({ delay: hero.classList.contains('hero--cine') ? 0.85 : 0.2 });
    // the nav arrives with the first shot
    tl.from('.nav__logo, .nav__links .nav__item, .nav__actions .btn', { y: -14, autoAlpha: 0, duration: 0.8, ease, stagger: 0.05 }, 0);
    const box = hero.querySelector('.hero__over > :first-child');
    if (box) tl.from(box, { yPercent: 18, autoAlpha: 0, duration: 1.1, ease }, 0.1);
    const h1 = hero.querySelector('h1');
    if (h1) {
      const split = SplitText.create(h1, { type: 'lines,words', mask: 'lines', linesClass: 'mt-line' });
      tl.from(split.words, { yPercent: 120, rotate: 4, transformOrigin: '0% 100%', duration: 1.3, ease, stagger: 0.045, onComplete: () => split.revert() }, 0.25);
    }
    tl.from(hero.querySelectorAll('.hero__kicker, .hero__lead'), { y: 24, autoAlpha: 0, filter: 'blur(8px)', duration: 1, ease, stagger: 0.1 }, 0.7)
      .from(hero.querySelectorAll('.btn-row .btn'), { y: 18, scale: 0.94, autoAlpha: 0, duration: 0.8, ease: 'back.out(1.6)', stagger: 0.08 }, 0.95);
    const media = hero.querySelector('.hero--split .hero__media');
    if (media) {
      tl.from(media, { clipPath: 'inset(0 0 0 100% round 20px)', duration: 1.5, ease: 'expo.inOut' }, 0.1)
        .from(media.querySelectorAll('img'), { scale: 1.25, duration: 2.2, ease }, 0.1);
      const float = media.querySelector('.ly-float');
      if (float) tl.from(float, { y: 30, autoAlpha: 0, duration: 0.9, ease }, 1.1);
    }
    const bg = hero.querySelector('.hero__bg');
    if (bg) tl.from(bg, { scale: 1.2, filter: 'brightness(.4)', duration: 2.6, ease }, 0);
    const facts = hero.querySelectorAll('.hero__facts > div');
    if (facts.length) {
      tl.from(hero.querySelector('.hero__facts'), { '--mt-rule': 0, duration: 1.2, ease: 'expo.inOut' }, 0.9)
        .from(facts, { y: 20, autoAlpha: 0, duration: 0.9, ease, stagger: 0.08 }, 1.1);
    }
    const toggle = hero.querySelector('.film-toggle');
    if (toggle) tl.from(toggle, { x: 20, autoAlpha: 0, duration: 0.9, ease }, 1.2);
  }

  function sections() {
    // every section heading but the hero's and the kit's moments
    document.querySelectorAll('main .section h2, .closing__cta h2').forEach((h2) => {
      if (h2.closest('[data-moment="photo-chapters"]')) return;
      riseLines(h2, { scrollTrigger: once(h2, 'top 85%') });
    });
    document.querySelectorAll('main .section-head > p, main .t-lead:not(.hero__lead), .closing__cta .section-head p').forEach((p) => {
      if (p.closest('.hero')) return;
      gsap.from(p, { y: 24, autoAlpha: 0, filter: 'blur(6px)', duration: 1, ease, delay: 0.25, scrollTrigger: once(p, 'top 88%') });
    });

    // rows: each hairline draws from the left, its words slide in behind it
    document.querySelectorAll('main .rows').forEach((list) => {
      const items = list.querySelectorAll(':scope > li');
      items.forEach((li) => li.classList.add('mt-row'));
      gsap.timeline({ scrollTrigger: once(list, 'top 80%') })
        .from(items, { '--mt-row': 0, duration: 1.1, ease: 'expo.inOut', stagger: 0.1 })
        .from(list.querySelectorAll(':scope > li > *'), { x: -28, autoAlpha: 0, duration: 0.9, ease, stagger: 0.05 }, 0.15);
    });

    // promises and areas: the top rule draws, the title rises, the text follows
    document.querySelectorAll('.promise-list, .promise-grid, .area-grid').forEach((group) => {
      const cards = group.querySelectorAll('.promise, .area');
      const tl = gsap.timeline({ scrollTrigger: once(group, 'top 78%') });
      cards.forEach((c, i) => {
        c.classList.add('mt-ruled');
        tl.from(c, { '--mt-rule': 0, duration: 1.1, ease: 'expo.inOut' }, i * 0.16)
          .from(c.querySelector('h3'), { yPercent: 60, autoAlpha: 0, duration: 1, ease }, i * 0.16 + 0.2)
          .from(c.querySelector('p'), { y: 16, autoAlpha: 0, filter: 'blur(6px)', duration: 0.9, ease }, i * 0.16 + 0.35);
      });
    });

    // portraits: a wipe uncovers each frame from its foot while the photograph settles
    document.querySelectorAll('.partner-tile, .member').forEach((tile) => {
      const frame = tile.querySelector('.frame');
      const img = frame && frame.querySelector('img');
      if (!frame) return;
      const tl = gsap.timeline({ scrollTrigger: once(tile, 'top 80%') });
      tl.from(frame, { clipPath: 'inset(100% 0 0 0 round 20px)', duration: 1.4, ease: 'expo.inOut' })
        .from(img, { scale: 1.3, duration: 2, ease }, 0)
        .from(tile.querySelectorAll('.t-card, .t-small, h2 ~ *:not(.rows), .member__rows'), { y: 22, autoAlpha: 0, duration: 0.9, ease, stagger: 0.08 }, 0.6);
    });

    // the six phases: a line runs down beside them as you read, each phase lights up as it passes
    const phases = document.querySelector('.phase-rows');
    if (phases) {
      const track = document.createElement('span');
      track.className = 'phase-track';
      track.setAttribute('aria-hidden', 'true');
      phases.prepend(track);
      gsap.fromTo(track, { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: phases, start: 'top 60%', end: 'bottom 60%', scrub: 0.4 } });
      phases.querySelectorAll(':scope > li').forEach((li) => {
        ScrollTrigger.create({ trigger: li, start: 'top 62%', end: 'bottom 62%', toggleClass: { targets: li, className: 'is-lit' } });
      });
    }

    // the close: the button grows out of a line, the name assembles letter by letter in the footer
    document.querySelectorAll('.closing__cta .btn--xl').forEach((btn) => {
      gsap.from(btn, { clipPath: 'inset(0 100% 0 0 round 12px)', duration: 1.3, ease: 'expo.inOut', scrollTrigger: once(btn, 'top 92%') });
    });
    const giant = document.querySelector('.footer__giant');
    if (giant) {
      const split = SplitText.create(giant, { type: 'chars', mask: 'chars' });
      gsap.from(split.chars, { yPercent: 105, duration: 1.4, ease, stagger: 0.04, scrollTrigger: once(giant, 'top 95%') });
    }
  }

  // primary buttons lean towards the pointer (fine pointers only), then spring back
  function magnetic() {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    document.querySelectorAll('.btn--primary, .film-toggle__disc').forEach((btn) => {
      const x = gsap.quickTo(btn, 'x', { duration: 0.5, ease: 'power3.out' });
      const y = gsap.quickTo(btn, 'y', { duration: 0.5, ease: 'power3.out' });
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        x(((e.clientX - r.left) / r.width - 0.5) * 10);
        y(((e.clientY - r.top) / r.height - 0.5) * 8);
      });
      btn.addEventListener('pointerleave', () => { x(0); y(0); });
    });
  }

  const start = () => {
    root.classList.add('mt-ready');
    openCurtain();
    heroes();
    root.classList.remove('mt-pre'); // the from-states are set: show the page
    sections();
    magnetic();
    // the kit's moments and fonts change heights after load: measure again once they settle
    setTimeout(() => ScrollTrigger.refresh(), 1200);
  };
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(start);
})();

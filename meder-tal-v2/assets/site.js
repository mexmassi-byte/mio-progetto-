// The home film: plays muted while it is on screen, with a pause control (a loop past 5 s needs one).
// Under reduced motion it stays on its poster until the visitor presses play.
const video = document.querySelector('[data-film-video]');
const toggle = document.querySelector('[data-film-toggle]');

if (video && toggle) {
  const label = toggle.querySelector('[data-film-label]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let wanted = !reduced; // what the visitor wants: playing or paused
  let visible = true;

  const show = () => {
    const paused = !wanted;
    toggle.setAttribute('aria-pressed', String(paused));
    if (label) label.textContent = paused ? 'Film abspielen' : 'Film anhalten';
  };
  const apply = () => {
    if (wanted && visible) {
      video.play().catch((err) => {
        // a pause right after play() rejects with AbortError: not a refusal, keep the visitor's choice
        if (err && err.name === 'NotAllowedError') { wanted = false; show(); }
      });
    }
    else video.pause();
  };

  toggle.addEventListener('click', () => { wanted = !wanted; show(); apply(); });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; apply(); }, { threshold: 0.15 }).observe(video);
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; apply(); });
  show();
  apply();
}

// The second film (the promises) plays only while it is on screen; reduced motion keeps its poster.
const bg = document.querySelector('[data-bg-video]');
if (bg && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  new IntersectionObserver(([e]) => { if (e.isIntersecting) bg.play().catch(() => {}); else bg.pause(); }, { rootMargin: '200px 0px' }).observe(bg);
}

// On the home page the bar lies transparent over the film, and turns back to paper below it.
const heroCine = document.querySelector('[data-hero-cine]');
const navBar = document.querySelector('header.nav');
if (heroCine && navBar) {
  const links = navBar.querySelector('.nav__links');
  links && links.classList.add('liquid-glass');
  new IntersectionObserver(([e]) => {
    const over = e.isIntersecting;
    navBar.classList.toggle('nav--over', over);
    links && links.classList.toggle('liquid-glass', over);
  }, { rootMargin: '-72px 0px -100% 0px' }).observe(heroCine);
}

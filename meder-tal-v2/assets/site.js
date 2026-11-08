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

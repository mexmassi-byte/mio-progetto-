import { gsap, SplitText } from "./gsap";

/** Masked line-by-line rise, used for page titles and big statements. */
export function riseLines(el: Element | null, vars: gsap.TweenVars = {}) {
  if (!el) return;
  const split = SplitText.create(el, { type: "lines", mask: "lines" });
  return gsap.from(split.lines, {
    yPercent: 115,
    duration: 1.3,
    ease: "expo.out",
    stagger: 0.09,
    ...vars,
    onComplete: () => split.revert(),
  });
}

/** Words light up one by one as the reader scrolls through a statement. */
export function scrubWords(el: Element | null, start = "top 80%", end = "bottom 45%") {
  if (!el) return;
  const split = SplitText.create(el, { type: "words" });
  return gsap.fromTo(
    split.words,
    { opacity: 0.16 },
    { opacity: 1, ease: "none", stagger: 0.1, scrollTrigger: { trigger: el, start, end, scrub: true } },
  );
}

/** A frame that opens from a thin horizontal slit, like a shutter. */
export function openFrame(el: Element | null, trigger?: Element | null) {
  if (!el) return;
  return gsap.fromTo(
    el,
    { clipPath: "inset(48% 0% 48% 0%)" },
    {
      clipPath: "inset(0% 0% 0% 0%)",
      duration: 1.4,
      ease: "expo.inOut",
      scrollTrigger: { trigger: trigger ?? el, start: "top 82%", once: true },
    },
  );
}

/** Image drifts inside its frame while the frame passes through the viewport. */
export function drift(img: Element | null, amount = 12) {
  if (!img) return;
  return gsap.fromTo(
    img,
    { yPercent: -amount },
    { yPercent: amount, ease: "none", scrollTrigger: { trigger: img.parentElement, start: "top bottom", end: "bottom top", scrub: true } },
  );
}

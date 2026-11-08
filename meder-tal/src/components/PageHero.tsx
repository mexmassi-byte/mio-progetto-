import { useRef, type ReactNode } from "react";
import { gsap, prefersReducedMotion, useGSAP } from "../lib/gsap";
import { whenRevealed } from "../lib/reveal";
import { riseLines } from "../lib/anim";

type Props = { title: string; lead?: string; image?: string; children?: ReactNode; aside?: ReactNode; tone?: "sea" | "night" };

/** Opening shot of an inner page: a big title rising out of the dark. */
export function PageHero({ title, lead, image, children, aside, tone = "sea" }: Props) {
  const root = useRef<HTMLElement>(null);
  const { contextSafe } = useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const q = gsap.utils.selector(root);
      const support = q(".page-hero__lead, .page-hero__extra");
      if (support.length) gsap.set(support, { autoAlpha: 0 });
      whenRevealed(
        contextSafe!(() => {
          riseLines(q(".page-hero__title")[0], { delay: 0.35 });
          if (support.length) gsap.fromTo(support, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 1.2, ease: "power3.out", delay: 0.8, stagger: 0.12 });
          if (image) {
            gsap.fromTo(q(".page-hero__bg img"), { scale: 1.18 }, { scale: 1, duration: 2.6, ease: "power2.out" });
            gsap.to(q(".page-hero__bg"), { yPercent: 18, ease: "none", scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true } });
          }
          gsap.to(q(".page-hero__inner"), { yPercent: -12, opacity: 0.2, ease: "none", scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true } });
        }),
      );
    },
    { scope: root, dependencies: [title] },
  );

  return (
    <section className={`page-hero page-hero--${tone}`} ref={root}>
      {image && (
        <div className="page-hero__bg" aria-hidden="true">
          <img src={image} alt="" />
        </div>
      )}
      {aside}
      <div className="page-hero__inner wrap">
        <h1 className="page-hero__title">{title}</h1>
        {lead && <p className="page-hero__lead">{lead}</p>}
        {children && <div className="page-hero__extra">{children}</div>}
      </div>
    </section>
  );
}

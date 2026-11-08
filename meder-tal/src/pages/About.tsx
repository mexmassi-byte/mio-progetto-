import { useRef } from "react";
import { PageHero } from "../components/PageHero";
import { TLink } from "../components/TLink";
import { useLang } from "../lib/i18n";
import { gsap, prefersReducedMotion, useGSAP } from "../lib/gsap";
import { whenRevealed } from "../lib/reveal";
import { riseLines, scrubWords } from "../lib/anim";
import { useTitle } from "../lib/useTitle";

export default function About() {
  const { lang, t } = useLang();
  const root = useRef<HTMLDivElement>(null);
  useTitle(t.about.title);

  const { contextSafe } = useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const q = gsap.utils.selector(root);
      whenRevealed(
        contextSafe!(() => {
          // The stone: solid ground, turning slowly as the story unfolds.
          gsap.fromTo(q(".stone")[0], { autoAlpha: 0, y: 80, rotate: -8 }, { autoAlpha: 1, y: 0, rotate: 0, duration: 2, ease: "expo.out", delay: 0.6 });
          gsap.to(q(".stone img"), {
            rotate: 18,
            yPercent: 30,
            ease: "none",
            scrollTrigger: { trigger: root.current, start: "top top", end: "+=140%", scrub: true },
          });

          q(".story__bio").forEach((el) =>
            gsap.from(el, { y: 50, opacity: 0, duration: 1.2, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 85%", once: true } }),
          );
          scrubWords(q(".story__turn")[0], "top 85%", "bottom 55%");

          // Timeline: a horizontal tracking shot on wide screens.
          const mm = gsap.matchMedia();
          mm.add("(min-width: 900px)", () => {
            const track = q(".timeline__track")[0] as HTMLElement;
            const distance = () => track.scrollWidth - window.innerWidth;
            const tween = gsap.to(track, {
              x: () => -distance(),
              ease: "none",
              scrollTrigger: {
                trigger: q(".timeline")[0],
                start: "top top",
                end: () => "+=" + distance(),
                scrub: 0.6,
                pin: true,
                invalidateOnRefresh: true,
              },
            });
            gsap.to(q(".timeline__progress span"), {
              scaleX: 1,
              ease: "none",
              scrollTrigger: { trigger: q(".timeline")[0], start: "top top", end: () => "+=" + distance(), scrub: true },
            });
            // Steps come forward as the camera tracks past them.
            q(".step").forEach((step) => {
              gsap.fromTo(
                step,
                { opacity: 0.35 },
                { opacity: 1, ease: "none", scrollTrigger: { trigger: step, containerAnimation: tween, start: "left 95%", end: "left 60%", scrub: true } },
              );
            });
            gsap.from(q(".step"), {
              y: 60,
              opacity: 0,
              stagger: 0.1,
              duration: 1.2,
              ease: "power3.out",
              scrollTrigger: { trigger: q(".timeline")[0], start: "top 65%", once: true },
            });
          });
          mm.add("(max-width: 899px)", () => {
            q(".step").forEach((step) =>
              gsap.from(step, { y: 40, opacity: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: step, start: "top 88%", once: true } }),
            );
          });

          riseLines(q(".manifesto__text")[0], { scrollTrigger: { trigger: q(".manifesto")[0], start: "top 75%", once: true } });
        }),
      );
    },
    { scope: root, dependencies: [lang], revertOnUpdate: true },
  );

  return (
    <div ref={root} key={lang}>
      <PageHero
        title={t.about.title}
        lead={t.about.lead}
        tone="night"
        aside={
          <div className="stone" aria-hidden="true">
            <img src="/img/stone.webp" alt="" />
          </div>
        }
      />

      <section className="story wrap">
        <p className="story__bio body body--lg">{t.about.bio1}</p>
        <p className="story__turn">{t.about.lead}</p>
        <p className="story__bio body body--lg">{t.about.bio2}</p>
      </section>

      <section className="timeline" aria-labelledby="timeline-title">
        <div className="timeline__head wrap">
          <h2 className="h2" id="timeline-title">
            {t.about.timelineTitle}
          </h2>
          <div className="timeline__progress" aria-hidden="true">
            <span />
          </div>
        </div>
        <ol className="timeline__track">
          {t.about.timeline.map((s, i) => (
            <li className="step" key={s.when}>
              <span className="step__index" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="step__when">{s.when}</p>
              <h3 className="step__title">{s.title}</h3>
              <p className="step__text">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="manifesto wrap">
        <p className="manifesto__text">{t.about.manifesto}</p>
        <TLink to="/team" className="button button--ghost">
          {t.about.teamLink}
        </TLink>
      </section>
    </div>
  );
}

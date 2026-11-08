import { useRef, useState } from "react";
import { PageHero } from "../components/PageHero";
import { TLink } from "../components/TLink";
import { useLang } from "../lib/i18n";
import { gsap, ScrollTrigger, prefersReducedMotion, useGSAP } from "../lib/gsap";
import { whenRevealed } from "../lib/reveal";
import { riseLines } from "../lib/anim";
import { useTitle } from "../lib/useTitle";

export default function Expertise() {
  const { lang, t } = useLang();
  const root = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const stages = t.expertise.journey;
  useTitle(t.expertise.title);

  const { contextSafe } = useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      // Which stage is in focus drives the sticky counter (also without motion).
      q(".stage").forEach((el, i) =>
        ScrollTrigger.create({ trigger: el, start: "top 55%", end: "bottom 55%", onToggle: (self) => self.isActive && setActive(i) }),
      );
      if (prefersReducedMotion()) return;
      whenRevealed(
        contextSafe!(() => {
          q(".field").forEach((el) => {
            const line = el.querySelector(".field__rule");
            gsap.fromTo(line, { scaleX: 0 }, { scaleX: 1, duration: 1.4, ease: "expo.inOut", scrollTrigger: { trigger: el, start: "top 85%", once: true } });
            riseLines(el.querySelector(".field__title"), { scrollTrigger: { trigger: el, start: "top 85%", once: true } });
            gsap.from(el.querySelector(".field__text"), { opacity: 0, y: 20, duration: 1, delay: 0.3, scrollTrigger: { trigger: el, start: "top 85%", once: true } });
          });
          gsap.fromTo(
            q(".journey__line span"),
            { scaleY: 0 },
            { scaleY: 1, ease: "none", scrollTrigger: { trigger: q(".journey__stages")[0], start: "top 55%", end: "bottom 55%", scrub: true } },
          );
          q(".stage").forEach((el) =>
            gsap.fromTo(
              el,
              { opacity: 0.25 },
              { opacity: 1, ease: "none", scrollTrigger: { trigger: el, start: "top 75%", end: "top 50%", scrub: true } },
            ),
          );
          q(".cost__item").forEach((el, i) =>
            gsap.from(el, { y: 50, opacity: 0, duration: 1.1, delay: i * 0.12, ease: "power3.out", scrollTrigger: { trigger: q(".cost")[0], start: "top 75%", once: true } }),
          );
        }),
      );
    },
    { scope: root, dependencies: [lang], revertOnUpdate: true },
  );

  return (
    <div ref={root} key={lang}>
      <PageHero title={t.expertise.title} lead={t.expertise.lead} image="/img/waves.jpg" />

      <section className="fields wrap" aria-labelledby="fields-title">
        <h2 className="h2" id="fields-title">
          {t.expertise.areasTitle}
        </h2>
        {t.areas.map((a, i) => (
          <article className="field" key={a.title}>
            <span className="field__rule" aria-hidden="true" />
            <h3 className="field__title">{a.title}</h3>
            <p className="field__text body">{t.expertise.areaTexts[i]}</p>
          </article>
        ))}
      </section>

      <section className="journey wrap" aria-labelledby="journey-title">
        <div className="journey__aside">
          <div className="journey__sticky">
            <h2 className="h2" id="journey-title">
              {t.expertise.journeyTitle}
            </h2>
            <p className="body">{t.expertise.journeyText}</p>
            <p className="journey__counter" aria-hidden="true">
              <span className="journey__current" key={active}>
                {String(active + 1).padStart(2, "0")}
              </span>
              <span className="journey__total">/{String(stages.length).padStart(2, "0")}</span>
            </p>
            <p className="journey__now" aria-hidden="true">
              {stages[active].title}
            </p>
          </div>
        </div>
        <ol className="journey__stages">
          <span className="journey__line" aria-hidden="true">
            <span />
          </span>
          {stages.map((s, i) => (
            <li className={`stage ${i === active ? "is-active" : ""}`} key={s.title}>
              <span className="stage__dot" aria-hidden="true" />
              <h3 className="stage__title">{s.title}</h3>
              <p className="stage__text">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="cost" aria-labelledby="cost-title">
        <div className="wrap">
          <h2 className="h2" id="cost-title">
            {t.expertise.costTitle}
          </h2>
          <div className="cost__grid">
            <div className="cost__item">
              <h3 className="cost__name">{t.expertise.costFixed}</h3>
              <p className="body">{t.expertise.costFixedText}</p>
            </div>
            <div className="cost__item">
              <h3 className="cost__name">{t.expertise.costHourly}</h3>
              <p className="body">{t.expertise.costHourlyText}</p>
            </div>
          </div>
          <p className="cost__note">{t.expertise.partnersNote}</p>
          <TLink to="/contact" className="button">
            {t.home.ctaButton}
          </TLink>
        </div>
      </section>
    </div>
  );
}

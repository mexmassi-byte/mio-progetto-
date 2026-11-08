import { useRef } from "react";
import { SeaCanvas } from "../components/SeaCanvas";
import { TLink } from "../components/TLink";
import { people } from "../content/site";
import { useLang } from "../lib/i18n";
import { gsap, prefersReducedMotion, useGSAP } from "../lib/gsap";
import { whenRevealed } from "../lib/reveal";
import { drift, openFrame, riseLines, scrubWords } from "../lib/anim";
import { useTitle } from "../lib/useTitle";

export default function Home() {
  const { lang, t } = useLang();
  const root = useRef<HTMLDivElement>(null);
  useTitle("");

  const { contextSafe } = useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const q = gsap.utils.selector(root);
      gsap.set(q(".hero__subtitle, .hero__cue"), { autoAlpha: 0 });

      whenRevealed(
        contextSafe!(() => {
          // Opening shot: title rises, the subtitle appears in the letterbox like a caption.
          riseLines(q(".hero__title")[0], { delay: 0.5, duration: 1.6, stagger: 0.12 });
          gsap.to(q(".hero__subtitle"), { autoAlpha: 1, duration: 1.2, delay: 1.4 });
          gsap.to(q(".hero__cue"), { autoAlpha: 1, duration: 1, delay: 2 });

          // Pull back: as you scroll, the shot narrows to a widescreen frame.
          gsap
            .timeline({
              scrollTrigger: { trigger: q(".hero")[0], start: "top top", end: "+=90%", scrub: true, pin: true },
            })
            .to(q(".hero__bar"), { height: "17vh", ease: "none" }, 0)
            .to(q(".hero__frame"), { scale: 0.86, ease: "none" }, 0)
            .to(q(".hero__title"), { yPercent: -40, opacity: 0, ease: "none" }, 0)
            .to(q(".hero__cue"), { opacity: 0, duration: 0.2 }, 0);

          scrubWords(q(".intro__text")[0]);

          q(".area").forEach((el, i) => {
            gsap.from(el, {
              xPercent: 14 + i * 4,
              opacity: 0,
              ease: "none",
              scrollTrigger: { trigger: el, start: "top 95%", end: "top 60%", scrub: true },
            });
          });

          q(".partner__frame").forEach((frame) => {
            openFrame(frame);
            drift(frame.querySelector("img"), 8);
          });

          drift(q(".promises__bg img")[0], 14);
          q(".promise").forEach((el, i) => {
            gsap.from(el, {
              y: 60,
              opacity: 0,
              duration: 1.2,
              ease: "power3.out",
              delay: i * 0.12,
              scrollTrigger: { trigger: q(".promises__list")[0], start: "top 80%", once: true },
            });
          });

          riseLines(q(".cta__title")[0], { scrollTrigger: { trigger: q(".cta")[0], start: "top 75%", once: true } });
        }),
      );
    },
    { scope: root, dependencies: [lang], revertOnUpdate: true },
  );

  return (
    <div ref={root} key={lang}>
      <section className="hero" aria-label="Meder & Tal">
        <div className="hero__frame">
          <SeaCanvas src="/img/sea.jpg" />
        </div>
        <div className="hero__bar hero__bar--top" aria-hidden="true" />
        <div className="hero__bar hero__bar--bottom">
          <p className="hero__subtitle">{t.home.subtitle}</p>
        </div>
        <div className="hero__content wrap">
          <h1 className="hero__title">{t.home.title}</h1>
        </div>
        <span className="hero__cue" aria-hidden="true">
          {t.ui.scroll}
        </span>
      </section>

      <section className="intro wrap">
        <p className="intro__text">{t.home.intro}</p>
      </section>

      <section className="strengths wrap">
        <div className="strengths__copy">
          <h2 className="h2">{t.home.strengthsTitle}</h2>
          <p className="body">{t.home.strengthsText}</p>
          <TLink to="/expertise" className="textlink">
            {t.home.strengthsLink}
          </TLink>
        </div>
        <ul className="areas" role="list">
          {t.areas.map((a) => (
            <li className="area" key={a.title}>
              {a.title}
            </li>
          ))}
        </ul>
      </section>

      <section className="partners wrap">
        <h2 className="h2 partners__title">{t.home.partnersTitle}</h2>
        <div className="partners__grid">
          {people.map((p) => (
            <article className="partner" key={p.id}>
              <div className="partner__frame">
                <img src={p.portrait} alt={p.name} loading="lazy" />
              </div>
              <h3 className="partner__name">{p.name}</h3>
              <p className="partner__role">{p.role[lang]}</p>
            </article>
          ))}
        </div>
        <TLink to="/team" className="textlink">
          {t.home.partnersLink}
        </TLink>
      </section>

      <section className="promises">
        <div className="promises__bg" aria-hidden="true">
          <img src="/img/waves.jpg" alt="" loading="lazy" />
        </div>
        <div className="wrap promises__inner">
          <h2 className="h2">{t.home.standTitle}</h2>
          <p className="body promises__lead">{t.home.standText}</p>
          <div className="promises__list">
            {t.promises.map((p) => (
              <article className="promise" key={p.title}>
                <h3 className="promise__title">{p.title}</h3>
                <p className="promise__text">{p.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="cta wrap">
        <h2 className="cta__title">{t.home.ctaTitle}</h2>
        <TLink to="/contact" className="button">
          {t.home.ctaButton}
        </TLink>
      </section>
    </div>
  );
}

import { useRef } from "react";
import { PageHero } from "../components/PageHero";
import { TLink } from "../components/TLink";
import { people } from "../content/site";
import { useLang } from "../lib/i18n";
import { gsap, prefersReducedMotion, useGSAP } from "../lib/gsap";
import { whenRevealed } from "../lib/reveal";
import { drift, openFrame, riseLines } from "../lib/anim";
import { useTitle } from "../lib/useTitle";

export default function Team() {
  const { lang, t } = useLang();
  const root = useRef<HTMLDivElement>(null);
  useTitle(t.team.title);

  const { contextSafe } = useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const q = gsap.utils.selector(root);
      whenRevealed(
        contextSafe!(() => {
          q(".member").forEach((el) => {
            const frame = el.querySelector(".member__frame");
            openFrame(frame);
            drift(frame?.querySelector("img") ?? null, 7);
            riseLines(el.querySelector(".member__name"), { scrollTrigger: { trigger: el, start: "top 70%", once: true } });
            gsap.from(el.querySelectorAll(".member__role, .member__contact li"), {
              y: 24,
              opacity: 0,
              stagger: 0.07,
              duration: 1,
              ease: "power3.out",
              delay: 0.3,
              scrollTrigger: { trigger: el, start: "top 70%", once: true },
            });
          });
          gsap.from(q(".team-note > *"), { y: 30, opacity: 0, stagger: 0.12, duration: 1.1, ease: "power3.out", scrollTrigger: { trigger: q(".team-note")[0], start: "top 80%", once: true } });
        }),
      );
    },
    { scope: root, dependencies: [lang], revertOnUpdate: true },
  );

  return (
    <div ref={root} key={lang}>
      <PageHero title={t.team.title} lead={t.team.lead} />

      <section className="members wrap">
        {people.map((p) => (
          <article className="member" key={p.id}>
            <div className="member__frame">
              <img src={p.wide} alt={p.name} loading="lazy" />
            </div>
            <div className="member__info">
              <h2 className="member__name">{p.name}</h2>
              <p className="member__role">{p.role[lang]}</p>
              <ul className="member__contact" role="list">
                <li>
                  <a href={p.phoneHref}>{p.phone}</a>
                </li>
                <li>
                  <a href={`mailto:${p.email}`}>{p.email}</a>
                </li>
                <li>
                  <a href={p.linkedin} target="_blank" rel="noopener noreferrer">
                    {t.ui.linkedin}
                  </a>
                </li>
              </ul>
            </div>
          </article>
        ))}
      </section>

      <section className="team-note wrap">
        <p className="team-note__text">{t.team.shared}</p>
        <TLink to="/about" className="textlink">
          {t.team.aboutLink}
        </TLink>
      </section>
    </div>
  );
}

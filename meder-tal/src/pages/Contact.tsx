import { useRef, useState, type FormEvent } from "react";
import { PageHero } from "../components/PageHero";
import { contact, people } from "../content/site";
import { useLang } from "../lib/i18n";
import { gsap, prefersReducedMotion, useGSAP } from "../lib/gsap";
import { whenRevealed } from "../lib/reveal";
import { useTitle } from "../lib/useTitle";

export default function Contact() {
  const { lang, t } = useLang();
  const c = t.contactPage;
  const root = useRef<HTMLDivElement>(null);
  const [topicIndex, setTopicIndex] = useState(0);
  const topic = c.topics[topicIndex];
  useTitle(c.title);

  const { contextSafe } = useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const q = gsap.utils.selector(root);
      whenRevealed(
        contextSafe!(() => {
          gsap.from(q(".reach__item"), { y: 40, opacity: 0, stagger: 0.08, duration: 1.1, ease: "power3.out", delay: 0.9 });
          gsap.from(q(".form"), { y: 60, opacity: 0, duration: 1.3, ease: "power3.out", scrollTrigger: { trigger: q(".form")[0], start: "top 90%", once: true } });
        }),
      );
    },
    { scope: root, dependencies: [lang], revertOnUpdate: true },
  );

  // No server: the form composes an email in the visitor's own mail program.
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") ?? "");
    const company = String(data.get("company") ?? "");
    const message = String(data.get("message") ?? "");
    const subject = `${topic}${company ? ` – ${company}` : ""}`;
    const body = `${message}\n\n${name}${company ? `\n${company}` : ""}`;
    window.location.href = `mailto:${contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div ref={root} key={lang}>
      <PageHero title={c.title} lead={c.lead} />

      <section className="contact wrap">
        <div className="reach" aria-labelledby="reach-title">
          <h2 className="h3" id="reach-title">
            {c.direct}
          </h2>
          <a className="reach__item reach__big" href={`mailto:${contact.email}`}>
            {contact.email}
          </a>
          <a className="reach__item reach__big" href={contact.phoneHref}>
            {contact.phone}
          </a>
          <address className="reach__item reach__address">
            {contact.legalName}
            <br />
            {contact.street}, {contact.zip} {contact.city[lang]}, {contact.country[lang]}
          </address>
          <ul className="reach__people" role="list">
            {people.map((p) => (
              <li className="reach__item" key={p.id}>
                <span className="reach__name">{p.name}</span>
                <a href={`mailto:${p.email}`}>{p.email}</a>
                <a href={p.phoneHref}>{p.phone}</a>
              </li>
            ))}
          </ul>
        </div>

        <form className="form" onSubmit={submit} aria-labelledby="form-title">
          <h2 className="h3" id="form-title">
            {c.formTitle}
          </h2>
          <fieldset className="form__topics">
            <legend>{c.topic}</legend>
            {c.topics.map((tp, i) => (
              <label key={tp} className={`chip ${topic === tp ? "is-on" : ""}`}>
                <input type="radio" name="topic" value={tp} checked={topic === tp} onChange={() => setTopicIndex(i)} />
                {tp}
              </label>
            ))}
          </fieldset>
          <label className="field-input">
            <span>{c.name}</span>
            <input name="name" autoComplete="name" required />
          </label>
          <label className="field-input">
            <span>{c.company}</span>
            <input name="company" autoComplete="organization" />
          </label>
          <label className="field-input">
            <span>{c.message}</span>
            <textarea name="message" rows={5} required />
          </label>
          <button className="button" type="submit">
            {c.send}
          </button>
          <p className="form__hint">{c.formHint}</p>
        </form>
      </section>
    </div>
  );
}

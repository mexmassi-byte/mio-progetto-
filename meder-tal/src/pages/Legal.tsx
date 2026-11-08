import { Fragment } from "react";
import { PageHero } from "../components/PageHero";
import { legal } from "../content/legal";
import { imprint } from "../content/imprint";
import { useLang } from "../lib/i18n";
import { useTitle } from "../lib/useTitle";

export function Imprint() {
  const { lang, t } = useLang();
  useTitle(t.legal.imprint);
  return (
    <div key={lang}>
      <PageHero title={t.legal.imprint} image="/img/waves.jpg" />
      <article className="legal wrap">
        {imprint[lang].map((section, i) => (
          <section key={i} className="legal__section">
            {section.heading && <h2 className="legal__h">{section.heading}</h2>}
            {section.intro && <p className="legal__intro">{section.intro}</p>}
            {section.entries && (
              <dl className="legal__facts">
                {section.entries.map((e) => (
                  <div key={e.label}>
                    <dt>{e.label}</dt>
                    <dd>
                      {e.value.map((v, j) => (
                        <Fragment key={v}>
                          {j > 0 && <br />}
                          {e.href ? <a href={e.href}>{v}</a> : v}
                        </Fragment>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {section.paragraphs?.map((p) => <p key={p}>{p}</p>)}
          </section>
        ))}
      </article>
    </div>
  );
}

export function Privacy() {
  const { lang, t } = useLang();
  useTitle(t.legal.privacy);
  return (
    <div key={lang}>
      <PageHero title={t.legal.privacy} image="/img/waves.jpg" />
      <article className="legal wrap">
        {legal.privacy[lang].map((b, i) => {
          if (b.t === "ul")
            return (
              <ul key={i}>
                {b.items.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            );
          if (b.t === "title") return <h2 key={i} className="legal__title">{b.x}</h2>;
          if (b.t === "h") return <h3 key={i} className="legal__h">{b.x}</h3>;
          return <p key={i}>{b.x}</p>;
        })}
      </article>
    </div>
  );
}

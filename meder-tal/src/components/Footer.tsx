import { contact, legalNav, nav } from "../content/site";
import { useLang } from "../lib/i18n";
import { TLink } from "./TLink";

export function Footer() {
  const { lang, t } = useLang();
  return (
    <footer className="footer">
      <div className="wrap footer__grid">
        <div className="footer__intro">
          <p className="footer__line">{t.footer.line1}</p>
          <p className="footer__line footer__line--muted">{t.footer.line2}</p>
        </div>
        <dl className="footer__facts">
          <div>
            <dt>{t.ui.address}</dt>
            <dd>
              {contact.street}
              <br />
              {contact.zip} {contact.city[lang]}
              <br />
              {contact.country[lang]}
            </dd>
          </div>
          <div>
            <dt>{t.ui.emailLabel}</dt>
            <dd>
              <a href={`mailto:${contact.email}`}>{contact.email}</a>
            </dd>
          </div>
          <div>
            <dt>{t.ui.phoneLabel}</dt>
            <dd>
              <a href={contact.phoneHref}>{contact.phone}</a>
            </dd>
          </div>
        </dl>
        <nav className="footer__nav" aria-label="Footer">
          {nav.map((n) => (
            <TLink key={n.to} to={n.to}>
              {n.label[lang]}
            </TLink>
          ))}
        </nav>
      </div>
      <p className="footer__mark" aria-hidden="true">
        Meder <span className="amp">&amp;</span> Tal
      </p>
      <div className="wrap footer__base">
        <span>
          © {new Date().getFullYear()} Meder &amp; Tal. {t.ui.rights}
        </span>
        <span className="footer__legal">
          {legalNav.map((n) => (
            <TLink key={n.to} to={n.to}>
              {n.label[lang]}
            </TLink>
          ))}
        </span>
      </div>
    </footer>
  );
}

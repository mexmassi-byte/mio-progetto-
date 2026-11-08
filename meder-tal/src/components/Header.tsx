import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { nav, contact } from "../content/site";
import { useLang } from "../lib/i18n";
import { gsap, prefersReducedMotion } from "../lib/gsap";
import { lockScroll } from "../lib/scroll";
import { TLink } from "./TLink";

export function Header() {
  const { lang, setLang, t } = useLang();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"top" | "up" | "down">("top");
  const menu = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  // Hide while reading down, return when scrolling up.
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y < 40) setState("top");
      else if (Math.abs(y - last) > 6) setState(y > last ? "down" : "up");
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Full-screen menu: the panel drops like a curtain, then links rise.
  useEffect(() => {
    const el = menu.current;
    if (!el) return;
    lockScroll(open);
    const links = el.querySelectorAll(".menu__link, .menu__meta");
    if (prefersReducedMotion()) {
      gsap.set(el, { autoAlpha: open ? 1 : 0, clipPath: "inset(0 0 0% 0)" });
      return;
    }
    if (open) {
      gsap
        .timeline()
        .set(el, { autoAlpha: 1 })
        .fromTo(el, { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.75, ease: "expo.inOut" })
        .fromTo(links, { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.8, stagger: 0.06, ease: "expo.out" }, "-=0.35");
    } else if (gsap.getProperty(el, "opacity") !== 0) {
      gsap
        .timeline()
        .to(el, { clipPath: "inset(0 0 100% 0)", duration: 0.6, ease: "expo.inOut" })
        .set(el, { autoAlpha: 0 });
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const other = lang === "de" ? "en" : "de";

  return (
    <>
      <a className="skip" href="#main">
        {t.ui.skip}
      </a>
      <header className={`header header--${state} ${open ? "header--open" : ""}`}>
        <TLink to="/" className="header__brand" aria-label="Meder & Tal, Home" onNavigate={() => setOpen(false)}>
          Meder <span className="amp">&amp;</span> Tal
        </TLink>
        <nav className="header__nav" aria-label="Main">
          {nav.map((item) => (
            <TLink key={item.to} to={item.to} className="header__link" aria-current={pathname === item.to ? "page" : undefined}>
              {item.label[lang]}
            </TLink>
          ))}
        </nav>
        <div className="header__tools">
          <button className="header__lang" onClick={() => setLang(other)} lang={other} aria-label={t.ui.langSwitch}>
            {other.toUpperCase()}
          </button>
          <button
            ref={toggle}
            className="header__toggle"
            aria-expanded={open}
            aria-controls="menu"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="header__toggle-lines" aria-hidden="true" />
            {open ? t.ui.close : t.ui.menu}
          </button>
        </div>
      </header>
      <div id="menu" className="menu" ref={menu} aria-hidden={!open} {...(open ? {} : { inert: "" })}>
        <nav className="menu__nav" aria-label="Menu">
          {nav.map((item) => (
            <div className="menu__row" key={item.to}>
              <TLink
                to={item.to}
                className="menu__link"
                aria-current={pathname === item.to ? "page" : undefined}
                onNavigate={() => setOpen(false)}
              >
                {item.label[lang]}
              </TLink>
            </div>
          ))}
        </nav>
        <div className="menu__foot">
          <div className="menu__row">
            <a className="menu__meta" href={`mailto:${contact.email}`}>
              {contact.email}
            </a>
          </div>
          <div className="menu__row">
            <a className="menu__meta" href={contact.phoneHref}>
              {contact.phone}
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

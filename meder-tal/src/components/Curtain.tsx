import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { gsap, ScrollTrigger, prefersReducedMotion } from "../lib/gsap";
import { setCurtainClosed } from "../lib/reveal";
import { scrollToTop, lockScroll } from "../lib/scroll";
import { useLang } from "../lib/i18n";
import { legalNav, nav } from "../content/site";

type Go = (to: string) => void;
const TransitionContext = createContext<Go>(() => {});
export const useGo = () => useContext(TransitionContext);

/**
 * The cinematic frame of the site. Two black bars close like a letterbox,
 * a title card names the next scene, then the bars open on the new page.
 * The first visit opens the same way, from black.
 */
export function CurtainProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { lang } = useLang();
  const root = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLParagraphElement>(null);
  const busy = useRef(false);
  const path = useRef(location.pathname);
  path.current = location.pathname;

  const labelFor = useCallback(
    (to: string) => {
      const item = [...nav, ...legalNav].find((n) => n.to === to);
      return item ? item.label[lang] : "Meder & Tal";
    },
    [lang],
  );

  const open = useCallback((delay = 0) => {
    const tl = gsap.timeline({ delay });
    tl.add(() => setCurtainClosed(false), 0.15)
      .to(card.current, { autoAlpha: 0, y: -8, duration: 0.35, ease: "power2.in" }, 0)
      .to(top.current, { scaleY: 0, duration: 1.05, ease: "expo.inOut" }, 0.1)
      .to(bottom.current, { scaleY: 0, duration: 1.05, ease: "expo.inOut" }, 0.1)
      .set(root.current, { visibility: "hidden" })
      .add(() => {
        busy.current = false;
        lockScroll(false);
      });
    return tl;
  }, []);

  // First visit: start from black with the firm's name, then open.
  useEffect(() => {
    if (prefersReducedMotion()) {
      gsap.set(root.current, { visibility: "hidden" });
      return;
    }
    setCurtainClosed(true);
    busy.current = true;
    lockScroll(true);
    gsap.set([top.current, bottom.current], { scaleY: 1 });
    const tl = gsap.timeline();
    tl.fromTo(card.current, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.9, ease: "power3.out", delay: 0.2 });
    tl.add(() => {
      // Wait for the faces the opening shot uses, so lines split correctly.
      const faces = ['400 1em "Bodoni Moda"', 'italic 400 1em "Bodoni Moda"', '400 1em "Schibsted Grotesk"', '500 1em "Schibsted Grotesk"'];
      const fonts = document.fonts ? Promise.all(faces.map((f) => document.fonts.load(f))) : Promise.resolve();
      const timeout = new Promise((r) => setTimeout(r, 2500));
      Promise.race([fonts, timeout]).then(() => open(0.35));
    });
    return () => {
      tl.kill();
    };
  }, [open]);

  const go = useCallback<Go>(
    (to) => {
      if (busy.current) return;
      if (to === path.current) {
        scrollToTop(false);
        return;
      }
      if (prefersReducedMotion()) {
        navigate(to);
        scrollToTop();
        return;
      }
      busy.current = true;
      lockScroll(true);
      if (card.current) card.current.textContent = labelFor(to);
      gsap
        .timeline()
        .set(root.current, { visibility: "visible" })
        .add(() => setCurtainClosed(true))
        .fromTo(top.current, { scaleY: 0 }, { scaleY: 1, duration: 0.7, ease: "power3.inOut" }, 0)
        .fromTo(bottom.current, { scaleY: 0 }, { scaleY: 1, duration: 0.7, ease: "power3.inOut" }, 0)
        .fromTo(card.current, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.45, ease: "power2.out" }, 0.55)
        .add(() => {
          navigate(to);
          scrollToTop();
        })
        .add(() => {
          ScrollTrigger.refresh();
          open(0.25);
        }, "+=0.3");
    },
    [labelFor, navigate, open],
  );

  // Browser back/forward: no curtain, but always start the new page at the top.
  useEffect(() => {
    if (!busy.current) {
      scrollToTop();
      ScrollTrigger.refresh();
    }
  }, [location.pathname]);

  return (
    <TransitionContext.Provider value={go}>
      {children}
      <div className="curtain" ref={root} aria-hidden="true">
        <div className="curtain__bar curtain__bar--top" ref={top} />
        <div className="curtain__bar curtain__bar--bottom" ref={bottom} />
        <p className="curtain__card" ref={card}>
          Meder &amp; Tal
        </p>
      </div>
    </TransitionContext.Provider>
  );
}

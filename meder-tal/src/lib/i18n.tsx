import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { copy, type Lang } from "../content/site";

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (typeof copy)["de"] };
const LangContext = createContext<Ctx | null>(null);

function initialLang(): Lang {
  try {
    const stored = localStorage.getItem("mt-lang");
    if (stored === "de" || stored === "en") return stored;
  } catch {
    /* storage unavailable */
  }
  return "de";
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("mt-lang", l);
    } catch {
      /* storage unavailable */
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang, t: copy[lang] }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang outside LangProvider");
  return ctx;
}

import { useEffect } from "react";

export function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} – Meder & Tal` : "Meder & Tal – Rechtsberatung für Unternehmer von Unternehmern";
  }, [title]);
}

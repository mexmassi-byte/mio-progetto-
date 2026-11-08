export type PageId =
  | "overview" | "research" | "voice" | "missions" | "sales" | "dev" | "memory" | "settings";

const ITEMS: { id: PageId; label: string; glyph: JSX.Element; group: number }[] = [
  { id: "overview", label: "Overview", group: 0, glyph: (
    <svg viewBox="0 0 18 18" className="glyph" fill="none" stroke="currentColor" strokeWidth="1">
      <path d="M1 15 L5 9 L8 12 L12 4 L17 15" /><path d="M1 17 H17" strokeOpacity=".5" /></svg>) },
  { id: "research", label: "Ricerca", group: 0, glyph: (
    <svg viewBox="0 0 18 18" className="glyph" fill="none" stroke="currentColor" strokeWidth="1">
      <circle cx="9" cy="9" r="7.5" /><ellipse cx="9" cy="9" rx="3.2" ry="7.5" /><path d="M1.5 9 H16.5" /></svg>) },
  { id: "voice", label: "Voce", group: 0, glyph: (
    <svg viewBox="0 0 18 18" className="glyph" fill="none" stroke="currentColor" strokeWidth="1">
      <circle cx="9" cy="9" r="7.5" strokeDasharray="1 1.6" /><circle cx="9" cy="9" r="4" /></svg>) },
  { id: "missions", label: "Missioni", group: 1, glyph: (
    <svg viewBox="0 0 18 18" className="glyph" fill="none" stroke="currentColor" strokeWidth="1">
      <path d="M3 4 H15 M3 9 H15 M3 14 H10" /><circle cx="14" cy="14" r="2" /></svg>) },
  { id: "sales", label: "Vendite", group: 1, glyph: (
    <svg viewBox="0 0 18 18" className="glyph" fill="none" stroke="currentColor" strokeWidth="1">
      <path d="M2 3 H16 L11 9 V15 L7 13 V9 Z" /></svg>) },
  { id: "dev", label: "Sviluppo", group: 1, glyph: (
    <svg viewBox="0 0 18 18" className="glyph" fill="none" stroke="currentColor" strokeWidth="1">
      <path d="M6 5 L2 9 L6 13 M12 5 L16 9 L12 13 M10 3 L8 15" /></svg>) },
  { id: "memory", label: "Memoria", group: 1, glyph: (
    <svg viewBox="0 0 18 18" className="glyph" fill="none" stroke="currentColor" strokeWidth="1">
      <rect x="3" y="2" width="12" height="14" /><path d="M6 6 H12 M6 9 H12 M6 12 H10" /></svg>) },
  { id: "settings", label: "Sistema", group: 2, glyph: (
    <svg viewBox="0 0 18 18" className="glyph" fill="none" stroke="currentColor" strokeWidth="1">
      <circle cx="9" cy="9" r="2.5" /><path d="M9 1.5 V4 M9 14 V16.5 M1.5 9 H4 M14 9 H16.5 M3.7 3.7 L5.5 5.5 M12.5 12.5 L14.3 14.3 M3.7 14.3 L5.5 12.5 M12.5 5.5 L14.3 3.7" /></svg>) },
];

export function Nav({ page, onChange, badges }: { page: PageId; onChange: (p: PageId) => void; badges: Partial<Record<PageId, number>> }) {
  return (
    <nav className="nav" aria-label="Sezioni">
      <div className="brand">JARVIS</div>
      {ITEMS.map((it, i) => (
        <div key={it.id} style={{ display: "contents" }}>
          {i > 0 && ITEMS[i - 1].group !== it.group && (it.group === 2 ? <div className="spacer" /> : <div className="sep" />)}
          <button aria-current={page === it.id ? "page" : undefined} onClick={() => onChange(it.id)} title={it.label}>
            {it.glyph}
            <span>{it.label}{badges[it.id] ? ` ·${badges[it.id]}` : ""}</span>
          </button>
        </div>
      ))}
    </nav>
  );
}

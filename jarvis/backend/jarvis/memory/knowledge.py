"""Editable Markdown knowledge files in ``data/knowledge``.

Plain files the user can also open in any editor. Every save keeps the
previous version in ``data/knowledge/.history`` so nothing is lost.
"""

from __future__ import annotations

import re
import shutil
from datetime import datetime
from pathlib import Path

_SAFE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 _\-./]{0,120}\.md$")

DEFAULT_FILES = {
    "veyro-web.md": """# VEYRO Web — profilo aziendale

> File modificabile. JARVIS lo legge come conoscenza "fornita dall'utente".

## Chi siamo
Agenzia digitale: web design, sviluppo siti e app, integrazioni AI.

## Servizi e pacchetti
- (da completare: nome pacchetto, contenuto, prezzo indicativo)

## Clienti ideali
- Studi legali, cliniche private, dentisti, centri estetici, commercialisti,
  studi professionali — Germania e Italia, poi Europa.

## Punti di forza
- (da completare)

## Contatti ufficiali
- Sito: (da completare)
- Email: (da completare)
- WhatsApp: (da completare)
""",
    "sales-playbook.md": """# Playbook vendite

## Regole
- Nessun invio automatico di messaggi: JARVIS prepara, l'utente approva.
- Germania (UWG §7): email pubblicitaria solo con consenso preventivo, anche B2B.
- Italia (art. 130 Codice Privacy): email promozionale solo con consenso;
  chiamate soggette al Registro Pubblico delle Opposizioni.
- Annotare per ogni lead la base giuridica del contatto.

## Criteri di un buon prospect
- Sito vecchio, lento o non adatto al mobile.
- Settore ad alto valore per cliente (studi, cliniche).
- Contatti pubblici chiari (Impressum, pagina contatti).

## Tono dei messaggi
- Concreto, breve, basato su osservazioni reali del sito. Niente esagerazioni.
""",
}


class KnowledgeBase:
    def __init__(self, root: Path):
        self.root = root
        self.history = root / ".history"
        self.root.mkdir(parents=True, exist_ok=True)

    def ensure_defaults(self) -> None:
        for name, body in DEFAULT_FILES.items():
            p = self.root / name
            if not p.exists():
                p.write_text(body, encoding="utf-8")

    def _path(self, name: str) -> Path:
        if not _SAFE.match(name) or ".." in name.split("/"):
            raise ValueError("Invalid file name (use letters, digits, '-', '_' and end with .md)")
        p = (self.root / name).resolve()
        if self.root.resolve() not in p.parents:
            raise ValueError("Path outside the knowledge folder")
        return p

    def list(self) -> list[dict]:
        out = []
        for p in sorted(self.root.rglob("*.md")):
            if self.history in p.parents:
                continue
            st = p.stat()
            out.append({
                "name": str(p.relative_to(self.root)).replace("\\", "/"),
                "size": st.st_size,
                "modified": datetime.fromtimestamp(st.st_mtime).isoformat(timespec="seconds"),
            })
        return out

    def read(self, name: str) -> str:
        return self._path(name).read_text(encoding="utf-8")

    def write(self, name: str, content: str) -> None:
        p = self._path(name)
        p.parent.mkdir(parents=True, exist_ok=True)
        if p.exists():
            self.history.mkdir(exist_ok=True)
            stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            shutil.copy2(p, self.history / f"{p.stem}.{stamp}.md")
        p.write_text(content, encoding="utf-8")

    def delete(self, name: str) -> None:
        p = self._path(name)
        if p.exists():
            self.history.mkdir(exist_ok=True)
            stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            shutil.move(str(p), self.history / f"{p.stem}.{stamp}.deleted.md")

    def all_text(self, max_chars: int = 6000) -> str:
        parts, total = [], 0
        for item in self.list():
            body = self.read(item["name"])
            chunk = f"### {item['name']}\n{body.strip()}\n"
            if total + len(chunk) > max_chars:
                chunk = chunk[: max(0, max_chars - total)]
            parts.append(chunk)
            total += len(chunk)
            if total >= max_chars:
                break
        return "\n".join(parts)

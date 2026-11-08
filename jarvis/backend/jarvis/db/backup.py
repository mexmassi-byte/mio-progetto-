"""Database backups with rotation, using SQLite's online backup API."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

from .database import Database


def make_backup(db: Database, backups_dir: Path, keep: int = 14) -> Path:
    backups_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    target = backups_dir / f"jarvis-{stamp}.db"
    db.backup_to(target)
    rotate(backups_dir, keep)
    return target


def rotate(backups_dir: Path, keep: int) -> list[Path]:
    files = sorted(backups_dir.glob("jarvis-*.db"))
    removed = files[: max(0, len(files) - keep)]
    for f in removed:
        f.unlink(missing_ok=True)
    return removed


def latest_backup(backups_dir: Path) -> Path | None:
    files = sorted(backups_dir.glob("jarvis-*.db"))
    return files[-1] if files else None

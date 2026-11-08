"""Versioned schema migrations.

Append new migrations to the end of ``MIGRATIONS``; never edit one that has
already shipped. Each runs inside a transaction together with its version
bump, so a failed migration leaves the database untouched.
Statements are split on ';' — do not use semicolons inside string literals.
"""

MIGRATIONS: list[tuple[int, str]] = [
    (
        1,
        """
        CREATE TABLE conversations (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            meta TEXT,
            created_at TEXT NOT NULL
        );
        CREATE INDEX idx_messages_conv ON messages(conversation_id, id);

        CREATE TABLE memories (
            id TEXT PRIMARY KEY,
            category TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            reliability TEXT NOT NULL,
            source TEXT,
            tags TEXT,
            version INTEGER NOT NULL DEFAULT 1,
            embedding TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            deleted_at TEXT
        );
        CREATE INDEX idx_memories_cat ON memories(category);
        CREATE TABLE memory_revisions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            memory_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
            version INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            reliability TEXT NOT NULL,
            change_note TEXT,
            changed_by TEXT NOT NULL,
            changed_at TEXT NOT NULL
        );

        CREATE TABLE events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL,
            type TEXT NOT NULL,
            payload TEXT
        );
        CREATE INDEX idx_events_type ON events(type, id);

        CREATE TABLE audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL,
            actor TEXT NOT NULL,
            action TEXT NOT NULL,
            target TEXT,
            permission TEXT,
            decision TEXT NOT NULL,
            details TEXT
        );

        CREATE TABLE settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """,
    ),
    (
        2,
        """
        CREATE TABLE missions (
            id TEXT PRIMARY KEY,
            objective TEXT NOT NULL,
            kind TEXT NOT NULL,
            params TEXT,
            status TEXT NOT NULL,
            priority INTEGER NOT NULL DEFAULT 5,
            permission_level TEXT NOT NULL,
            max_steps INTEGER NOT NULL,
            max_seconds INTEGER NOT NULL,
            steps_used INTEGER NOT NULL DEFAULT 0,
            completion_condition TEXT NOT NULL,
            verification TEXT,
            result TEXT,
            error TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            started_at TEXT,
            finished_at TEXT
        );
        CREATE INDEX idx_missions_status ON missions(status, priority);

        CREATE TABLE tasks (
            id TEXT PRIMARY KEY,
            mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
            seq INTEGER NOT NULL,
            title TEXT NOT NULL,
            tool TEXT NOT NULL,
            args TEXT,
            depends_on TEXT,
            optional INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            max_attempts INTEGER NOT NULL,
            timeout_s INTEGER NOT NULL,
            result TEXT,
            error TEXT,
            checkpoint TEXT,
            next_attempt_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            started_at TEXT,
            finished_at TEXT
        );
        CREATE INDEX idx_tasks_mission ON tasks(mission_id, seq);

        CREATE TABLE approvals (
            id TEXT PRIMARY KEY,
            mission_id TEXT,
            task_id TEXT,
            tool TEXT NOT NULL,
            args TEXT,
            permission TEXT NOT NULL,
            reason TEXT,
            status TEXT NOT NULL,
            decided_note TEXT,
            created_at TEXT NOT NULL,
            decided_at TEXT
        );

        CREATE TABLE schedules (
            id TEXT PRIMARY KEY,
            objective TEXT NOT NULL,
            interval_seconds INTEGER NOT NULL,
            next_run_at TEXT NOT NULL,
            enabled INTEGER NOT NULL DEFAULT 1,
            last_mission_id TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL,
            level TEXT NOT NULL,
            title TEXT NOT NULL,
            body TEXT,
            mission_id TEXT,
            read_at TEXT
        )
        """,
    ),
    (
        3,
        """
        CREATE TABLE leads (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            website TEXT,
            sector TEXT,
            city TEXT,
            country TEXT,
            address TEXT,
            lat REAL,
            lon REAL,
            email TEXT,
            phone TEXT,
            source TEXT NOT NULL,
            source_ref TEXT,
            audit TEXT,
            audited_at TEXT,
            score REAL,
            score_breakdown TEXT,
            status TEXT NOT NULL,
            next_action TEXT,
            legal_basis TEXT,
            notes TEXT,
            mission_id TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE UNIQUE INDEX idx_leads_source ON leads(source, source_ref);
        CREATE INDEX idx_leads_status ON leads(status, score);

        CREATE TABLE lead_interactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
            ts TEXT NOT NULL,
            channel TEXT NOT NULL,
            direction TEXT NOT NULL,
            summary TEXT NOT NULL,
            draft_id TEXT
        );

        CREATE TABLE drafts (
            id TEXT PRIMARY KEY,
            lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE,
            kind TEXT NOT NULL,
            language TEXT NOT NULL,
            subject TEXT,
            body TEXT NOT NULL,
            status TEXT NOT NULL,
            generated_by TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE deals (
            id TEXT PRIMARY KEY,
            lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            amount_eur REAL,
            status TEXT NOT NULL,
            payment_reference TEXT,
            verified_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """,
    ),
    (
        4,
        """
        CREATE TABLE projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            slug TEXT NOT NULL UNIQUE,
            description TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE command_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
            command TEXT NOT NULL,
            exit_code INTEGER,
            output TEXT,
            duration_ms INTEGER,
            ts TEXT NOT NULL
        )
        """,
    ),
]

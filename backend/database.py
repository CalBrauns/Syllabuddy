import os
import sqlite3
from pathlib import Path

DB_PATH = Path(os.getenv("DB_PATH", str(Path(__file__).parent / "study.db")))


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS classes (
                id    INTEGER PRIMARY KEY AUTOINCREMENT,
                name  TEXT NOT NULL,
                color TEXT NOT NULL DEFAULT '#6366f1'
            );
            CREATE TABLE IF NOT EXISTS tasks (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                class_id        INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
                title           TEXT NOT NULL,
                type            TEXT NOT NULL,
                due_date        TEXT NOT NULL,
                description     TEXT DEFAULT '',
                estimated_hours REAL NOT NULL DEFAULT 1.0,
                hidden          INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
        """)
        cols = [r[1] for r in conn.execute("PRAGMA table_info(tasks)").fetchall()]
        if "hidden" not in cols:
            conn.execute("ALTER TABLE tasks ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0")


def get_classes():
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT c.id, c.name, c.color, COUNT(t.id) as task_count
            FROM classes c LEFT JOIN tasks t ON t.class_id = c.id
            GROUP BY c.id
        """).fetchall()
    return [dict(r) for r in rows]


def get_class_count():
    with get_conn() as conn:
        return conn.execute("SELECT COUNT(*) FROM classes").fetchone()[0]


def create_class(name: str, color: str) -> int:
    with get_conn() as conn:
        cur = conn.execute("INSERT INTO classes (name, color) VALUES (?, ?)", (name, color))
        return cur.lastrowid


def delete_class(class_id: int):
    with get_conn() as conn:
        conn.execute("DELETE FROM classes WHERE id = ?", (class_id,))


def create_task(task: dict) -> int:
    with get_conn() as conn:
        cur = conn.execute("""
            INSERT INTO tasks (class_id, title, type, due_date, description, estimated_hours)
            VALUES (:class_id, :title, :type, :due_date, :description, :estimated_hours)
        """, task)
        return cur.lastrowid


def insert_tasks(tasks: list[dict]):
    with get_conn() as conn:
        conn.executemany("""
            INSERT INTO tasks (class_id, title, type, due_date, description, estimated_hours)
            VALUES (:class_id, :title, :type, :due_date, :description, :estimated_hours)
        """, tasks)


def get_tasks(class_id: int | None = None, include_hidden: bool = False):
    with get_conn() as conn:
        hidden_filter = "" if include_hidden else "AND t.hidden = 0"
        if class_id:
            rows = conn.execute(
                f"SELECT t.*, c.color FROM tasks t JOIN classes c ON c.id = t.class_id WHERE t.class_id = ? {hidden_filter}",
                (class_id,)
            ).fetchall()
        else:
            rows = conn.execute(
                f"SELECT t.*, c.color FROM tasks t JOIN classes c ON c.id = t.class_id WHERE 1=1 {hidden_filter} ORDER BY t.due_date"
            ).fetchall()
    return [dict(r) for r in rows]


def get_tasks_for_sidebar(class_id: int):
    """Returns all tasks for a class (including hidden) for the sidebar checklist."""
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT t.*, c.color FROM tasks t JOIN classes c ON c.id = t.class_id WHERE t.class_id = ? ORDER BY t.due_date",
            (class_id,)
        ).fetchall()
    return [dict(r) for r in rows]


def toggle_task_hidden(task_id: int) -> bool:
    with get_conn() as conn:
        conn.execute("UPDATE tasks SET hidden = 1 - hidden WHERE id = ?", (task_id,))
        row = conn.execute("SELECT hidden FROM tasks WHERE id = ?", (task_id,)).fetchone()
    return bool(row["hidden"])


def get_task(task_id: int):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT t.*, c.name as class_name, c.color FROM tasks t JOIN classes c ON c.id = t.class_id WHERE t.id = ?",
            (task_id,)
        ).fetchone()
    return dict(row) if row else None


def delete_task(task_id: int):
    with get_conn() as conn:
        conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))


def get_setting(key: str, default: str = '') -> str:
    with get_conn() as conn:
        row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else default


def set_setting(key: str, value: str):
    with get_conn() as conn:
        conn.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, value))


def update_task(task_id: int, fields: dict):
    allowed = {"title", "type", "due_date", "description", "estimated_hours"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    with get_conn() as conn:
        conn.execute(f"UPDATE tasks SET {set_clause} WHERE id = ?", (*updates.values(), task_id))

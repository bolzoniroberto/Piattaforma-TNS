"""
SQLite connection helpers for TNS OrgPlus Manager.
Punta direttamente a orgplus.db (stesso DB usato dall'app Electron).
All DB access goes through this module — same API as the Supabase version.
"""
from __future__ import annotations

import sqlite3
import streamlit as st
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# ── Path DB ───────────────────────────────────────────────────────────────────
# Prova prima nella cartella data/ locale (bundled), poi il path Electron
_LOCAL_DB = Path(__file__).parent.parent / "data" / "orgplus.db"
_ELECTRON_DB = Path.home() / "Library/Application Support/tns-orgplus/orgplus.db"

def _db_path() -> Path:
    if _LOCAL_DB.exists():
        return _LOCAL_DB
    if _ELECTRON_DB.exists():
        return _ELECTRON_DB
    raise FileNotFoundError(
        f"Database non trovato.\n"
        f"Atteso in:\n  {_LOCAL_DB}\n  {_ELECTRON_DB}\n"
        f"Copia orgplus.db in masterdata/data/orgplus.db"
    )


# ── Connection pool (thread-safe per Streamlit) ───────────────────────────────

@st.cache_resource
def _get_conn_path() -> str:
    """Risolve e cacha il path del DB una volta sola."""
    p = _db_path()
    return str(p)


def _conn() -> sqlite3.Connection:
    """Apre una connessione SQLite con row_factory. Non cachata (thread-safe)."""
    conn = sqlite3.connect(_get_conn_path(), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def _rows(cursor: sqlite3.Cursor) -> list[dict]:
    return [dict(r) for r in cursor.fetchall()]


# ── Query helpers ─────────────────────────────────────────────────────────────

def fetch_strutture(include_deleted: bool = False) -> list[dict]:
    with _conn() as conn:
        if include_deleted:
            return _rows(conn.execute("SELECT * FROM strutture ORDER BY codice"))
        return _rows(conn.execute("SELECT * FROM strutture WHERE deleted_at IS NULL ORDER BY codice"))


def fetch_dipendenti(include_deleted: bool = False) -> list[dict]:
    with _conn() as conn:
        if include_deleted:
            return _rows(conn.execute("SELECT * FROM dipendenti ORDER BY titolare"))
        return _rows(conn.execute("SELECT * FROM dipendenti WHERE deleted_at IS NULL ORDER BY titolare"))


def fetch_change_log(limit: int = 500) -> list[dict]:
    with _conn() as conn:
        return _rows(conn.execute(
            "SELECT * FROM change_log ORDER BY timestamp DESC LIMIT ?", (limit,)
        ))


# ── CRUD helpers ──────────────────────────────────────────────────────────────

def update_struttura(codice: str, fields: dict[str, Any]) -> dict:
    with _conn() as conn:
        old = dict(conn.execute("SELECT * FROM strutture WHERE codice=?", (codice,)).fetchone() or {})
        set_clause = ", ".join(f"{k}=?" for k in fields)
        conn.execute(
            f"UPDATE strutture SET {set_clause}, updated_at=? WHERE codice=?",
            [*fields.values(), _now(), codice]
        )
        conn.commit()
        for field, new_val in fields.items():
            old_val = old.get(field)
            if str(old_val) != str(new_val):
                _log_change(conn, "struttura", codice, old.get("descrizione") or codice,
                            "update", field, str(old_val), str(new_val))
        conn.commit()
    return {**old, **fields}


def update_dipendente(cf: str, fields: dict[str, Any]) -> dict:
    with _conn() as conn:
        old = dict(conn.execute("SELECT * FROM dipendenti WHERE codice_fiscale=?", (cf,)).fetchone() or {})
        set_clause = ", ".join(f"{k}=?" for k in fields)
        conn.execute(
            f"UPDATE dipendenti SET {set_clause}, updated_at=? WHERE codice_fiscale=?",
            [*fields.values(), _now(), cf]
        )
        label = old.get("titolare") or cf
        for field, new_val in fields.items():
            old_val = old.get(field)
            if str(old_val) != str(new_val):
                _log_change(conn, "dipendente", cf, label, "update", field, str(old_val), str(new_val))
        conn.commit()
    return {**old, **fields}


def create_struttura(data: dict[str, Any]) -> dict:
    cols = list(data.keys())
    with _conn() as conn:
        conn.execute(
            f"INSERT INTO strutture ({','.join(cols)}) VALUES ({','.join('?'*len(cols))})",
            list(data.values())
        )
        _log_change(conn, "struttura", data["codice"], data.get("descrizione") or data["codice"],
                    "create", None, None, None)
        conn.commit()
    return data


def create_dipendente(data: dict[str, Any]) -> dict:
    cols = list(data.keys())
    with _conn() as conn:
        conn.execute(
            f"INSERT INTO dipendenti ({','.join(cols)}) VALUES ({','.join('?'*len(cols))})",
            list(data.values())
        )
        _log_change(conn, "dipendente", data["codice_fiscale"],
                    data.get("titolare") or data["codice_fiscale"],
                    "create", None, None, None)
        conn.commit()
    return data


def soft_delete_struttura(codice: str) -> None:
    with _conn() as conn:
        row = conn.execute("SELECT descrizione FROM strutture WHERE codice=?", (codice,)).fetchone()
        conn.execute("UPDATE strutture SET deleted_at=? WHERE codice=?", (_now(), codice))
        _log_change(conn, "struttura", codice, (row["descrizione"] if row else codice),
                    "delete", None, None, None)
        conn.commit()


def soft_delete_dipendente(cf: str) -> None:
    with _conn() as conn:
        row = conn.execute("SELECT titolare FROM dipendenti WHERE codice_fiscale=?", (cf,)).fetchone()
        conn.execute("UPDATE dipendenti SET deleted_at=? WHERE codice_fiscale=?", (_now(), cf))
        _log_change(conn, "dipendente", cf, (row["titolare"] if row else cf),
                    "delete", None, None, None)
        conn.commit()


def restore_struttura(codice: str) -> None:
    with _conn() as conn:
        conn.execute("UPDATE strutture SET deleted_at=NULL WHERE codice=?", (codice,))
        _log_change(conn, "struttura", codice, codice, "restore", None, None, None)
        conn.commit()


def restore_dipendente(cf: str) -> None:
    with _conn() as conn:
        conn.execute("UPDATE dipendenti SET deleted_at=NULL WHERE codice_fiscale=?", (cf,))
        _log_change(conn, "dipendente", cf, cf, "restore", None, None, None)
        conn.commit()


def update_struttura_parent(codice: str, new_parent: str | None) -> dict:
    with _conn() as conn:
        old = dict(conn.execute("SELECT codice_padre, descrizione FROM strutture WHERE codice=?", (codice,)).fetchone() or {})
        conn.execute("UPDATE strutture SET codice_padre=?, updated_at=? WHERE codice=?",
                     (new_parent, _now(), codice))
        _log_change(conn, "struttura", codice, old.get("descrizione") or codice,
                    "update", "codice_padre", old.get("codice_padre"), new_parent)
        conn.commit()
    return {**old, "codice_padre": new_parent}


def move_dipendente(cf: str, new_struttura: str) -> dict:
    with _conn() as conn:
        old = dict(conn.execute("SELECT codice_struttura, titolare FROM dipendenti WHERE codice_fiscale=?", (cf,)).fetchone() or {})
        conn.execute("UPDATE dipendenti SET codice_struttura=?, updated_at=? WHERE codice_fiscale=?",
                     (new_struttura, _now(), cf))
        _log_change(conn, "dipendente", cf, old.get("titolare") or cf,
                    "update", "codice_struttura", old.get("codice_struttura"), new_struttura)
        conn.commit()
    return {**old, "codice_struttura": new_struttura}


# ── Batch upsert (import XLS) ─────────────────────────────────────────────────

def upsert_strutture(rows: list[dict]) -> int:
    if not rows:
        return 0
    cols = list(rows[0].keys())
    placeholders = ",".join("?" * len(cols))
    sql = (f"INSERT INTO strutture ({','.join(cols)}) VALUES ({placeholders}) "
           f"ON CONFLICT(codice) DO UPDATE SET "
           + ", ".join(f"{c}=excluded.{c}" for c in cols if c != "codice"))
    with _conn() as conn:
        conn.executemany(sql, [list(r.values()) for r in rows])
        conn.commit()
    return len(rows)


def upsert_dipendenti(rows: list[dict]) -> int:
    if not rows:
        return 0
    cols = list(rows[0].keys())
    placeholders = ",".join("?" * len(cols))
    sql = (f"INSERT INTO dipendenti ({','.join(cols)}) VALUES ({placeholders}) "
           f"ON CONFLICT(codice_fiscale) DO UPDATE SET "
           + ", ".join(f"{c}=excluded.{c}" for c in cols if c != "codice_fiscale"))
    with _conn() as conn:
        conn.executemany(sql, [list(r.values()) for r in rows])
        conn.commit()
    return len(rows)


# ── Derived queries ───────────────────────────────────────────────────────────

def fetch_orphan_dipendenti() -> list[dict]:
    with _conn() as conn:
        return _rows(conn.execute("""
            SELECT d.* FROM dipendenti d
            WHERE d.deleted_at IS NULL
              AND (d.codice_struttura IS NULL
                   OR d.codice_struttura = ''
                   OR d.codice_struttura NOT IN (
                       SELECT codice FROM strutture WHERE deleted_at IS NULL
                   ))
            ORDER BY d.titolare
        """))


def fetch_orphan_strutture() -> list[dict]:
    with _conn() as conn:
        return _rows(conn.execute("""
            SELECT s.* FROM strutture s
            WHERE s.deleted_at IS NULL
              AND s.codice_padre IS NOT NULL
              AND s.codice_padre != ''
              AND s.codice_padre NOT IN (
                  SELECT codice FROM strutture WHERE deleted_at IS NULL
              )
            ORDER BY s.codice
        """))


def fetch_empty_strutture() -> list[dict]:
    """Strutture con nessun dipendente in tutto il sottoalbero (ricorsivo in Python)."""
    strutture = fetch_strutture(include_deleted=False)
    dipendenti = fetch_dipendenti(include_deleted=False)

    con_dipendenti: set[str] = {d["codice_struttura"] for d in dipendenti if d.get("codice_struttura")}
    children_map: dict[str, list[str]] = {}
    for s in strutture:
        padre = s.get("codice_padre")
        if padre:
            children_map.setdefault(padre, []).append(s["codice"])

    def subtree_has_dipendenti(codice: str, visited: set[str] | None = None) -> bool:
        if visited is None:
            visited = set()
        if codice in visited:
            return False
        visited.add(codice)
        if codice in con_dipendenti:
            return True
        for child in children_map.get(codice, []):
            if subtree_has_dipendenti(child, visited):
                return True
        return False

    return [s for s in strutture if not subtree_has_dipendenti(s["codice"])]


# ── Internal ──────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _log_change(conn: sqlite3.Connection, entity_type: str, entity_id: str,
                entity_label: str, action: str,
                field_name: str | None, old_value: str | None, new_value: str | None) -> None:
    try:
        conn.execute("""
            INSERT INTO change_log (timestamp, entity_type, entity_id, entity_label,
                                    action, field_name, old_value, new_value)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (_now(), entity_type, entity_id, entity_label,
              action, field_name, old_value, new_value))
    except Exception:
        pass  # Non-critical

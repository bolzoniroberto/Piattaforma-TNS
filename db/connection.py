"""
Supabase connection helpers for TNS OrgPlus Manager.
All DB access goes through this module.
"""
from __future__ import annotations

import streamlit as st
from supabase import create_client, Client
from datetime import datetime, timezone
from typing import Any

# ── Connection ────────────────────────────────────────────────────────────────

@st.cache_resource
def get_client() -> Client:
    """Return a cached Supabase client (one instance per app session)."""
    url = st.secrets["connections"]["supabase"]["url"]
    key = st.secrets["connections"]["supabase"]["key"]
    return create_client(url, key)


# ── Query helpers ─────────────────────────────────────────────────────────────

def fetch_strutture(include_deleted: bool = False) -> list[dict]:
    client = get_client()
    q = client.table("strutture").select("*").order("codice")
    if not include_deleted:
        q = q.is_("deleted_at", "null")
    return q.execute().data


def fetch_dipendenti(include_deleted: bool = False) -> list[dict]:
    client = get_client()
    q = client.table("dipendenti").select("*").order("titolare")
    if not include_deleted:
        q = q.is_("deleted_at", "null")
    return q.execute().data


def fetch_change_log(limit: int = 500) -> list[dict]:
    client = get_client()
    return (
        client.table("change_log")
        .select("*")
        .order("timestamp", desc=True)
        .limit(limit)
        .execute()
        .data
    )


# ── CRUD helpers ──────────────────────────────────────────────────────────────

def update_struttura(codice: str, fields: dict[str, Any]) -> dict:
    """Update one or more fields on a struttura. Returns updated row."""
    client = get_client()
    old = client.table("strutture").select("*").eq("codice", codice).single().execute().data
    result = client.table("strutture").update(fields).eq("codice", codice).execute()
    # Log each changed field
    for field, new_val in fields.items():
        old_val = old.get(field)
        if str(old_val) != str(new_val):
            _log_change("struttura", codice, old.get("descrizione") or codice,
                        "update", field, str(old_val), str(new_val))
    return result.data[0] if result.data else {}


def update_dipendente(cf: str, fields: dict[str, Any]) -> dict:
    """Update one or more fields on a dipendente. Returns updated row."""
    client = get_client()
    old = client.table("dipendenti").select("*").eq("codice_fiscale", cf).single().execute().data
    result = client.table("dipendenti").update(fields).eq("codice_fiscale", cf).execute()
    label = old.get("titolare") or cf
    for field, new_val in fields.items():
        old_val = old.get(field)
        if str(old_val) != str(new_val):
            _log_change("dipendente", cf, label, "update", field, str(old_val), str(new_val))
    return result.data[0] if result.data else {}


def create_struttura(data: dict[str, Any]) -> dict:
    client = get_client()
    result = client.table("strutture").insert(data).execute()
    if result.data:
        row = result.data[0]
        _log_change("struttura", row["codice"], row.get("descrizione") or row["codice"],
                    "create", None, None, None)
    return result.data[0] if result.data else {}


def create_dipendente(data: dict[str, Any]) -> dict:
    client = get_client()
    result = client.table("dipendenti").insert(data).execute()
    if result.data:
        row = result.data[0]
        _log_change("dipendente", row["codice_fiscale"], row.get("titolare") or row["codice_fiscale"],
                    "create", None, None, None)
    return result.data[0] if result.data else {}


def soft_delete_struttura(codice: str) -> None:
    client = get_client()
    row = client.table("strutture").select("descrizione").eq("codice", codice).single().execute().data
    client.table("strutture").update({"deleted_at": _now()}).eq("codice", codice).execute()
    _log_change("struttura", codice, row.get("descrizione") or codice, "delete", None, None, None)


def soft_delete_dipendente(cf: str) -> None:
    client = get_client()
    row = client.table("dipendenti").select("titolare").eq("codice_fiscale", cf).single().execute().data
    client.table("dipendenti").update({"deleted_at": _now()}).eq("codice_fiscale", cf).execute()
    _log_change("dipendente", cf, row.get("titolare") or cf, "delete", None, None, None)


def restore_struttura(codice: str) -> None:
    client = get_client()
    client.table("strutture").update({"deleted_at": None}).eq("codice", codice).execute()
    _log_change("struttura", codice, codice, "restore", None, None, None)


def restore_dipendente(cf: str) -> None:
    client = get_client()
    client.table("dipendenti").update({"deleted_at": None}).eq("codice_fiscale", cf).execute()
    _log_change("dipendente", cf, cf, "restore", None, None, None)


def update_struttura_parent(codice: str, new_parent: str | None) -> dict:
    """Move a struttura to a new parent (or root if new_parent is None)."""
    client = get_client()
    old_row = client.table("strutture").select("codice_padre,descrizione").eq("codice", codice).single().execute().data
    result = client.table("strutture").update({"codice_padre": new_parent}).eq("codice", codice).execute()
    _log_change("struttura", codice, old_row.get("descrizione") or codice,
                "update", "codice_padre", old_row.get("codice_padre"), new_parent)
    return result.data[0] if result.data else {}


def move_dipendente(cf: str, new_struttura: str) -> dict:
    """Move a dipendente to a different struttura."""
    client = get_client()
    old_row = client.table("dipendenti").select("codice_struttura,titolare").eq("codice_fiscale", cf).single().execute().data
    result = client.table("dipendenti").update({"codice_struttura": new_struttura}).eq("codice_fiscale", cf).execute()
    _log_change("dipendente", cf, old_row.get("titolare") or cf,
                "update", "codice_struttura", old_row.get("codice_struttura"), new_struttura)
    return result.data[0] if result.data else {}


# ── Batch upsert (used by import + seed) ─────────────────────────────────────

def upsert_strutture(rows: list[dict]) -> int:
    """Upsert a list of strutture rows. Returns count inserted/updated."""
    client = get_client()
    if not rows:
        return 0
    result = client.table("strutture").upsert(rows, on_conflict="codice").execute()
    return len(result.data)


def upsert_dipendenti(rows: list[dict]) -> int:
    """Upsert a list of dipendenti rows. Returns count inserted/updated."""
    client = get_client()
    if not rows:
        return 0
    result = client.table("dipendenti").upsert(rows, on_conflict="codice_fiscale").execute()
    return len(result.data)


# ── Derived queries ───────────────────────────────────────────────────────────

def fetch_orphan_dipendenti() -> list[dict]:
    """Dipendenti whose codice_struttura doesn't exist in strutture."""
    client = get_client()
    # All active strutture codici
    strutture_codici = {
        r["codice"]
        for r in client.table("strutture").select("codice").is_("deleted_at", "null").execute().data
    }
    all_dip = fetch_dipendenti(include_deleted=False)
    return [
        d for d in all_dip
        if not d.get("codice_struttura") or d["codice_struttura"] not in strutture_codici
    ]


def fetch_orphan_strutture() -> list[dict]:
    """Strutture whose codice_padre doesn't exist in strutture."""
    client = get_client()
    strutture_codici = {
        r["codice"]
        for r in client.table("strutture").select("codice").is_("deleted_at", "null").execute().data
    }
    all_str = fetch_strutture(include_deleted=False)
    return [
        s for s in all_str
        if s.get("codice_padre") and s["codice_padre"] not in strutture_codici
    ]


def fetch_empty_strutture() -> list[dict]:
    """
    Strutture with no dipendenti anywhere in their subtree.
    Uses a recursive Python approach (PostgreSQL CTE alternative if needed).
    """
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


def _log_change(entity_type: str, entity_id: str, entity_label: str,
                action: str, field_name: str | None,
                old_value: str | None, new_value: str | None) -> None:
    try:
        get_client().table("change_log").insert({
            "entity_type":  entity_type,
            "entity_id":    entity_id,
            "entity_label": entity_label,
            "action":       action,
            "field_name":   field_name,
            "old_value":    old_value,
            "new_value":    new_value,
        }).execute()
    except Exception:
        pass  # Non-critical — don't crash the app on log failure

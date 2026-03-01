"""
Script di migrazione one-shot: SQLite (orgplus.db) → Supabase (PostgreSQL)

Utilizzo:
  1. Aggiungi le credenziali Supabase in .streamlit/secrets.toml
  2. Esegui: python db/seed_from_sqlite.py

Il script:
  - Legge strutture e dipendenti da orgplus.db
  - Inserisce le strutture prima (senza FK violations)
  - Poi inserisce i dipendenti (con codice_struttura → NULL se la struttura non esiste)
  - Logga i record skippati
"""
from __future__ import annotations

import sqlite3
import sys
import os
from pathlib import Path

# Aggiungi la root del progetto al PYTHONPATH
sys.path.insert(0, str(Path(__file__).parent.parent))

import streamlit as st
from supabase import create_client

# ── Config ────────────────────────────────────────────────────────────────────
SQLITE_PATH = Path.home() / "Library/Application Support/tns-orgplus/orgplus.db"

# Leggi credenziali dal secrets.toml (o da env vars)
def get_supabase_client():
    try:
        url = st.secrets["connections"]["supabase"]["url"]
        key = st.secrets["connections"]["supabase"]["key"]
    except Exception:
        url = os.environ.get("SUPABASE_URL", "")
        key = os.environ.get("SUPABASE_KEY", "")
    if not url or not key:
        raise ValueError("Credenziali Supabase non trovate. Configura .streamlit/secrets.toml o env vars.")
    return create_client(url, key)


# ── Lettura SQLite ────────────────────────────────────────────────────────────

def read_sqlite(path: Path) -> tuple[list[dict], list[dict]]:
    if not path.exists():
        raise FileNotFoundError(f"Database SQLite non trovato: {path}")

    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row

    strutture_rows = conn.execute("""
        SELECT codice, codice_padre, descrizione, cdc_costo, cdc_costo_is_numeric,
               titolare, livello, unita_organizzativa, approvatore, viaggiatore,
               cassiere, segr_red_assistita, segretario_assistito, controllore_assistito,
               ruoli_afc, ruoli_hr, altri_ruoli, ruoli, ruoli_oltre_v, segr_redaz,
               segretario, controllore, amministrazione, visualizzatori,
               sede_tns, gruppo_sind, created_at, updated_at, deleted_at
        FROM strutture
    """).fetchall()

    dipendenti_rows = conn.execute("""
        SELECT codice_fiscale, codice_nel_file, codice_struttura, titolare,
               unita_organizzativa, cdc_costo, cdc_costo_is_numeric, livello,
               approvatore, viaggiatore, cassiere, segr_red_assistita,
               segretario_assistito, controllore_assistito,
               ruoli_afc, ruoli_hr, altri_ruoli, ruoli, ruoli_oltre_v, segr_redaz,
               segretario, controllore, amministrazione, visualizzatori,
               sede_tns, gruppo_sind, created_at, updated_at, deleted_at
        FROM dipendenti
    """).fetchall()

    conn.close()

    strutture = [dict(r) for r in strutture_rows]
    dipendenti = [dict(r) for r in dipendenti_rows]
    return strutture, dipendenti


# ── Inserimento ───────────────────────────────────────────────────────────────

BATCH_SIZE = 100

def _clean_row(row: dict) -> dict:
    """Rimuovi None per chiavi non necessarie, converti tipi."""
    return {k: (str(v) if v is not None and not isinstance(v, (int, float)) else v)
            for k, v in row.items() if v is not None and str(v).strip() not in ("", "None")}


def migrate(dry_run: bool = False) -> None:
    print(f"📂 Lettura da: {SQLITE_PATH}")
    strutture, dipendenti = read_sqlite(SQLITE_PATH)
    print(f"   → {len(strutture)} strutture, {len(dipendenti)} dipendenti")

    if dry_run:
        print("🔍 DRY RUN — nessuna scrittura su Supabase")
        return

    client = get_supabase_client()
    strutture_codici = {s["codice"] for s in strutture}

    # ── Inserisci strutture in batch ──
    print(f"\n📂 Inserimento strutture...")
    ok_str = 0
    skip_str = []
    for i in range(0, len(strutture), BATCH_SIZE):
        batch = strutture[i:i+BATCH_SIZE]
        # Rimuovi riferimenti FK circolari temporaneamente:
        # strutture con codice_padre che non esiste nello stesso batch
        clean_batch = []
        for s in batch:
            row = _clean_row(s)
            if row.get("codice_padre") and row["codice_padre"] not in strutture_codici:
                print(f"   ⚠️  Struttura {row['codice']}: codice_padre '{row['codice_padre']}' non trovato → set NULL")
                row["codice_padre"] = None
            clean_batch.append(row)
        try:
            result = client.table("strutture").upsert(clean_batch, on_conflict="codice").execute()
            ok_str += len(result.data)
            print(f"   Batch {i//BATCH_SIZE + 1}: {len(result.data)} ok")
        except Exception as e:
            print(f"   ❌ Batch {i//BATCH_SIZE + 1} errore: {e}")
            skip_str.extend([s.get("codice") for s in batch])

    print(f"   ✅ {ok_str} strutture inserite/aggiornate, {len(skip_str)} saltate")

    # ── Inserisci dipendenti in batch ──
    print(f"\n👤 Inserimento dipendenti...")
    ok_dip = 0
    skip_dip = []
    for i in range(0, len(dipendenti), BATCH_SIZE):
        batch = dipendenti[i:i+BATCH_SIZE]
        clean_batch = []
        for d in batch:
            row = _clean_row(d)
            cs = row.get("codice_struttura")
            if cs and cs not in strutture_codici:
                print(f"   ⚠️  Dipendente {row.get('codice_fiscale')}: codice_struttura '{cs}' non trovato → set NULL")
                row["codice_struttura"] = None
            clean_batch.append(row)
        try:
            result = client.table("dipendenti").upsert(clean_batch, on_conflict="codice_fiscale").execute()
            ok_dip += len(result.data)
            print(f"   Batch {i//BATCH_SIZE + 1}: {len(result.data)} ok")
        except Exception as e:
            print(f"   ❌ Batch {i//BATCH_SIZE + 1} errore: {e}")
            skip_dip.extend([d.get("codice_fiscale") for d in batch])

    print(f"   ✅ {ok_dip} dipendenti inseriti/aggiornati, {len(skip_dip)} saltati")

    if skip_str or skip_dip:
        print(f"\n⚠️  Saltati: strutture={skip_str}, dipendenti={skip_dip}")

    print(f"\n🎉 Migrazione completata!")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Migra dati da SQLite a Supabase")
    parser.add_argument("--dry-run", action="store_true", help="Simula senza scrivere")
    args = parser.parse_args()
    migrate(dry_run=args.dry_run)

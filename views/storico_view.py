"""
Storico View — log delle modifiche (change_log).
"""
from __future__ import annotations

import pandas as pd
import streamlit as st
import db.connection as db


def render() -> None:
    col1, col2, col3, col4 = st.columns([2, 2, 2, 1])
    with col1:
        search = st.text_input("🔍 Cerca", placeholder="ID, campo, valore...", label_visibility="collapsed")
    with col2:
        entity_filter = st.selectbox("Tipo", ["Tutti", "struttura", "dipendente"], label_visibility="collapsed")
    with col3:
        action_filter = st.selectbox("Azione", ["Tutte", "create", "update", "delete", "restore"], label_visibility="collapsed")
    with col4:
        limit = st.number_input("Max righe", value=500, min_value=50, max_value=5000, step=50, label_visibility="collapsed")

    rows = db.fetch_change_log(limit=int(limit))
    if not rows:
        st.info("Nessuna modifica registrata.")
        return

    df = pd.DataFrame(rows)

    # Filtri
    if entity_filter != "Tutti":
        df = df[df["entity_type"] == entity_filter]
    if action_filter != "Tutte":
        df = df[df["action"] == action_filter]
    if search:
        mask = df.apply(lambda col: col.astype(str).str.contains(search, case=False, na=False)).any(axis=1)
        df = df[mask]

    st.caption(f"📋 {len(df)} modifiche  |  Ordinate dalla più recente")

    # Formatta timestamp
    if "timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"]).dt.strftime("%Y-%m-%d %H:%M:%S")

    # Colori per azione
    def color_action(val: str) -> str:
        colors = {
            "create":  "background-color: #dcfce7; color: #166534",
            "update":  "background-color: #eff6ff; color: #1e40af",
            "delete":  "background-color: #fee2e2; color: #991b1b",
            "restore": "background-color: #fef9c3; color: #713f12",
        }
        return colors.get(str(val), "")

    cols_show = [c for c in ["timestamp", "entity_type", "entity_id", "entity_label",
                              "action", "field_name", "old_value", "new_value"] if c in df.columns]

    styled = df[cols_show].style.map(color_action, subset=["action"] if "action" in cols_show else [])
    st.dataframe(styled, use_container_width=True, height=520)

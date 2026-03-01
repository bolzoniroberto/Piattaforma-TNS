"""
Grid View — streamlit-aggrid con inline editing, floating filters,
checkbox multi-selezione, e tab speciali (orfani, strutture vuote).
"""
from __future__ import annotations

import pandas as pd
import streamlit as st
from st_aggrid import AgGrid, GridOptionsBuilder, GridUpdateMode, DataReturnMode, JsCode

import db.connection as db

# ── Opzioni campi con valori noti (per selectbox nel drawer) ──────────────────
FIELD_OPTIONS: dict[str, list[str]] = {
    "approvatore":           ["APPR", "APPRG", "APPRSRALTR", "APPRTOP"],
    "viaggiatore":           ["V", "VG", "VGTOP2", "VGTOP"],
    "cassiere":              ["CMIR", "CMID", "CRMR", "CAQD"],
    "segr_red_assistita":    ["SGQMIILD", "SGQRMGUOR", "SGRRM", "SGRADIOMI", "SGRMI", "SGRADIORM", "SGDR", "SGHTSI"],
    "segretario_assistito":  ["SEGRETARIOMI"],
    "controllore_assistito": ["CONTD", "CONTGMI", "CONTGRM", "CONTGRADIOMI", "CONTGRADIORM"],
    "sede_tns":              ["Milano", "Roma", "Trento", "Venezia Marghera", "Palermo", "Genova"],
    "ruoli_afc":             ["AFCCDG", "AFCNS", "AFCFISC", "AFCSV"],
    "ruoli_hr":              ["AMMPERS"],
}

# ── Colonne visibili nelle griglie ────────────────────────────────────────────
STRUTTURE_COLS = ["codice", "descrizione", "cdc_costo", "codice_padre", "titolare",
                  "approvatore", "sede_tns"]
STRUTTURE_EDITABLE = {"descrizione", "cdc_costo", "codice_padre", "titolare", "approvatore", "sede_tns"}

DIPENDENTI_COLS = ["codice_fiscale", "titolare", "codice_struttura", "viaggiatore",
                   "approvatore", "cassiere", "sede_tns"]
DIPENDENTI_EDITABLE = {"titolare", "codice_struttura", "viaggiatore", "approvatore", "cassiere", "sede_tns"}


# ── Helper: costruisce AgGrid options ─────────────────────────────────────────

def _build_grid(df: pd.DataFrame, editable_cols: set[str]) -> dict:
    gb = GridOptionsBuilder.from_dataframe(df)
    gb.configure_default_column(
        resizable=True, sortable=True, filter=True, floatingFilter=True,
        editable=False, suppressMovable=False,
    )
    gb.configure_selection("multiple", use_checkbox=True, header_checkbox=True)
    for col in df.columns:
        is_editable = col in editable_cols
        gb.configure_column(col, editable=is_editable, minWidth=80)
    # PK columns — non editable, highlighted
    pk = "codice" if "codice" in df.columns else "codice_fiscale"
    gb.configure_column(pk, editable=False, pinned="left", width=130,
                        cellStyle={"fontFamily": "monospace", "color": "#6b7280"})
    return gb.build()


# ── Salva modifiche inline ────────────────────────────────────────────────────

def _save_changes(grid_response, tab: str, df_original: pd.DataFrame) -> None:
    """Detect changed cells from AgGrid response and persist to Supabase."""
    selected = grid_response.get("selected_rows")
    updated = grid_response.get("data")
    if updated is None:
        return

    updated_df = pd.DataFrame(updated)
    pk = "codice" if tab in ("strutture", "orfani_str", "str_vuote") else "codice_fiscale"

    changed_count = 0
    for _, new_row in updated_df.iterrows():
        key_val = new_row[pk]
        old_rows = df_original[df_original[pk] == key_val]
        if old_rows.empty:
            continue
        old_row = old_rows.iloc[0]
        changed_fields = {
            col: new_row[col]
            for col in updated_df.columns
            if col != pk and str(new_row.get(col, "")) != str(old_row.get(col, ""))
        }
        if not changed_fields:
            continue
        try:
            if tab in ("strutture", "orfani_str", "str_vuote"):
                db.update_struttura(key_val, changed_fields)
            else:
                db.update_dipendente(key_val, changed_fields)
            changed_count += 1
        except Exception as e:
            st.toast(f"Errore su {key_val}: {e}", icon="❌")

    if changed_count:
        st.toast(f"✅ {changed_count} {'struttura/e' if tab in ('strutture','orfani_str','str_vuote') else 'dipendente/i'} aggiornata/i")
        st.rerun()

    # Bulk edit su righe selezionate
    if selected:
        _bulk_edit_panel(selected, tab)


def _bulk_edit_panel(selected_rows: list[dict], tab: str) -> None:
    """Panel per applicare lo stesso valore a tutte le righe selezionate."""
    if not selected_rows:
        return
    is_struttura = tab in ("strutture", "orfani_str", "str_vuote")
    editable = STRUTTURE_EDITABLE if is_struttura else DIPENDENTI_EDITABLE
    pk = "codice" if is_struttura else "codice_fiscale"

    with st.expander(f"✏️ Modifica bulk — {len(selected_rows)} righe selezionate"):
        col1, col2, col3 = st.columns([2, 3, 1])
        with col1:
            field = st.selectbox("Campo", sorted(editable), key=f"bulk_field_{tab}")
        with col2:
            opts = FIELD_OPTIONS.get(field, [])
            if opts:
                value = st.selectbox("Valore", [""] + opts, key=f"bulk_val_{tab}")
            else:
                value = st.text_input("Valore", key=f"bulk_val_{tab}")
        with col3:
            st.write("")
            st.write("")
            apply = st.button("Applica", key=f"bulk_apply_{tab}", type="primary")

        if apply and field and value != "":
            ok = 0
            for row in selected_rows:
                key_val = row.get(pk)
                if not key_val:
                    continue
                try:
                    if is_struttura:
                        db.update_struttura(key_val, {field: value})
                    else:
                        db.update_dipendente(key_val, {field: value})
                    ok += 1
                except Exception as e:
                    st.toast(f"Errore su {key_val}: {e}", icon="❌")
            if ok:
                st.toast(f"✅ '{field}' aggiornato su {ok} righe")
                st.rerun()


# ── Drawer modifica singolo record ────────────────────────────────────────────

@st.dialog("Modifica record", width="large")
def _record_dialog(record: dict, entity_type: str) -> None:
    is_struttura = entity_type == "struttura"
    pk = record.get("codice") if is_struttura else record.get("codice_fiscale")
    editable = STRUTTURE_EDITABLE if is_struttura else DIPENDENTI_EDITABLE
    all_cols = list(record.keys())

    st.caption(f"{'Struttura' if is_struttura else 'Dipendente'}: **{pk}**")

    # Dividi in sezioni
    basic = [c for c in all_cols if c in ("descrizione", "titolare", "cdc_costo", "codice_padre", "codice_struttura", "sede_tns", "livello")]
    roles = [c for c in all_cols if c in editable and c not in basic and c not in ("created_at", "updated_at", "deleted_at", "id")]

    changes: dict[str, str] = {}

    with st.form(key=f"record_form_{pk}"):
        st.subheader("Dati principali")
        cols = st.columns(2)
        for i, field in enumerate(basic):
            with cols[i % 2]:
                opts = FIELD_OPTIONS.get(field, [])
                val = str(record.get(field) or "")
                if field in editable:
                    if opts:
                        idx = opts.index(val) + 1 if val in opts else 0
                        changes[field] = st.selectbox(field, [""] + opts, index=idx, key=f"f_{pk}_{field}")
                    else:
                        changes[field] = st.text_input(field, value=val, key=f"f_{pk}_{field}")
                else:
                    st.text_input(field, value=val, disabled=True, key=f"f_{pk}_{field}")

        if roles:
            st.subheader("Ruoli e classificazioni")
            cols2 = st.columns(3)
            for i, field in enumerate(roles):
                with cols2[i % 3]:
                    opts = FIELD_OPTIONS.get(field, [])
                    val = str(record.get(field) or "")
                    if opts:
                        idx = opts.index(val) + 1 if val in opts else 0
                        changes[field] = st.selectbox(field, [""] + opts, index=idx, key=f"f_{pk}_{field}")
                    else:
                        changes[field] = st.text_input(field, value=val, key=f"f_{pk}_{field}")

        c1, c2 = st.columns([1, 1])
        save = c1.form_submit_button("💾 Salva", type="primary")
        delete = c2.form_submit_button("🗑️ Elimina", type="secondary")

    if save:
        dirty = {k: v for k, v in changes.items() if str(record.get(k) or "") != str(v or "")}
        if dirty:
            try:
                if is_struttura:
                    db.update_struttura(pk, dirty)
                else:
                    db.update_dipendente(pk, dirty)
                st.toast(f"✅ {pk} aggiornato")
                st.rerun()
            except Exception as e:
                st.error(str(e))
        else:
            st.info("Nessuna modifica rilevata.")

    if delete:
        try:
            if is_struttura:
                db.soft_delete_struttura(pk)
            else:
                db.soft_delete_dipendente(pk)
            st.toast(f"🗑️ {pk} eliminato")
            st.rerun()
        except Exception as e:
            st.error(str(e))


# ── Main render ───────────────────────────────────────────────────────────────

def render() -> None:
    # Sub-tabs
    sub_tabs = st.tabs([
        "🏗️ Strutture",
        "👤 Dipendenti",
        "⚠️ Orfani Dip.",
        "⚠️ Orfani Str.",
        "🌿 Str. Vuote",
    ])
    tab_keys = ["strutture", "dipendenti", "orfani_dip", "orfani_str", "str_vuote"]

    for i, (tab, key) in enumerate(zip(sub_tabs, tab_keys)):
        with tab:
            _render_sub_tab(key)


def _render_sub_tab(key: str) -> None:
    is_struttura = key in ("strutture", "orfani_str", "str_vuote")

    # Toolbar row
    col_search, col_sede, col_deleted, col_add = st.columns([3, 2, 1, 1])
    with col_search:
        search = st.text_input("🔍 Cerca", key=f"search_{key}", placeholder="Cerca...", label_visibility="collapsed")
    with col_sede:
        sede_filter = st.selectbox("Sede", ["Tutte le sedi", "Milano", "Roma", "Trento",
                                             "Venezia Marghera", "Palermo", "Genova"],
                                   key=f"sede_{key}", label_visibility="collapsed")
    with col_deleted:
        show_deleted = st.checkbox("Eliminati", key=f"del_{key}")
    with col_add:
        add_clicked = key in ("strutture", "dipendenti") and st.button("➕ Aggiungi", key=f"add_{key}")

    # Carica dati
    if key == "strutture":
        rows = db.fetch_strutture(include_deleted=show_deleted)
    elif key == "dipendenti":
        rows = db.fetch_dipendenti(include_deleted=show_deleted)
    elif key == "orfani_dip":
        rows = db.fetch_orphan_dipendenti()
        st.info("⚠️ Dipendenti la cui struttura di assegnazione non esiste nel database.")
    elif key == "orfani_str":
        rows = db.fetch_orphan_strutture()
        st.info("⚠️ Strutture il cui padre non esiste nel database.")
    else:  # str_vuote
        rows = db.fetch_empty_strutture()
        st.info("🌿 Strutture senza dipendenti in nessun livello sottostante.")

    df_full = pd.DataFrame(rows) if rows else pd.DataFrame()

    if df_full.empty:
        st.info("Nessun record trovato.")
        return

    # Scegli colonne visibili
    visible_cols = STRUTTURE_COLS if is_struttura else DIPENDENTI_COLS
    visible_cols = [c for c in visible_cols if c in df_full.columns]
    df = df_full[visible_cols].copy()

    # Filtra per ricerca
    if search:
        mask = df.apply(lambda col: col.astype(str).str.contains(search, case=False, na=False)).any(axis=1)
        df = df[mask]

    # Filtra per sede
    if sede_filter != "Tutte le sedi" and "sede_tns" in df.columns:
        df = df[df["sede_tns"].str.lower() == sede_filter.lower()]

    editable = STRUTTURE_EDITABLE if is_struttura else DIPENDENTI_EDITABLE
    grid_opts = _build_grid(df, editable)

    st.caption(f"💡 Doppio click su una cella per modificarla · Seleziona più righe con ☑ per modifica bulk")

    grid_response = AgGrid(
        df,
        gridOptions=grid_opts,
        update_mode=GridUpdateMode.MODEL_CHANGED,
        data_return_mode=DataReturnMode.FILTERED_AND_SORTED,
        fit_columns_on_grid_load=False,
        height=480,
        allow_unsafe_jscode=True,
        key=f"grid_{key}",
    )

    # Gestisci modifiche
    _save_changes(grid_response, key, df)

    # Bottone apri drawer su riga selezionata
    selected = grid_response.get("selected_rows") or []
    if len(selected) == 1:
        if st.button("✏️ Apri scheda completa", key=f"open_drawer_{key}"):
            pk = "codice" if is_struttura else "codice_fiscale"
            pk_val = selected[0].get(pk)
            if pk_val:
                # Recupera record completo (con tutti i campi)
                full_rows = db.fetch_strutture(include_deleted=True) if is_struttura else db.fetch_dipendenti(include_deleted=True)
                full_df = pd.DataFrame(full_rows)
                pk_col = "codice" if is_struttura else "codice_fiscale"
                match = full_df[full_df[pk_col] == pk_val]
                if not match.empty:
                    _record_dialog(match.iloc[0].to_dict(), "struttura" if is_struttura else "dipendente")

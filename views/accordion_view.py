"""
Accordion View — vista gerarchica ricorsiva delle strutture con dipendenti.
Spostamento tramite selectbox + modale di conferma (no drag & drop).
"""
from __future__ import annotations

import streamlit as st
import db.connection as db


# ── Tipi ──────────────────────────────────────────────────────────────────────

class TreeNode:
    def __init__(self, struttura: dict):
        self.struttura = struttura
        self.children: list[TreeNode] = []
        self.dipendenti: list[dict] = []


# ── Build tree ────────────────────────────────────────────────────────────────

def _build_tree(strutture: list[dict], dipendenti: list[dict],
                search: str = "") -> list[TreeNode]:
    search_lower = search.lower()

    by_codice: dict[str, TreeNode] = {s["codice"]: TreeNode(s) for s in strutture}

    # Assegna dipendenti
    for d in dipendenti:
        cs = d.get("codice_struttura") or ""
        if cs in by_codice:
            by_codice[cs].dipendenti.append(d)

    # Costruisci gerarchia
    roots: list[TreeNode] = []
    for node in by_codice.values():
        padre = node.struttura.get("codice_padre")
        if padre and padre in by_codice:
            by_codice[padre].children.append(node)
        else:
            roots.append(node)

    # Ordina per codice
    def sort_node(n: TreeNode) -> None:
        n.children.sort(key=lambda x: x.struttura.get("codice", ""))
        n.dipendenti.sort(key=lambda x: x.get("titolare") or x.get("codice_fiscale") or "")
        for c in n.children:
            sort_node(c)

    roots.sort(key=lambda x: x.struttura.get("codice", ""))
    for r in roots:
        sort_node(r)

    # Filtra se c'è una ricerca
    if search:
        def node_matches(n: TreeNode) -> bool:
            s = n.struttura
            if (search_lower in (s.get("codice") or "").lower() or
                    search_lower in (s.get("descrizione") or "").lower() or
                    search_lower in (s.get("titolare") or "").lower()):
                return True
            for d in n.dipendenti:
                if (search_lower in (d.get("codice_fiscale") or "").lower() or
                        search_lower in (d.get("titolare") or "").lower()):
                    return True
            return any(node_matches(c) for c in n.children)

        def filter_tree(nodes: list[TreeNode]) -> list[TreeNode]:
            result = []
            for n in nodes:
                n.children = filter_tree(n.children)
                if node_matches(n):
                    result.append(n)
            return result

        roots = filter_tree(roots)

    return roots


# ── Dialogs ───────────────────────────────────────────────────────────────────

@st.dialog("📦 Sposta struttura", width="small")
def _dialog_sposta_struttura(codice: str, label: str, current_padre: str | None,
                              all_strutture: list[dict]) -> None:
    st.write(f"Struttura: **{label}** (`{codice}`)")
    st.write(f"Padre attuale: `{current_padre or '(radice)'}`")
    st.divider()

    options = ["(radice)"] + [
        f"{s['codice']} — {s.get('descrizione', '')}"
        for s in all_strutture
        if s["codice"] != codice  # non su se stesso
    ]
    choice = st.selectbox("Nuovo padre", options, key=f"sposta_str_{codice}")

    c1, c2 = st.columns(2)
    if c1.button("✅ Conferma spostamento", type="primary", key=f"conf_str_{codice}"):
        new_parent = None if choice == "(radice)" else choice.split(" — ")[0].strip()
        try:
            db.update_struttura_parent(codice, new_parent)
            st.toast(f"✅ Struttura '{codice}' spostata")
            st.rerun()
        except Exception as e:
            st.error(str(e))
    if c2.button("Annulla", key=f"ann_str_{codice}"):
        st.rerun()


@st.dialog("👤 Sposta dipendente", width="small")
def _dialog_sposta_dipendente(cf: str, nome: str, current_struttura: str,
                               all_strutture: list[dict]) -> None:
    st.write(f"Dipendente: **{nome}** (`{cf}`)")
    st.write(f"Struttura attuale: `{current_struttura or '(nessuna)'}`")
    st.divider()

    options = [
        f"{s['codice']} — {s.get('descrizione', '')}"
        for s in all_strutture
        if s["codice"] != current_struttura
    ]
    choice = st.selectbox("Nuova struttura", options, key=f"sposta_dip_{cf}")

    c1, c2 = st.columns(2)
    if c1.button("✅ Conferma spostamento", type="primary", key=f"conf_dip_{cf}"):
        new_struttura = choice.split(" — ")[0].strip()
        try:
            db.move_dipendente(cf, new_struttura)
            st.toast(f"✅ Dipendente spostato in '{new_struttura}'")
            st.rerun()
        except Exception as e:
            st.error(str(e))
    if c2.button("Annulla", key=f"ann_dip_{cf}"):
        st.rerun()


@st.dialog("✏️ Modifica struttura", width="large")
def _dialog_edit_struttura(struttura: dict) -> None:
    codice = struttura["codice"]
    editable_fields = ["descrizione", "cdc_costo", "titolare", "approvatore", "sede_tns",
                       "viaggiatore", "cassiere", "livello"]
    with st.form(f"edit_str_{codice}"):
        cols = st.columns(2)
        changes: dict = {}
        for i, field in enumerate(editable_fields):
            with cols[i % 2]:
                changes[field] = st.text_input(field, value=str(struttura.get(field) or ""), key=f"es_{codice}_{field}")
        if st.form_submit_button("💾 Salva", type="primary"):
            dirty = {k: v for k, v in changes.items() if str(struttura.get(k) or "") != str(v)}
            if dirty:
                db.update_struttura(codice, dirty)
                st.toast(f"✅ {codice} aggiornato")
                st.rerun()


@st.dialog("✏️ Modifica dipendente", width="large")
def _dialog_edit_dipendente(dipendente: dict) -> None:
    cf = dipendente["codice_fiscale"]
    editable_fields = ["titolare", "codice_struttura", "sede_tns", "approvatore",
                       "viaggiatore", "cassiere", "livello"]
    with st.form(f"edit_dip_{cf}"):
        cols = st.columns(2)
        changes: dict = {}
        for i, field in enumerate(editable_fields):
            with cols[i % 2]:
                changes[field] = st.text_input(field, value=str(dipendente.get(field) or ""), key=f"ed_{cf}_{field}")
        if st.form_submit_button("💾 Salva", type="primary"):
            dirty = {k: v for k, v in changes.items() if str(dipendente.get(k) or "") != str(v)}
            if dirty:
                db.update_dipendente(cf, dirty)
                st.toast(f"✅ {cf} aggiornato")
                st.rerun()


# ── Render ricorsivo ──────────────────────────────────────────────────────────

def _render_node(node: TreeNode, all_strutture: list[dict], compact: bool, depth: int = 0) -> None:
    s = node.struttura
    codice = s["codice"]
    label = f"`{codice}` — {s.get('descrizione', '')}" if not compact else f"`{codice}`"
    if s.get("titolare") and not compact:
        label += f" · {s['titolare']}"
    dip_count = len(node.dipendenti)
    child_count = len(node.children)
    badge = ""
    if dip_count:
        badge += f" 👤{dip_count}"
    if child_count:
        badge += f" 📂{child_count}"

    with st.expander(f"{'　' * depth}{label}{badge}", expanded=False):
        # Bottoni azione struttura
        bc1, bc2, bc3 = st.columns([1, 1, 4])
        if bc1.button("✏️", key=f"edit_str_{codice}", help="Modifica struttura"):
            _dialog_edit_struttura(s)
        if bc2.button("📦", key=f"sposta_str_{codice}", help="Sposta struttura"):
            _dialog_sposta_struttura(codice, s.get("descrizione") or codice,
                                     s.get("codice_padre"), all_strutture)

        # Dipendenti diretti
        if node.dipendenti:
            st.caption(f"**Dipendenti ({dip_count})**")
            for d in node.dipendenti:
                cf = d["codice_fiscale"]
                nome = d.get("titolare") or cf
                dc1, dc2, dc3 = st.columns([3, 1, 1])
                dc1.write(f"👤 {nome} · `{cf}`")
                if dc2.button("✏️", key=f"edit_dip_{cf}", help="Modifica dipendente"):
                    _dialog_edit_dipendente(d)
                if dc3.button("👤📦", key=f"sposta_dip_{cf}", help="Sposta dipendente"):
                    _dialog_sposta_dipendente(cf, nome, d.get("codice_struttura") or "", all_strutture)

        # Figlie ricorsive
        for child in node.children:
            _render_node(child, all_strutture, compact, depth + 1)


# ── Main render ───────────────────────────────────────────────────────────────

def render() -> None:
    col_search, col_sede, col_compact = st.columns([3, 2, 1])
    with col_search:
        search = st.text_input("🔍 Cerca struttura o dipendente", placeholder="Cerca...",
                               label_visibility="collapsed")
    with col_sede:
        sede = st.selectbox("Sede", ["Tutte", "Milano", "Roma", "Trento",
                                      "Venezia Marghera", "Palermo", "Genova"],
                            label_visibility="collapsed")
    with col_compact:
        compact = st.toggle("Compatto", value=False)

    strutture = db.fetch_strutture()
    dipendenti = db.fetch_dipendenti()

    # Filtra per sede
    if sede != "Tutte":
        strutture = [s for s in strutture if (s.get("sede_tns") or "").lower() == sede.lower()]
        dipendenti = [d for d in dipendenti if (d.get("sede_tns") or "").lower() == sede.lower()]

    roots = _build_tree(strutture, dipendenti, search)

    st.caption(f"📂 {len(strutture)} strutture · 👤 {len(dipendenti)} dipendenti  |  "
               f"📦 Usa il pulsante per spostare strutture o dipendenti")

    if not roots:
        st.info("Nessuna struttura trovata.")
        return

    for node in roots:
        _render_node(node, strutture, compact)

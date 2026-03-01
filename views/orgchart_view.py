"""
Organigramma View — streamlit-flow con tree layout.
Mostra la gerarchia strutture con pan/zoom.
Usa streamlit-flow-component==1.2.9 (API con StreamlitFlowState).
"""
from __future__ import annotations

import streamlit as st
from streamlit_flow import streamlit_flow
from streamlit_flow.elements import StreamlitFlowNode, StreamlitFlowEdge
from streamlit_flow.layouts import TreeLayout
from streamlit_flow.state import StreamlitFlowState

import db.connection as db

# Colori per sede_tns
SEDE_COLORS: dict[str, str] = {
    "milano":           "#4f46e5",
    "roma":             "#dc2626",
    "trento":           "#16a34a",
    "venezia marghera": "#ca8a04",
    "palermo":          "#9333ea",
    "genova":           "#0891b2",
}
DEFAULT_COLOR = "#64748b"


def render() -> None:
    col1, col2, col3 = st.columns([2, 2, 1])
    with col1:
        sede_filter = st.selectbox("Filtra per sede", ["Tutte", "Milano", "Roma", "Trento",
                                                        "Venezia Marghera", "Palermo", "Genova"],
                                   label_visibility="collapsed")
    with col2:
        color_by = st.selectbox("Colora per", ["sede_tns", "livello", "nessuno"],
                                label_visibility="collapsed")
    with col3:
        show_dip = st.toggle("Mostra dipendenti", value=False)

    strutture = db.fetch_strutture()
    dipendenti = db.fetch_dipendenti() if show_dip else []

    if sede_filter != "Tutte":
        strutture = [s for s in strutture if (s.get("sede_tns") or "").lower() == sede_filter.lower()]

    if not strutture:
        st.info("Nessuna struttura trovata.")
        return

    strutture_codici = {s["codice"] for s in strutture}

    # Costruisci nodi
    nodes: list[StreamlitFlowNode] = []
    for s in strutture:
        codice = s["codice"]
        label = f"{codice}\n{s.get('descrizione', '') or ''}"
        if show_dip:
            n_dip = sum(1 for d in dipendenti if d.get("codice_struttura") == codice)
            if n_dip:
                label += f"\n👤 {n_dip}"

        # Colore
        if color_by == "sede_tns":
            color = SEDE_COLORS.get((s.get("sede_tns") or "").lower(), DEFAULT_COLOR)
        elif color_by == "livello":
            lvl = int(s.get("livello") or 0)
            palette = ["#4f46e5", "#7c3aed", "#db2777", "#dc2626", "#ea580c", "#ca8a04"]
            color = palette[min(lvl, len(palette) - 1)] if lvl else DEFAULT_COLOR
        else:
            color = DEFAULT_COLOR

        nodes.append(StreamlitFlowNode(
            id=codice,
            pos=(0, 0),
            data={"label": label},
            node_type="default",
            style={"backgroundColor": color, "color": "white",
                   "borderRadius": "6px", "padding": "6px 10px",
                   "fontSize": "11px", "whiteSpace": "pre-line",
                   "minWidth": "120px", "textAlign": "center"},
        ))

    # Costruisci archi (solo verso strutture presenti nel filtro)
    edges: list[StreamlitFlowEdge] = []
    for s in strutture:
        padre = s.get("codice_padre")
        if padre and padre in strutture_codici:
            edges.append(StreamlitFlowEdge(
                id=f"{padre}->{s['codice']}",
                source=padre,
                target=s["codice"],
                animated=False,
                edge_type="smoothstep",
            ))

    st.caption(f"🌳 {len(nodes)} strutture · {len(edges)} relazioni  |  Usa la rotella del mouse per zoom")

    # Cache key che cambia quando cambiano filtri → forza reinizializzazione del grafo
    flow_key = f"orgchart_flow_{sede_filter}_{color_by}_{show_dip}"

    state = StreamlitFlowState(nodes=nodes, edges=edges)
    streamlit_flow(
        key=flow_key,
        state=state,
        layout=TreeLayout(direction="down"),
        fit_view=True,
        height=600,
        show_minimap=True,
        show_controls=True,
        pan_on_drag=True,
    )

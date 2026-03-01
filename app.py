"""
TNS OrgPlus Manager — Streamlit Web App
Entry point: navigazione a tab tra le 5 viste principali.
"""
import streamlit as st

st.set_page_config(
    page_title="TNS OrgPlus Manager",
    page_icon="🏢",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ── CSS globale ───────────────────────────────────────────────────────────────
st.markdown("""
<style>
  /* Riduce il padding top della pagina */
  .block-container { padding-top: 1rem; }
  /* Tab bar più compatta */
  .stTabs [data-baseweb="tab-list"] { gap: 4px; }
  .stTabs [data-baseweb="tab"] { padding: 6px 16px; font-size: 0.9rem; }
</style>
""", unsafe_allow_html=True)

# ── Import viste (lazy per velocità startup) ──────────────────────────────────
from views.grid_view        import render as render_grid
from views.accordion_view   import render as render_accordion
from views.orgchart_view    import render as render_orgchart
from views.storico_view     import render as render_storico
from views.importexport_view import render as render_importexport

# ── Navigazione ───────────────────────────────────────────────────────────────
st.title("🏢 TNS OrgPlus Manager")

tab_grid, tab_accordion, tab_orgchart, tab_storico, tab_importexport = st.tabs([
    "📊 Grid",
    "🪗 Accordion",
    "🌳 Organigramma",
    "📋 Storico",
    "📥 Import / Export",
])

with tab_grid:
    render_grid()

with tab_accordion:
    render_accordion()

with tab_orgchart:
    render_orgchart()

with tab_storico:
    render_storico()

with tab_importexport:
    render_importexport()

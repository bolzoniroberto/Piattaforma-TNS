# TNS OrgPlus Manager — Streamlit Web App

Web app per la gestione dell'organigramma TNS, con feature parity rispetto all'app Electron desktop.

## Stack

- **Frontend**: Streamlit 1.35+
- **Grid**: streamlit-aggrid (AG Grid 32.x)
- **Organigramma**: streamlit-flow (React Flow)
- **Database**: Supabase (PostgreSQL free tier)
- **Deploy**: Streamlit Community Cloud

## Setup locale

### 1. Installa dipendenze

```bash
pip install -r requirements.txt
```

### 2. Configura Supabase

Crea il file `.streamlit/secrets.toml` (NON committare):

```toml
[connections.supabase]
url = "https://YOUR_PROJECT.supabase.co"
key = "YOUR_ANON_KEY"
```

### 3. Crea lo schema nel tuo progetto Supabase

Esegui il file `db/migrations/001_initial_schema.sql` nel **SQL Editor** di Supabase.

### 4. Migra i dati da SQLite (una volta sola)

```bash
python db/seed_from_sqlite.py
```

Per simulare senza scrivere:
```bash
python db/seed_from_sqlite.py --dry-run
```

### 5. Avvia l'app

```bash
streamlit run app.py
```

## Deploy su Streamlit Community Cloud

1. Pusha il repo su GitHub (assicurati che `.streamlit/secrets.toml` sia nel `.gitignore`)
2. Vai su [share.streamlit.io](https://share.streamlit.io) → "New app"
3. Seleziona il repo e `app.py` come entry point
4. In **Advanced settings → Secrets**, incolla:
   ```toml
   [connections.supabase]
   url = "https://YOUR_PROJECT.supabase.co"
   key = "YOUR_ANON_KEY"
   ```
5. Deploy!

## Struttura

```
masterdata/
├── app.py                         # Entry point
├── requirements.txt
├── db/
│   ├── connection.py              # Helpers Supabase (CRUD, log)
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── seed_from_sqlite.py        # Migrazione da orgplus.db
└── views/
    ├── grid_view.py               # Grid con editing inline
    ├── accordion_view.py          # Gerarchia con spostamento
    ├── orgchart_view.py           # Organigramma interattivo
    ├── storico_view.py            # Storico modifiche
    └── importexport_view.py       # Import/Export XLS
```

## Feature

| Feature | Status |
|---|---|
| Grid editabile con floating filters | ✅ |
| Selezione multipla + bulk edit | ✅ |
| Tab Orfani Dipendenti/Strutture | ✅ |
| Tab Strutture Vuote (ricorsivo) | ✅ |
| Accordion gerarchico ricorsivo | ✅ |
| Sposta struttura/dipendente (modale) | ✅ |
| Organigramma interattivo pan/zoom | ✅ |
| Storico modifiche | ✅ |
| Import XLS (foglio DB_TNS) | ✅ |
| Export XLS | ✅ |
| Deploy Streamlit Cloud + Supabase | ✅ |

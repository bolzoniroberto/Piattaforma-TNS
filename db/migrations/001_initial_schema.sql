-- ============================================================
-- TNS OrgPlus Manager — Schema PostgreSQL (Supabase)
-- Run this in the Supabase SQL editor once before first use
-- ============================================================

-- Strutture (organizational units)
CREATE TABLE IF NOT EXISTS strutture (
  id                    SERIAL,
  codice                TEXT PRIMARY KEY,
  codice_padre          TEXT REFERENCES strutture(codice) ON DELETE SET NULL,
  descrizione           TEXT,
  cdc_costo             TEXT,
  titolare              TEXT,
  livello               TEXT,
  unita_organizzativa   TEXT,
  approvatore           TEXT,
  viaggiatore           TEXT,
  cassiere              TEXT,
  segr_red_assistita    TEXT,
  segretario_assistito  TEXT,
  controllore_assistito TEXT,
  ruoli_afc             TEXT,
  ruoli_hr              TEXT,
  altri_ruoli           TEXT,
  ruoli                 TEXT,
  ruoli_oltre_v         TEXT,
  segr_redaz            TEXT,
  segretario            TEXT,
  controllore           TEXT,
  amministrazione       TEXT,
  visualizzatori        TEXT,
  sede_tns              TEXT,
  gruppo_sind           TEXT,
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at            TIMESTAMP WITH TIME ZONE
);

-- Dipendenti (employees)
CREATE TABLE IF NOT EXISTS dipendenti (
  id                    SERIAL,
  codice_fiscale        TEXT PRIMARY KEY,
  codice_nel_file       TEXT,
  codice_struttura      TEXT REFERENCES strutture(codice) ON DELETE SET NULL,
  titolare              TEXT,
  unita_organizzativa   TEXT,
  cdc_costo             TEXT,
  cdc_costo_is_numeric  INTEGER DEFAULT 0,
  livello               TEXT,
  approvatore           TEXT,
  viaggiatore           TEXT,
  cassiere              TEXT,
  segr_red_assistita    TEXT,
  segretario_assistito  TEXT,
  controllore_assistito TEXT,
  ruoli_afc             TEXT,
  ruoli_hr              TEXT,
  altri_ruoli           TEXT,
  ruoli                 TEXT,
  ruoli_oltre_v         TEXT,
  segr_redaz            TEXT,
  segretario            TEXT,
  controllore           TEXT,
  amministrazione       TEXT,
  visualizzatori        TEXT,
  sede_tns              TEXT,
  gruppo_sind           TEXT,
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at            TIMESTAMP WITH TIME ZONE
);

-- Change log (audit trail)
CREATE TABLE IF NOT EXISTS change_log (
  id           SERIAL PRIMARY KEY,
  timestamp    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  entity_type  TEXT CHECK (entity_type IN ('struttura', 'dipendente')),
  entity_id    TEXT NOT NULL,
  entity_label TEXT,
  action       TEXT CHECK (action IN ('create', 'update', 'delete', 'restore')),
  field_name   TEXT,
  old_value    TEXT,
  new_value    TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_strutture_codice_padre ON strutture(codice_padre);
CREATE INDEX IF NOT EXISTS idx_strutture_sede_tns     ON strutture(sede_tns);
CREATE INDEX IF NOT EXISTS idx_strutture_deleted_at   ON strutture(deleted_at);
CREATE INDEX IF NOT EXISTS idx_dipendenti_struttura   ON dipendenti(codice_struttura);
CREATE INDEX IF NOT EXISTS idx_dipendenti_sede_tns    ON dipendenti(sede_tns);
CREATE INDEX IF NOT EXISTS idx_dipendenti_deleted_at  ON dipendenti(deleted_at);
CREATE INDEX IF NOT EXISTS idx_change_log_timestamp   ON change_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_change_log_entity      ON change_log(entity_type, entity_id);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER strutture_updated_at
  BEFORE UPDATE ON strutture
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER dipendenti_updated_at
  BEFORE UPDATE ON dipendenti
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.')
  }
  return db
}

export function initDb(): Database.Database {
  if (db) return db

  const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), 'orgplus.db')
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  console.log('[DB] Opening database at:', dbPath)

  db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL')

  createSchema(db)

  console.log('[DB] Schema ready')
  return db
}

function createSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS strutture (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      codice                TEXT NOT NULL UNIQUE,
      codice_padre          TEXT,
      descrizione           TEXT NOT NULL DEFAULT '',
      cdc_costo             TEXT,
      titolare              TEXT,
      livello               TEXT,
      unita_organizzativa   TEXT,
      ruoli_oltre_v         TEXT,
      ruoli                 TEXT,
      viaggiatore           TEXT,
      segr_redaz            TEXT,
      approvatore           TEXT,
      cassiere              TEXT,
      visualizzatori        TEXT,
      segretario            TEXT,
      controllore           TEXT,
      amministrazione       TEXT,
      segr_red_assistita    TEXT,
      segretario_assistito  TEXT,
      controllore_assistito TEXT,
      ruoli_afc             TEXT,
      ruoli_hr              TEXT,
      altri_ruoli           TEXT,
      sede_tns              TEXT,
      gruppo_sind           TEXT,
      created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at            DATETIME
    );

    CREATE TABLE IF NOT EXISTS dipendenti (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      codice_fiscale        TEXT NOT NULL UNIQUE,
      codice_nel_file       TEXT,
      unita_organizzativa   TEXT,
      cdc_costo             TEXT,
      cdc_costo_is_numeric  INTEGER DEFAULT 0,
      titolare              TEXT,
      codice_struttura      TEXT NOT NULL DEFAULT '',
      livello               TEXT,
      ruoli_oltre_v         TEXT,
      ruoli                 TEXT,
      viaggiatore           TEXT,
      segr_redaz            TEXT,
      approvatore           TEXT,
      cassiere              TEXT,
      visualizzatori        TEXT,
      segretario            TEXT,
      controllore           TEXT,
      amministrazione       TEXT,
      segr_red_assistita    TEXT,
      segretario_assistito  TEXT,
      controllore_assistito TEXT,
      ruoli_afc             TEXT,
      ruoli_hr              TEXT,
      altri_ruoli           TEXT,
      sede_tns              TEXT,
      gruppo_sind           TEXT,
      created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at            DATETIME
    );

    CREATE TABLE IF NOT EXISTS change_log (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp    DATETIME DEFAULT CURRENT_TIMESTAMP,
      entity_type  TEXT NOT NULL,
      entity_id    TEXT NOT NULL,
      entity_label TEXT,
      action       TEXT NOT NULL,
      field_name   TEXT,
      old_value    TEXT,
      new_value    TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_strutture_padre ON strutture(codice_padre);
    CREATE INDEX IF NOT EXISTS idx_strutture_deleted ON strutture(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_dipendenti_struttura ON dipendenti(codice_struttura);
    CREATE INDEX IF NOT EXISTS idx_dipendenti_deleted ON dipendenti(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_changelog_timestamp ON change_log(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_changelog_entity ON change_log(entity_type, entity_id);
  `)
}

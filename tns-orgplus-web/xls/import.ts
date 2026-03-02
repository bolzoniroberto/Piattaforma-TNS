import * as XLSX from 'xlsx'
import { db, writeChangeLog } from '../lib/db'

export interface ImportReport {
  inserted: number
  updated: number
  unchanged: number
  errors: string[]
}

type RawRow = Record<string, unknown>

function isDipendente(row: RawRow): boolean {
  const cf = String(row['TxCodFiscale'] ?? '').trim()
  return cf.length === 16
}

interface NormalizedCdc {
  value: string
  isNumeric: boolean
}

function normalizeCdc(raw: unknown): NormalizedCdc {
  if (raw === null || raw === undefined || raw === '') {
    return { value: '', isNumeric: false }
  }
  if (typeof raw === 'number') {
    return { value: String(Math.round(raw)), isNumeric: true }
  }
  return { value: String(raw).trim(), isNumeric: false }
}

function toStr(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null
  const s = String(val).trim()
  return s === '' ? null : s
}

export function importXlsBuffer(buffer: Buffer): ImportReport {
  const d = db()
  const report: ImportReport = { inserted: 0, updated: 0, unchanged: 0, errors: [] }

  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', raw: false })
  } catch (e) {
    report.errors.push(`Impossibile leggere il file: ${e}`)
    return report
  }

  const sheetName = workbook.SheetNames.find(
    (n) => n.trim().toUpperCase() === 'DB_TNS'
  )
  if (!sheetName) {
    report.errors.push('Sheet DB_TNS non trovato nel file')
    return report
  }

  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<RawRow>(sheet, {
    defval: '',
    raw: true
  })

  if (rows.length === 0) {
    report.errors.push('Sheet DB_TNS vuoto')
    return report
  }

  const insertStruttura = d.prepare(`
    INSERT INTO strutture (
      codice, codice_padre, descrizione, cdc_costo, titolare, livello,
      unita_organizzativa, ruoli_oltre_v, ruoli, viaggiatore, segr_redaz,
      approvatore, cassiere, visualizzatori, segretario, controllore,
      amministrazione, segr_red_assistita, segretario_assistito,
      controllore_assistito, ruoli_afc, ruoli_hr, altri_ruoli, sede_tns, gruppo_sind
    ) VALUES (
      @codice, @codice_padre, @descrizione, @cdc_costo, @titolare, @livello,
      @unita_organizzativa, @ruoli_oltre_v, @ruoli, @viaggiatore, @segr_redaz,
      @approvatore, @cassiere, @visualizzatori, @segretario, @controllore,
      @amministrazione, @segr_red_assistita, @segretario_assistito,
      @controllore_assistito, @ruoli_afc, @ruoli_hr, @altri_ruoli, @sede_tns, @gruppo_sind
    )
  `)

  const updateStruttura = d.prepare(`
    UPDATE strutture SET
      codice_padre = @codice_padre,
      descrizione = @descrizione,
      cdc_costo = @cdc_costo,
      titolare = @titolare,
      livello = @livello,
      unita_organizzativa = @unita_organizzativa,
      ruoli_oltre_v = @ruoli_oltre_v,
      ruoli = @ruoli,
      viaggiatore = @viaggiatore,
      segr_redaz = @segr_redaz,
      approvatore = @approvatore,
      cassiere = @cassiere,
      visualizzatori = @visualizzatori,
      segretario = @segretario,
      controllore = @controllore,
      amministrazione = @amministrazione,
      segr_red_assistita = @segr_red_assistita,
      segretario_assistito = @segretario_assistito,
      controllore_assistito = @controllore_assistito,
      ruoli_afc = @ruoli_afc,
      ruoli_hr = @ruoli_hr,
      altri_ruoli = @altri_ruoli,
      sede_tns = @sede_tns,
      gruppo_sind = @gruppo_sind,
      updated_at = CURRENT_TIMESTAMP,
      deleted_at = NULL
    WHERE codice = @codice
  `)

  const insertDipendente = d.prepare(`
    INSERT INTO dipendenti (
      codice_fiscale, codice_nel_file, unita_organizzativa, cdc_costo, cdc_costo_is_numeric,
      titolare, codice_struttura, livello, ruoli_oltre_v, ruoli, viaggiatore, segr_redaz,
      approvatore, cassiere, visualizzatori, segretario, controllore, amministrazione,
      segr_red_assistita, segretario_assistito, controllore_assistito,
      ruoli_afc, ruoli_hr, altri_ruoli, sede_tns, gruppo_sind
    ) VALUES (
      @codice_fiscale, @codice_nel_file, @unita_organizzativa, @cdc_costo, @cdc_costo_is_numeric,
      @titolare, @codice_struttura, @livello, @ruoli_oltre_v, @ruoli, @viaggiatore, @segr_redaz,
      @approvatore, @cassiere, @visualizzatori, @segretario, @controllore, @amministrazione,
      @segr_red_assistita, @segretario_assistito, @controllore_assistito,
      @ruoli_afc, @ruoli_hr, @altri_ruoli, @sede_tns, @gruppo_sind
    )
  `)

  const updateDipendente = d.prepare(`
    UPDATE dipendenti SET
      codice_nel_file = @codice_nel_file,
      unita_organizzativa = @unita_organizzativa,
      cdc_costo = @cdc_costo,
      cdc_costo_is_numeric = @cdc_costo_is_numeric,
      titolare = @titolare,
      codice_struttura = @codice_struttura,
      livello = @livello,
      ruoli_oltre_v = @ruoli_oltre_v,
      ruoli = @ruoli,
      viaggiatore = @viaggiatore,
      segr_redaz = @segr_redaz,
      approvatore = @approvatore,
      cassiere = @cassiere,
      visualizzatori = @visualizzatori,
      segretario = @segretario,
      controllore = @controllore,
      amministrazione = @amministrazione,
      segr_red_assistita = @segr_red_assistita,
      segretario_assistito = @segretario_assistito,
      controllore_assistito = @controllore_assistito,
      ruoli_afc = @ruoli_afc,
      ruoli_hr = @ruoli_hr,
      altri_ruoli = @altri_ruoli,
      sede_tns = @sede_tns,
      gruppo_sind = @gruppo_sind,
      updated_at = CURRENT_TIMESTAMP,
      deleted_at = NULL
    WHERE codice_fiscale = @codice_fiscale
  `)

  const existsStruttura = d.prepare('SELECT codice FROM strutture WHERE codice = ?')
  const existsDipendente = d.prepare('SELECT codice_fiscale FROM dipendenti WHERE codice_fiscale = ?')

  const runImport = d.transaction(() => {
    let struttureSeen = 0
    let dipendentiSeen = 0

    for (const row of rows) {
      if (isDipendente(row)) {
        dipendentiSeen++
        const cf = String(row['TxCodFiscale']).trim()
        const codiceNelFile = toStr(row['Codice'])
        const codicePadre = toStr(row["UNITA' OPERATIVA PADRE "])
        const { value: cdcVal, isNumeric } = normalizeCdc(row['CDCCOSTO'])

        const data = {
          codice_fiscale: cf,
          codice_nel_file: codiceNelFile,
          unita_organizzativa: toStr(row['Unità Organizzativa']),
          cdc_costo: cdcVal || null,
          cdc_costo_is_numeric: isNumeric ? 1 : 0,
          titolare: toStr(row['Titolare']),
          codice_struttura: codicePadre ?? '',
          livello: toStr(row['LIVELLO']),
          ruoli_oltre_v: toStr(row['RUOLI OltreV']),
          ruoli: toStr(row['RUOLI']),
          viaggiatore: toStr(row['Viaggiatore']),
          segr_redaz: toStr(row['Segr_Redaz']),
          approvatore: toStr(row['Approvatore']),
          cassiere: toStr(row['Cassiere']),
          visualizzatori: toStr(row['Visualizzatori']),
          segretario: toStr(row['Segretario']),
          controllore: toStr(row['Controllore']),
          amministrazione: toStr(row['Amministrazione']),
          segr_red_assistita: toStr(row['SegreteriA Red. Ass.ta']),
          segretario_assistito: toStr(row['SegretariO Ass.to']),
          controllore_assistito: toStr(row['Controllore Ass.to']),
          ruoli_afc: toStr(row['RuoliAFC']),
          ruoli_hr: toStr(row['RuoliHR']),
          altri_ruoli: toStr(row['AltriRuoli']),
          sede_tns: toStr(row['Sede_TNS']),
          gruppo_sind: toStr(row['GruppoSind'])
        }

        const existing = existsDipendente.get(cf)
        if (existing) {
          updateDipendente.run(data)
          report.updated++
        } else {
          insertDipendente.run(data)
          report.inserted++
        }
      } else {
        struttureSeen++
        const codice = toStr(row['Codice'])
        if (!codice) {
          report.errors.push(`Struttura senza codice alla riga ${struttureSeen + dipendentiSeen}`)
          continue
        }

        const data = {
          codice,
          codice_padre: toStr(row["UNITA' OPERATIVA PADRE "]),
          descrizione: toStr(row['DESCRIZIONE']) ?? '',
          cdc_costo: toStr(row['CDCCOSTO']),
          titolare: toStr(row['Titolare']),
          livello: toStr(row['LIVELLO']),
          unita_organizzativa: toStr(row['Unità Organizzativa']),
          ruoli_oltre_v: toStr(row['RUOLI OltreV']),
          ruoli: toStr(row['RUOLI']),
          viaggiatore: toStr(row['Viaggiatore']),
          segr_redaz: toStr(row['Segr_Redaz']),
          approvatore: toStr(row['Approvatore']),
          cassiere: toStr(row['Cassiere']),
          visualizzatori: toStr(row['Visualizzatori']),
          segretario: toStr(row['Segretario']),
          controllore: toStr(row['Controllore']),
          amministrazione: toStr(row['Amministrazione']),
          segr_red_assistita: toStr(row['SegreteriA Red. Ass.ta']),
          segretario_assistito: toStr(row['SegretariO Ass.to']),
          controllore_assistito: toStr(row['Controllore Ass.to']),
          ruoli_afc: toStr(row['RuoliAFC']),
          ruoli_hr: toStr(row['RuoliHR']),
          altri_ruoli: toStr(row['AltriRuoli']),
          sede_tns: toStr(row['Sede_TNS']),
          gruppo_sind: toStr(row['GruppoSind'])
        }

        const existing = existsStruttura.get(codice)
        if (existing) {
          updateStruttura.run(data)
          report.updated++
        } else {
          insertStruttura.run(data)
          report.inserted++
        }
      }
    }
  })

  try {
    runImport()
  } catch (e) {
    report.errors.push(`Errore durante import: ${e}`)
    return report
  }

  writeChangeLog(
    'system', 'import', null, 'IMPORT', null, null,
    `${report.inserted} inseriti, ${report.updated} aggiornati, ${report.unchanged} invariati`
  )

  return report
}

export function importXlsFile(filePath: string): ImportReport {
  const fs = require('fs') as typeof import('fs')
  const buffer = fs.readFileSync(filePath)
  return importXlsBuffer(buffer)
}

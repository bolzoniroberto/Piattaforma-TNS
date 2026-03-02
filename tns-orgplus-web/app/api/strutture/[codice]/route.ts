import { NextRequest, NextResponse } from 'next/server'
import { db, writeChangeLog } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ codice: string }> }) {
  const { codice } = await params
  const struttura = db()
    .prepare(`
      SELECT s.*,
        (SELECT COUNT(*) FROM dipendenti d WHERE d.codice_struttura = s.codice AND d.deleted_at IS NULL) as dipendenti_count
      FROM strutture s
      WHERE s.codice = ?
    `)
    .get(codice)
  if (!struttura) return NextResponse.json(null, { status: 404 })
  return NextResponse.json(struttura)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ codice: string }> }) {
  const { codice } = await params
  const data = await req.json() as Record<string, unknown>
  const current = db().prepare('SELECT * FROM strutture WHERE codice = ?').get(codice) as Record<string, unknown>
  if (!current) return NextResponse.json({ success: false, error: 'NOT_FOUND' }, { status: 404 })

  const updateFields = [
    'codice_padre', 'descrizione', 'cdc_costo', 'titolare', 'livello',
    'unita_organizzativa', 'ruoli_oltre_v', 'ruoli', 'viaggiatore', 'segr_redaz',
    'approvatore', 'cassiere', 'visualizzatori', 'segretario', 'controllore',
    'amministrazione', 'segr_red_assistita', 'segretario_assistito',
    'controllore_assistito', 'ruoli_afc', 'ruoli_hr', 'altri_ruoli', 'sede_tns', 'gruppo_sind'
  ]

  const merged: Record<string, unknown> = { codice }
  for (const field of updateFields) {
    merged[field] = field in data ? (data[field] ?? null) : (current[field] ?? null)
  }

  db().prepare(`
    UPDATE strutture SET
      ${updateFields.map((f) => `${f} = @${f}`).join(',\n      ')},
      updated_at = CURRENT_TIMESTAMP
    WHERE codice = @codice
  `).run(merged)

  for (const field of updateFields) {
    const oldVal = current[field] !== undefined ? String(current[field]) : null
    const newVal = data[field] !== undefined && data[field] !== null ? String(data[field]) : null
    if (oldVal !== newVal) {
      writeChangeLog('struttura', codice, (current.descrizione as string) ?? codice, 'UPDATE', field, oldVal, newVal)
    }
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ codice: string }> }) {
  const { codice } = await params
  const figli = (db().prepare('SELECT COUNT(*) as n FROM strutture WHERE codice_padre = ? AND deleted_at IS NULL').get(codice) as { n: number }).n
  if (figli > 0) {
    return NextResponse.json({
      success: false, error: 'STRUTTURA_HAS_CHILDREN',
      message: `Impossibile eliminare: ${figli} struttur${figli === 1 ? 'a figlia attiva' : 'e figlie attive'}. Spostale prima.`
    }, { status: 409 })
  }

  const dipendenti = (db().prepare('SELECT COUNT(*) as n FROM dipendenti WHERE codice_struttura = ? AND deleted_at IS NULL').get(codice) as { n: number }).n
  if (dipendenti > 0) {
    return NextResponse.json({
      success: false, error: 'STRUTTURA_HAS_EMPLOYEES',
      message: `Impossibile eliminare: ${dipendenti} dipendent${dipendenti === 1 ? 'e assegnato' : 'i assegnati'}. Spostali prima.`
    }, { status: 409 })
  }

  const struttura = db().prepare('SELECT descrizione FROM strutture WHERE codice = ?').get(codice) as { descrizione: string }
  db().prepare('UPDATE strutture SET deleted_at = CURRENT_TIMESTAMP WHERE codice = ?').run(codice)
  writeChangeLog('struttura', codice, struttura?.descrizione ?? codice, 'DELETE', null, null, null)
  return NextResponse.json({ success: true })
}

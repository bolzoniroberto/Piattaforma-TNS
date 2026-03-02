import { NextRequest, NextResponse } from 'next/server'
import { db, writeChangeLog } from '@/lib/db'

export async function GET(req: NextRequest) {
  const showDeleted = req.nextUrl.searchParams.get('showDeleted') === 'true'
  const where = showDeleted ? '' : 'WHERE deleted_at IS NULL'
  const strutture = db()
    .prepare(`
      SELECT s.*,
        (SELECT COUNT(*) FROM dipendenti d WHERE d.codice_struttura = s.codice AND d.deleted_at IS NULL) as dipendenti_count
      FROM strutture s
      ${where}
      ORDER BY s.codice ASC
    `)
    .all()
  return NextResponse.json(strutture)
}

export async function POST(req: NextRequest) {
  const data = await req.json() as Record<string, unknown>
  const existing = db().prepare('SELECT codice FROM strutture WHERE codice = ?').get(data.codice)
  if (existing) {
    return NextResponse.json({ success: false, error: 'DUPLICATE_CODICE', message: `Il codice "${data.codice}" è già in uso` }, { status: 409 })
  }

  db().prepare(`
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
  `).run(data)

  writeChangeLog('struttura', String(data.codice), data.descrizione as string, 'CREATE', null, null, null)
  return NextResponse.json({ success: true })
}

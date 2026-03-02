import { NextRequest, NextResponse } from 'next/server'
import { db, writeChangeLog } from '@/lib/db'

export async function GET(req: NextRequest) {
  const showDeleted = req.nextUrl.searchParams.get('showDeleted') === 'true'
  const where = showDeleted ? '' : 'WHERE deleted_at IS NULL'
  const dipendenti = db().prepare(`SELECT * FROM dipendenti ${where} ORDER BY titolare ASC`).all()
  return NextResponse.json(dipendenti)
}

export async function POST(req: NextRequest) {
  const data = await req.json() as Record<string, unknown>
  const existing = db().prepare('SELECT codice_fiscale FROM dipendenti WHERE codice_fiscale = ?').get(data.codice_fiscale)
  if (existing) {
    return NextResponse.json({ success: false, error: 'DUPLICATE_CF', message: `Il codice fiscale "${data.codice_fiscale}" è già in uso` }, { status: 409 })
  }

  db().prepare(`
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
  `).run(data)

  writeChangeLog('dipendente', String(data.codice_fiscale), data.titolare as string, 'CREATE', null, null, null)
  return NextResponse.json({ success: true })
}

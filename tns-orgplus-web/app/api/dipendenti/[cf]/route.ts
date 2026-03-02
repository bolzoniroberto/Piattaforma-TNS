import { NextRequest, NextResponse } from 'next/server'
import { db, writeChangeLog } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ cf: string }> }) {
  const { cf } = await params
  const dip = db().prepare('SELECT * FROM dipendenti WHERE codice_fiscale = ?').get(cf)
  if (!dip) return NextResponse.json(null, { status: 404 })
  return NextResponse.json(dip)
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ cf: string }> }) {
  const { cf } = await params
  const data = await req.json() as Record<string, unknown>
  const current = db().prepare('SELECT * FROM dipendenti WHERE codice_fiscale = ?').get(cf) as Record<string, unknown>
  if (!current) return NextResponse.json({ success: false, error: 'NOT_FOUND' }, { status: 404 })

  const updateFields = [
    'codice_nel_file', 'unita_organizzativa', 'cdc_costo', 'cdc_costo_is_numeric',
    'titolare', 'codice_struttura', 'livello', 'ruoli_oltre_v', 'ruoli', 'viaggiatore',
    'segr_redaz', 'approvatore', 'cassiere', 'visualizzatori', 'segretario', 'controllore',
    'amministrazione', 'segr_red_assistita', 'segretario_assistito', 'controllore_assistito',
    'ruoli_afc', 'ruoli_hr', 'altri_ruoli', 'sede_tns', 'gruppo_sind'
  ]

  const merged: Record<string, unknown> = { codice_fiscale: cf }
  for (const field of updateFields) {
    merged[field] = field in data ? (data[field] ?? null) : (current[field] ?? null)
  }

  db().prepare(`
    UPDATE dipendenti SET
      ${updateFields.map((f) => `${f} = @${f}`).join(',\n      ')},
      updated_at = CURRENT_TIMESTAMP
    WHERE codice_fiscale = @codice_fiscale
  `).run(merged)

  for (const field of updateFields) {
    const oldVal = current[field] !== undefined && current[field] !== null ? String(current[field]) : null
    const newVal = data[field] !== undefined && data[field] !== null ? String(data[field]) : null
    if (oldVal !== newVal) {
      writeChangeLog('dipendente', cf, (current.titolare as string) ?? cf, 'UPDATE', field, oldVal, newVal)
    }
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ cf: string }> }) {
  const { cf } = await params
  const dip = db().prepare('SELECT titolare FROM dipendenti WHERE codice_fiscale = ?').get(cf) as { titolare: string }
  db().prepare('UPDATE dipendenti SET deleted_at = CURRENT_TIMESTAMP WHERE codice_fiscale = ?').run(cf)
  writeChangeLog('dipendente', cf, dip?.titolare ?? cf, 'DELETE', null, null, null)
  return NextResponse.json({ success: true })
}

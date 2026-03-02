import { NextRequest, NextResponse } from 'next/server'
import { db, writeChangeLog } from '@/lib/db'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ cf: string }> }) {
  const { cf } = await params
  const dip = db().prepare('SELECT titolare, deleted_at FROM dipendenti WHERE codice_fiscale = ?').get(cf) as { titolare: string; deleted_at: string | null }
  if (!dip) return NextResponse.json({ success: false, message: 'Dipendente non trovato' }, { status: 404 })
  if (!dip.deleted_at) return NextResponse.json({ success: false, message: 'Il dipendente deve essere eliminato (soft delete) prima' }, { status: 400 })
  db().prepare('DELETE FROM dipendenti WHERE codice_fiscale = ?').run(cf)
  writeChangeLog('dipendente', cf, dip?.titolare ?? cf, 'DELETE', 'hard_delete', null, 'PERMANENT')
  return NextResponse.json({ success: true })
}

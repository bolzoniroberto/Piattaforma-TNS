import { NextRequest, NextResponse } from 'next/server'
import { db, writeChangeLog } from '@/lib/db'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ cf: string }> }) {
  const { cf } = await params
  db().prepare('UPDATE dipendenti SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE codice_fiscale = ?').run(cf)
  const dip = db().prepare('SELECT titolare FROM dipendenti WHERE codice_fiscale = ?').get(cf) as { titolare: string }
  writeChangeLog('dipendente', cf, dip?.titolare ?? cf, 'RESTORE', null, null, null)
  return NextResponse.json({ success: true })
}

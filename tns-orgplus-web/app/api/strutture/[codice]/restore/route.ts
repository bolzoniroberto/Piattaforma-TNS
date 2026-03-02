import { NextRequest, NextResponse } from 'next/server'
import { db, writeChangeLog } from '@/lib/db'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ codice: string }> }) {
  const { codice } = await params
  db().prepare('UPDATE strutture SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE codice = ?').run(codice)
  const struttura = db().prepare('SELECT descrizione FROM strutture WHERE codice = ?').get(codice) as { descrizione: string }
  writeChangeLog('struttura', codice, struttura?.descrizione ?? codice, 'RESTORE', null, null, null)
  return NextResponse.json({ success: true })
}

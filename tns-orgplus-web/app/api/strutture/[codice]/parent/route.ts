import { NextRequest, NextResponse } from 'next/server'
import { db, writeChangeLog } from '@/lib/db'

export async function POST(req: NextRequest, { params }: { params: Promise<{ codice: string }> }) {
  const { codice } = await params
  const { newCodiceParent } = await req.json() as { newCodiceParent: string | null }

  const current = db().prepare('SELECT * FROM strutture WHERE codice = ?').get(codice) as Record<string, unknown>
  if (!current) return NextResponse.json({ success: false, error: 'NOT_FOUND', message: 'Struttura non trovata' }, { status: 404 })

  if (current.codice_padre === newCodiceParent) return NextResponse.json({ success: true })

  if (newCodiceParent) {
    const cycleCheck = db().prepare(`
      WITH RECURSIVE descendants(c) AS (
        SELECT ?1
        UNION ALL
        SELECT s.codice FROM strutture s
        INNER JOIN descendants d ON s.codice_padre = d.c
        WHERE s.deleted_at IS NULL
      )
      SELECT COUNT(*) as n FROM descendants WHERE c = ?2
    `).get(codice, newCodiceParent) as { n: number }

    if (cycleCheck.n > 0) {
      return NextResponse.json({ success: false, error: 'CYCLE_DETECTED', message: 'Non puoi impostare un figlio come padre' }, { status: 400 })
    }

    const parentExists = db().prepare('SELECT codice FROM strutture WHERE codice = ? AND deleted_at IS NULL').get(newCodiceParent)
    if (!parentExists) {
      return NextResponse.json({ success: false, error: 'PARENT_NOT_FOUND', message: 'Struttura padre non trovata o eliminata' }, { status: 404 })
    }
  }

  const oldParent = current.codice_padre as string | null
  db().prepare('UPDATE strutture SET codice_padre = ?, updated_at = CURRENT_TIMESTAMP WHERE codice = ?').run(newCodiceParent, codice)
  writeChangeLog('struttura', codice, current.descrizione as string, 'UPDATE', 'codice_padre', oldParent ?? null, newCodiceParent ?? null)

  return NextResponse.json({ success: true })
}

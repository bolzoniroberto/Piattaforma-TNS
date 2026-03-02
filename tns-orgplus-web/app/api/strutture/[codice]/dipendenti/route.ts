import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ codice: string }> }) {
  const { codice } = await params
  const dipendenti = db()
    .prepare('SELECT * FROM dipendenti WHERE codice_struttura = ? AND deleted_at IS NULL ORDER BY titolare ASC')
    .all(codice)
  return NextResponse.json(dipendenti)
}

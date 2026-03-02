import { NextRequest, NextResponse } from 'next/server'
import { db, suggestCodice } from '@/lib/db'

export async function GET(req: NextRequest) {
  const codicePadre = req.nextUrl.searchParams.get('codicePadre') ?? ''
  const fratelli = (
    db().prepare('SELECT codice FROM strutture WHERE codice_padre = ? AND deleted_at IS NULL').all(codicePadre) as { codice: string }[]
  ).map((r) => r.codice)
  return NextResponse.json({ codice: suggestCodice(codicePadre, fratelli) })
}

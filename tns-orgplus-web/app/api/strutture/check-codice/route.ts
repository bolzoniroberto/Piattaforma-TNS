import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const codice = req.nextUrl.searchParams.get('codice') ?? ''
  const existing = db().prepare('SELECT codice FROM strutture WHERE codice = ?').get(codice)
  return NextResponse.json({ available: !existing })
}

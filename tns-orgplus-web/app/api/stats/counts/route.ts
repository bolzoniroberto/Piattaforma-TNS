import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const strutture = (db().prepare('SELECT COUNT(*) as n FROM strutture WHERE deleted_at IS NULL').get() as { n: number }).n
  const dipendenti = (db().prepare('SELECT COUNT(*) as n FROM dipendenti WHERE deleted_at IS NULL').get() as { n: number }).n
  return NextResponse.json({ strutture, dipendenti, db_tns: strutture + dipendenti })
}

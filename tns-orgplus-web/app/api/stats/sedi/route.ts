import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const sedi = new Set<string>()
  ;(db().prepare('SELECT DISTINCT sede_tns FROM strutture WHERE deleted_at IS NULL AND sede_tns IS NOT NULL').all() as { sede_tns: string }[])
    .forEach((r) => sedi.add(r.sede_tns.toLowerCase()))
  ;(db().prepare('SELECT DISTINCT sede_tns FROM dipendenti WHERE deleted_at IS NULL AND sede_tns IS NOT NULL').all() as { sede_tns: string }[])
    .forEach((r) => sedi.add(r.sede_tns.toLowerCase()))
  return NextResponse.json(Array.from(sedi).sort())
}

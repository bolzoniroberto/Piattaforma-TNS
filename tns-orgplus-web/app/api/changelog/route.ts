import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const search = p.get('search')
  const entityType = p.get('entityType')
  const action = p.get('action')
  const dateFrom = p.get('dateFrom')
  const dateTo = p.get('dateTo')
  const limit = parseInt(p.get('limit') ?? '200')
  const offset = parseInt(p.get('offset') ?? '0')

  const conditions: string[] = []
  const params: unknown[] = []

  if (search) {
    conditions.push('(entity_label LIKE ? OR entity_id LIKE ? OR new_value LIKE ?)')
    const s = `%${search}%`
    params.push(s, s, s)
  }
  if (entityType) {
    conditions.push('entity_type = ?')
    params.push(entityType)
  }
  if (action) {
    conditions.push('action = ?')
    params.push(action)
  }
  if (dateFrom) {
    conditions.push('timestamp >= ?')
    params.push(dateFrom)
  }
  if (dateTo) {
    conditions.push('timestamp <= ?')
    params.push(dateTo)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = db()
    .prepare(`SELECT * FROM change_log ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`)
    .all([...params, limit, offset])

  return NextResponse.json(rows)
}

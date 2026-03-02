import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  const rows = db().prepare('SELECT * FROM change_log ORDER BY timestamp DESC').all() as Record<string, unknown>[]

  const header = 'id,timestamp,entity_type,entity_id,entity_label,action,field_name,old_value,new_value\n'
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csvRows = rows.map((r) =>
    [r.id, r.timestamp, r.entity_type, r.entity_id, r.entity_label, r.action, r.field_name, r.old_value, r.new_value]
      .map(esc)
      .join(',')
  )

  const csv = header + csvRows.join('\n')
  const now = new Date()
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="storico_${dateStr}.csv"`
    }
  })
}

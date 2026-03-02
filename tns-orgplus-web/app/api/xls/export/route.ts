import { NextResponse } from 'next/server'
import { exportXlsBuffer } from '@/xls/export'

export async function GET() {
  const now = new Date()
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const filename = `TNS_ORG_${dateStr}.xls`

  try {
    const buffer = exportXlsBuffer(filename)
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.ms-excel',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length)
      }
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

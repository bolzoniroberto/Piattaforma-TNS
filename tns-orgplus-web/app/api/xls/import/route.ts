import { NextRequest, NextResponse } from 'next/server'
import { importXlsBuffer } from '@/xls/import'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  try {
    const report = importXlsBuffer(buffer)
    return NextResponse.json(report)
  } catch (e) {
    return NextResponse.json({ inserted: 0, updated: 0, unchanged: 0, errors: [String(e)] })
  }
}

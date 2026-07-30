import { NextResponse } from 'next/server'
import { getModelDetailData } from '@/lib/data'
import type { TimeRange } from '@/lib/types'

const VALID: TimeRange[] = ['1h', '24h', '7d', '30d']

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: raw } = await params
  const id = decodeURIComponent(raw)
  const { searchParams } = new URL(request.url)
  const rangeParam = (searchParams.get('range') || '24h') as TimeRange
  const range = VALID.includes(rangeParam) ? rangeParam : '24h'
  const { model, source } = await getModelDetailData(id, range)
  if (!model) {
    return NextResponse.json({ error: 'Model not found' }, { status: 404 })
  }
  return NextResponse.json({ model, source })
}

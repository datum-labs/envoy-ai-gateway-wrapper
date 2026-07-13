import { NextResponse } from 'next/server'
import { getModelDetailData } from '@/lib/data'
import type { TimeRange } from '@/lib/types'

const VALID: TimeRange[] = ['1h', '24h', '7d', '30d']

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)
  const raw = (searchParams.get('range') || '24h') as TimeRange
  const range = VALID.includes(raw) ? raw : '24h'
  const { model } = await getModelDetailData(id, range)
  if (!model) {
    return NextResponse.json({ error: 'Model not found' }, { status: 404 })
  }
  return NextResponse.json({ model })
}

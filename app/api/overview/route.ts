import { NextResponse } from 'next/server'
import { getOverviewData } from '@/lib/data'
import type { TimeRange } from '@/lib/types'

const VALID: TimeRange[] = ['1h', '24h', '7d', '30d']

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const raw = (searchParams.get('range') || '24h') as TimeRange
  const range = VALID.includes(raw) ? raw : '24h'
  return NextResponse.json(await getOverviewData(range))
}

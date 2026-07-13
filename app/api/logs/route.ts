import { NextResponse } from 'next/server'
import { getLogs } from '@/lib/gateway'
import type { TimeRange } from '@/lib/types'

const VALID: TimeRange[] = ['1h', '24h', '7d', '30d']

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const raw = (searchParams.get('range') || '24h') as TimeRange
  const range = VALID.includes(raw) ? raw : '24h'
  const page = Math.max(1, Number(searchParams.get('page') || '1'))
  const pageSize = Math.min(100, Math.max(5, Number(searchParams.get('pageSize') || '20')))

  const res = await getLogs({
    range,
    page,
    pageSize,
    model: searchParams.get('model') || undefined,
    provider: searchParams.get('provider') || undefined,
    status: searchParams.get('status') || undefined,
    search: searchParams.get('search') || undefined,
  })
  return NextResponse.json(res)
}

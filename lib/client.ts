import type { TimeRange } from './types'

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

export const apiUrl = (path: string) =>
  path.startsWith('/') ? `${BASE_PATH}${path}` : path

export const fetcher = async (url: string) => {
  const res = await fetch(apiUrl(url))
  if (!res.ok) throw new Error('Request failed')
  return res.json()
}

export const RANGES: { value: TimeRange; label: string }[] = [
  { value: '1h', label: 'Last hour' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
]

export const RANGE_SHORT: Record<TimeRange, string> = {
  '1h': '1H',
  '24h': '24H',
  '7d': '7D',
  '30d': '30D',
}

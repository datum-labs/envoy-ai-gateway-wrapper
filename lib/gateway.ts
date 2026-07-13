import 'server-only'
import { readFileSync } from 'fs'
import { computeModelDetail, computeModels, computeOverview } from './aggregate'
import { getDataset, MODEL_CATALOG } from './demo'
import { parsePrometheus } from './prometheus'
import type {
  DataSourceInfo,
  LogEntry,
  LogsResponse,
  ModelDetail,
  ModelStat,
  Overview,
  TimeRange,
} from './types'

const GATEWAY_URL = process.env.ENVOY_AI_GATEWAY_URL?.replace(/\/$/, '') || null
const GATEWAY_API_KEY = process.env.ENVOY_AI_GATEWAY_API_KEY || null
const GATEWAY_TOKEN_FILE = process.env.ENVOY_AI_GATEWAY_TOKEN_FILE || null
const METRICS_URL = process.env.ENVOY_AI_GATEWAY_METRICS_URL?.replace(/\/$/, '') || null

export function dataSource(): DataSourceInfo {
  return { mode: GATEWAY_URL ? 'live' : 'demo', gatewayUrl: GATEWAY_URL }
}

function authHeaders(): Record<string, string> {
  let token = GATEWAY_API_KEY
  if (GATEWAY_TOKEN_FILE) {
    try { token = readFileSync(GATEWAY_TOKEN_FILE, 'utf-8').trim() } catch { token = null }
  }
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/**
 * Best-effort scrape of the gateway's Prometheus metrics endpoint.
 * Returns parsed samples, or null when unavailable (falls back to demo data).
 */
export async function scrapeMetrics() {
  const url = METRICS_URL || (GATEWAY_URL ? `${GATEWAY_URL}/metrics` : null)
  if (!url) return null
  try {
    const res = await fetch(url, { headers: authHeaders(), cache: 'no-store' })
    if (!res.ok) return null
    return parsePrometheus(await res.text())
  } catch {
    return null
  }
}

export async function getOverview(range: TimeRange): Promise<Overview> {
  const { logs, now } = getDataset()
  return computeOverview(logs, now, range)
}

export async function getModels(range: TimeRange): Promise<ModelStat[]> {
  const { logs, now } = getDataset()
  return computeModels(logs, now, range)
}

export async function getModelDetail(id: string, range: TimeRange): Promise<ModelDetail | null> {
  const { logs, now } = getDataset()
  return computeModelDetail(id, logs, now, range)
}

export interface LogsQuery {
  range: TimeRange
  page: number
  pageSize: number
  model?: string
  provider?: string
  status?: string
  search?: string
}

export async function getLogs(q: LogsQuery): Promise<LogsResponse> {
  const { logs, now } = getDataset()
  const from = now - rangeMs(q.range)
  let filtered = logs.filter((l) => l.timestamp >= from)

  if (q.model && q.model !== 'all') filtered = filtered.filter((l) => l.model === q.model)
  if (q.provider && q.provider !== 'all') filtered = filtered.filter((l) => l.provider === q.provider)
  if (q.status && q.status !== 'all') filtered = filtered.filter((l) => l.status === q.status)
  if (q.search) {
    const s = q.search.toLowerCase()
    filtered = filtered.filter(
      (l) =>
        l.requestId.toLowerCase().includes(s) ||
        l.id.toLowerCase().includes(s) ||
        l.model.toLowerCase().includes(s) ||
        l.endpoint.toLowerCase().includes(s),
    )
  }

  const total = filtered.length
  const start = (q.page - 1) * q.pageSize
  const paged = filtered.slice(start, start + q.pageSize)
  return { logs: paged, total, page: q.page, pageSize: q.pageSize }
}

export function getModelCatalog() {
  return MODEL_CATALOG.map((m) => ({ id: m.id, name: m.name, provider: m.provider }))
}

export function getProviders() {
  return Array.from(new Set(MODEL_CATALOG.map((m) => m.provider)))
}

function rangeMs(range: TimeRange): number {
  const table: Record<TimeRange, number> = {
    '1h': 3600_000,
    '24h': 86_400_000,
    '7d': 604_800_000,
    '30d': 2_592_000_000,
  }
  return table[range]
}

export type { LogEntry }

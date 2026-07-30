import 'server-only'
import {
  gatewayAuthHeaders,
  getAiGatewayUrl,
  isAiGatewayConfigured,
} from './ai-gateway'
import { parsePrometheus } from './prometheus'
import type { DataSourceInfo, LogEntry, LogsResponse, TimeRange } from './types'

const METRICS_URL = process.env.ENVOY_AI_GATEWAY_METRICS_URL?.replace(/\/$/, '') || null

export function dataSource(metrics: DataSourceInfo['metrics'] = 'unavailable'): DataSourceInfo {
  const gatewayUrl = getAiGatewayUrl()
  if (!isAiGatewayConfigured()) {
    return { mode: 'unconfigured', metrics: 'unavailable', gatewayUrl }
  }
  return { mode: 'live', metrics, gatewayUrl }
}

/**
 * Best-effort scrape of the gateway's Prometheus metrics endpoint.
 * Returns parsed samples, or null when unavailable.
 */
export async function scrapeMetrics() {
  const gatewayUrl = getAiGatewayUrl()
  const url = METRICS_URL || (gatewayUrl ? `${gatewayUrl}/metrics` : null)
  if (!url) return null
  try {
    const res = await fetch(url, { headers: gatewayAuthHeaders(), cache: 'no-store' })
    if (!res.ok) return null
    return parsePrometheus(await res.text())
  } catch {
    return null
  }
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
  // Per-request logs are not available yet (needs Loki/OTLP access-log wiring).
  return { logs: [], total: 0, page: q.page, pageSize: q.pageSize }
}

export type { LogEntry }

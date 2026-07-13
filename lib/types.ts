export type TimeRange = '1h' | '24h' | '7d' | '30d'

export type LogStatus = 'success' | 'error'

export interface TimeseriesPoint {
  ts: number // epoch ms (bucket start)
  label: string // human readable bucket label
  requests: number
  errors: number
  inputTokens: number
  outputTokens: number
  cost: number
  latencyP50: number
  latencyP95: number
}

export interface OverviewTotals {
  requests: number
  errors: number
  errorRate: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cost: number
  avgLatency: number
  p95Latency: number
  avgTtft: number
  tokensPerSec: number
}

export interface OverviewDelta {
  requests: number
  cost: number
  errorRate: number
  latency: number
}

export interface Overview {
  range: TimeRange
  totals: OverviewTotals
  deltas: OverviewDelta
  series: TimeseriesPoint[]
  topModels: ModelStat[]
  statusBreakdown: { name: string; value: number }[]
}

export interface ModelStat {
  id: string
  name: string
  provider: string
  requests: number
  totalTokens: number
  inputTokens: number
  outputTokens: number
  cost: number
  avgLatency: number
  p95Latency: number
  avgTtft: number
  errorRate: number
  tokensPerSec: number
  trendPct: number
  contextWindow: number
  inputPricePerM: number
  outputPricePerM: number
}

export interface ModelDetail extends ModelStat {
  series: TimeseriesPoint[]
  latencyBuckets: { bucket: string; count: number }[]
  recentLogs: LogEntry[]
}

export interface LogEntry {
  id: string
  requestId: string
  timestamp: number
  model: string
  provider: string
  endpoint: string
  status: LogStatus
  statusCode: number
  latencyMs: number
  ttftMs: number
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cost: number
  region: string
  finishReason: string
  errorMessage?: string
}

export interface LogsResponse {
  logs: LogEntry[]
  total: number
  page: number
  pageSize: number
}

export interface DataSourceInfo {
  mode: 'live' | 'demo'
  gatewayUrl: string | null
}

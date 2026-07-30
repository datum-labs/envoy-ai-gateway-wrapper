import 'server-only'
import { RANGE_MS } from './time-range'
import {
  fetchGatewayModels,
  gatewayAuthHeaders,
  getAiGatewayUrl,
  isAiGatewayConfigured,
} from './ai-gateway'
import { parsePrometheus, type PromSample } from './prometheus'
import type {
  ModelDetail,
  ModelStat,
  Overview,
  TimeRange,
  TimeseriesPoint,
} from './types'

const METRICS_URL = process.env.ENVOY_AI_GATEWAY_METRICS_URL?.replace(/\/$/, '') || null

/** Histogram count metric names observed across Envoy AI Gateway versions. */
const REQUEST_COUNT_METRICS = [
  'gen_ai_server_request_duration_seconds_count',
  'gen_ai_server_request_duration_count',
]

const REQUEST_SUM_METRICS = [
  'gen_ai_server_request_duration_seconds_sum',
  'gen_ai_server_request_duration_sum',
]

const TTFT_SUM_METRICS = [
  'gen_ai_server_time_to_first_token_seconds_sum',
  'gen_ai_server_time_to_first_token_sum',
]

const TTFT_COUNT_METRICS = [
  'gen_ai_server_time_to_first_token_seconds_count',
  'gen_ai_server_time_to_first_token_count',
]

const TOKEN_SUM_METRICS = [
  'gen_ai_client_token_usage_token_sum',
  'gen_ai_client_token_usage_sum',
]

const TOKEN_COUNT_METRICS = [
  'gen_ai_client_token_usage_token_count',
  'gen_ai_client_token_usage_count',
]

type PromInstantResult = {
  metric: Record<string, string>
  value: [number, string]
}

type PromRangeResult = {
  metric: Record<string, string>
  values: Array<[number, string]>
}

function rangeWindow(range: TimeRange): string {
  return range
}

function rangeStep(range: TimeRange): string {
  const table: Record<TimeRange, string> = {
    '1h': '5m',
    '24h': '1h',
    '7d': '6h',
    '30d': '1d',
  }
  return table[range]
}

function orName(names: string[]): string {
  return names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
}

function modelLabel(metric: Record<string, string>): string {
  return (
    metric.gen_ai_request_model ||
    metric.gen_ai_response_model ||
    metric.gen_ai_original_model ||
    'unknown'
  )
}

function providerLabel(metric: Record<string, string>, modelId: string): string {
  const raw = metric.gen_ai_provider_name || metric.gen_ai_system || ''
  if (raw) return raw.charAt(0).toUpperCase() + raw.slice(1)
  const lower = modelId.toLowerCase()
  if (lower.includes('claude')) return 'Anthropic'
  if (lower.includes('gpt') || /^o[1-9]/.test(lower)) return 'OpenAI'
  if (lower.includes('gemini')) return 'Google'
  if (lower.includes('llama')) return 'Meta'
  if (lower.includes('mistral')) return 'Mistral'
  if (lower.includes('deepseek')) return 'DeepSeek'
  if (lower.includes('qwen')) return 'Qwen'
  return 'Gateway'
}

function humanizeModelId(id: string): string {
  return id
    .replace(/^claude-/, 'Claude ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

type ModelAccum = {
  provider: string
  requests: number
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  cacheWriteTokens: number
  latencySumSec: number
  latencyCount: number
  ttftSumSec: number
  ttftCount: number
}

function emptyAccum(provider: string): ModelAccum {
  return {
    provider,
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    cachedInputTokens: 0,
    cacheWriteTokens: 0,
    latencySumSec: 0,
    latencyCount: 0,
    ttftSumSec: 0,
    ttftCount: 0,
  }
}

function applyTokenType(row: ModelAccum, kind: string, n: number) {
  switch (kind) {
    case 'input':
      row.inputTokens += n
      break
    case 'output':
      row.outputTokens += n
      break
    case 'cached_input':
    case 'cache_read':
      row.cachedInputTokens += n
      break
    case 'cache_creation_input':
    case 'cache_write':
      row.cacheWriteTokens += n
      break
    default:
      break
  }
}

function toModelStat(id: string, row: ModelAccum): ModelStat {
  const requests = Math.round(row.requests)
  const inputTokens = Math.round(row.inputTokens)
  const outputTokens = Math.round(row.outputTokens)
  const cachedInputTokens = Math.round(row.cachedInputTokens)
  const cacheWriteTokens = Math.round(row.cacheWriteTokens)
  const avgLatency =
    row.latencyCount > 0 ? Math.round((row.latencySumSec / row.latencyCount) * 1000) : 0
  const avgTtft = row.ttftCount > 0 ? Math.round((row.ttftSumSec / row.ttftCount) * 1000) : 0
  const tokensPerSec =
    row.latencySumSec > 0 ? Math.round(outputTokens / row.latencySumSec) : 0
  return {
    id,
    name: humanizeModelId(id),
    provider: row.provider,
    requests,
    totalTokens: inputTokens + outputTokens + cachedInputTokens + cacheWriteTokens,
    inputTokens,
    outputTokens,
    // Spend comes from the gateway when pricing is exposed; metrics alone have no $.
    cost: 0,
    avgLatency,
    p95Latency: avgLatency,
    avgTtft,
    errorRate: 0,
    tokensPerSec,
    trendPct: 0,
    contextWindow: 0,
    inputPricePerM: 0,
    outputPricePerM: 0,
  }
}

function metricsBaseUrl(): string | null {
  if (METRICS_URL) return METRICS_URL
  const gateway = getAiGatewayUrl()
  return gateway ? `${gateway}/metrics` : null
}

async function promQuery(base: string, query: string): Promise<PromInstantResult[]> {
  const url = new URL(base.includes('/api/v1/query') ? base : `${base.replace(/\/$/, '')}/api/v1/query`)
  // If base already ends with /metrics, PromQL won't work against it.
  if (base.endsWith('/metrics')) return []
  url.searchParams.set('query', query)
  const res = await fetch(url, { headers: { ...gatewayAuthHeaders(), Accept: 'application/json' }, cache: 'no-store' })
  if (!res.ok) return []
  const json = (await res.json()) as { status?: string; data?: { result?: PromInstantResult[] } }
  if (json.status !== 'success') return []
  return json.data?.result ?? []
}

async function promQueryRange(
  base: string,
  query: string,
  range: TimeRange,
): Promise<PromRangeResult[]> {
  if (base.endsWith('/metrics')) return []
  const end = Math.floor(Date.now() / 1000)
  const start = end - Math.floor(RANGE_MS[range] / 1000)
  const url = new URL(`${base.replace(/\/$/, '')}/api/v1/query_range`)
  url.searchParams.set('query', query)
  url.searchParams.set('start', String(start))
  url.searchParams.set('end', String(end))
  url.searchParams.set('step', rangeStep(range))
  const res = await fetch(url, { headers: { ...gatewayAuthHeaders(), Accept: 'application/json' }, cache: 'no-store' })
  if (!res.ok) return []
  const json = (await res.json()) as { status?: string; data?: { result?: PromRangeResult[] } }
  if (json.status !== 'success') return []
  return json.data?.result ?? []
}

function sumInstant(results: PromInstantResult[]): number {
  return results.reduce((s, r) => s + (Number(r.value[1]) || 0), 0)
}

function formatLabel(ts: number, range: TimeRange): string {
  const d = new Date(ts)
  if (range === '1h' || range === '24h') {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function emptySeries(range: TimeRange): TimeseriesPoint[] {
  const now = Date.now()
  const size =
    range === '1h' ? 5 * 60_000 : range === '24h' ? 60 * 60_000 : range === '7d' ? 6 * 60 * 60_000 : 24 * 60 * 60_000
  const count = range === '1h' ? 12 : range === '24h' ? 24 : range === '7d' ? 28 : 30
  const end = Math.ceil(now / size) * size
  const start = end - size * count
  const points: TimeseriesPoint[] = []
  for (let i = 0; i < count; i++) {
    const ts = start + i * size
    points.push({
      ts,
      label: formatLabel(ts, range),
      requests: 0,
      errors: 0,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      latencyP50: 0,
      latencyP95: 0,
    })
  }
  return points
}

/**
 * Raw /metrics scrapes only expose cumulative counters (no history).
 * Put lifetime totals in the newest bucket so charts aren't an empty flat line.
 * Prefer a PromQL backend for real time-range series.
 */
function seriesFromCumulative(
  range: TimeRange,
  totals: {
    requests: number
    errors?: number
    inputTokens: number
    outputTokens: number
    cost?: number
    avgLatency: number
    p95Latency: number
  },
): TimeseriesPoint[] {
  const series = emptySeries(range)
  const last = series[series.length - 1]
  if (!last) return series
  last.requests = totals.requests
  last.errors = totals.errors ?? 0
  last.inputTokens = totals.inputTokens
  last.outputTokens = totals.outputTokens
  last.cost = totals.cost ?? 0
  last.latencyP50 = totals.avgLatency
  last.latencyP95 = totals.p95Latency
  return series
}

function emptyOverview(range: TimeRange): Overview {
  return {
    range,
    totals: {
      requests: 0,
      errors: 0,
      errorRate: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      cost: 0,
      avgLatency: 0,
      p95Latency: 0,
      avgTtft: 0,
      tokensPerSec: 0,
    },
    deltas: { requests: 0, cost: 0, errorRate: 0, latency: 0 },
    series: emptySeries(range),
    topModels: [],
    statusBreakdown: [
      { name: '2xx', value: 0 },
      { name: '4xx', value: 0 },
      { name: '5xx', value: 0 },
    ],
  }
}

async function buildModelsFromPromql(base: string, range: TimeRange): Promise<ModelStat[]> {
  const win = rangeWindow(range)
  const reqByModel = await promQuery(
    base,
    `sum by (gen_ai_request_model, gen_ai_provider_name) (increase({__name__=~"${orName(REQUEST_COUNT_METRICS)}"}[${win}]))`,
  )
  const tokenByModel = await promQuery(
    base,
    `sum by (gen_ai_request_model, gen_ai_token_type, gen_ai_provider_name) (increase({__name__=~"${orName(TOKEN_SUM_METRICS)}"}[${win}]))`,
  )
  const latencySum = await promQuery(
    base,
    `sum by (gen_ai_request_model) (increase({__name__=~"${orName(REQUEST_SUM_METRICS)}"}[${win}]))`,
  )
  const latencyCount = await promQuery(
    base,
    `sum by (gen_ai_request_model) (increase({__name__=~"${orName(REQUEST_COUNT_METRICS)}"}[${win}]))`,
  )
  const ttftSum = await promQuery(
    base,
    `sum by (gen_ai_request_model) (increase({__name__=~"${orName(TTFT_SUM_METRICS)}"}[${win}]))`,
  )
  const ttftCount = await promQuery(
    base,
    `sum by (gen_ai_request_model) (increase({__name__=~"${orName(TTFT_COUNT_METRICS)}"}[${win}]))`,
  )

  const byId = new Map<string, ModelAccum>()

  const ensure = (id: string, provider: string) => {
    let row = byId.get(id)
    if (!row) {
      row = emptyAccum(provider)
      byId.set(id, row)
    }
    return row
  }

  for (const r of reqByModel) {
    const id = modelLabel(r.metric)
    if (id === 'unknown') continue
    const row = ensure(id, providerLabel(r.metric, id))
    row.requests += Number(r.value[1]) || 0
  }
  for (const r of tokenByModel) {
    const id = modelLabel(r.metric)
    if (id === 'unknown') continue
    const row = ensure(id, providerLabel(r.metric, id))
    const n = Number(r.value[1]) || 0
    const kind = (r.metric.gen_ai_token_type || '').toLowerCase()
    applyTokenType(row, kind, n)
  }
  // If only "total" token series exist, fold them in when input+output are both 0.
  for (const r of tokenByModel) {
    const id = modelLabel(r.metric)
    if (id === 'unknown') continue
    const row = byId.get(id)
    if (!row) continue
    if (row.inputTokens + row.outputTokens > 0) continue
    if ((r.metric.gen_ai_token_type || '').toLowerCase() === 'total') {
      row.inputTokens += Number(r.value[1]) || 0
    }
  }
  for (const r of latencySum) {
    const id = modelLabel(r.metric)
    const row = byId.get(id)
    if (row) row.latencySumSec += Number(r.value[1]) || 0
  }
  for (const r of latencyCount) {
    const id = modelLabel(r.metric)
    const row = byId.get(id)
    if (row) row.latencyCount += Number(r.value[1]) || 0
  }
  for (const r of ttftSum) {
    const id = modelLabel(r.metric)
    const row = byId.get(id)
    if (row) row.ttftSumSec += Number(r.value[1]) || 0
  }
  for (const r of ttftCount) {
    const id = modelLabel(r.metric)
    const row = byId.get(id)
    if (row) row.ttftCount += Number(r.value[1]) || 0
  }

  // Merge gateway catalog models with zero traffic so the Models page stays complete.
  if (isAiGatewayConfigured()) {
    try {
      const catalog = await fetchGatewayModels()
      for (const m of catalog) ensure(m.id, m.provider)
    } catch {
      // ignore catalog merge failures
    }
  }

  const models: ModelStat[] = [...byId.entries()]
    .map(([id, row]) => toModelStat(id, row))
    .sort((a, b) => b.requests - a.requests)

  return models
}

async function buildSeriesFromPromql(base: string, range: TimeRange): Promise<TimeseriesPoint[]> {
  const reqSeries = await promQueryRange(
    base,
    `sum(rate({__name__=~"${orName(REQUEST_COUNT_METRICS)}"}[${rangeStep(range)}]))`,
    range,
  )
  const inTok = await promQueryRange(
    base,
    `sum(rate({__name__=~"${orName(TOKEN_SUM_METRICS)}",gen_ai_token_type="input"}[${rangeStep(range)}]))`,
    range,
  )
  const outTok = await promQueryRange(
    base,
    `sum(rate({__name__=~"${orName(TOKEN_SUM_METRICS)}",gen_ai_token_type="output"}[${rangeStep(range)}]))`,
    range,
  )
  const latAvg = await promQueryRange(
    base,
    `sum(rate({__name__=~"${orName(REQUEST_SUM_METRICS)}"}[${rangeStep(range)}])) / sum(rate({__name__=~"${orName(REQUEST_COUNT_METRICS)}"}[${rangeStep(range)}]))`,
    range,
  )

  const byTs = new Map<number, TimeseriesPoint>()
  const ensure = (tsSec: number) => {
    const ts = tsSec * 1000
    let p = byTs.get(ts)
    if (!p) {
      p = {
        ts,
        label: formatLabel(ts, range),
        requests: 0,
        errors: 0,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        latencyP50: 0,
        latencyP95: 0,
      }
      byTs.set(ts, p)
    }
    return p
  }

  const stepSec =
    range === '1h' ? 300 : range === '24h' ? 3600 : range === '7d' ? 21600 : 86400

  for (const series of reqSeries) {
    for (const [t, v] of series.values) {
      const p = ensure(t)
      p.requests += Math.round((Number(v) || 0) * stepSec)
    }
  }
  for (const series of inTok) {
    for (const [t, v] of series.values) {
      const p = ensure(t)
      p.inputTokens += Math.round((Number(v) || 0) * stepSec)
    }
  }
  for (const series of outTok) {
    for (const [t, v] of series.values) {
      const p = ensure(t)
      p.outputTokens += Math.round((Number(v) || 0) * stepSec)
    }
  }
  for (const series of latAvg) {
    for (const [t, v] of series.values) {
      const p = ensure(t)
      const ms = Math.round((Number(v) || 0) * 1000)
      p.latencyP50 = ms
      p.latencyP95 = ms
    }
  }

  const points = [...byTs.values()].sort((a, b) => a.ts - b.ts)
  return points.length > 0 ? points : emptySeries(range)
}

function scrapeHasGenAi(samples: PromSample[]): boolean {
  return samples.some((s) => s.name.startsWith('gen_ai_'))
}

function buildFromScrape(samples: PromSample[], range: TimeRange): { overview: Overview; models: ModelStat[] } {
  // Cumulative counters only — no real time window when scraping /metrics.
  const byId = new Map<string, ModelAccum>()

  const ensure = (id: string, provider: string) => {
    let row = byId.get(id)
    if (!row) {
      row = emptyAccum(provider)
      byId.set(id, row)
    }
    return row
  }

  for (const s of samples) {
    const id = modelLabel(s.labels)
    if (id === 'unknown') continue
    const row = ensure(id, providerLabel(s.labels, id))
    if (REQUEST_COUNT_METRICS.includes(s.name)) row.requests += s.value
    if (REQUEST_SUM_METRICS.includes(s.name)) row.latencySumSec += s.value
    if (TTFT_SUM_METRICS.includes(s.name)) row.ttftSumSec += s.value
    if (TTFT_COUNT_METRICS.includes(s.name)) row.ttftCount += s.value
    if (TOKEN_SUM_METRICS.includes(s.name)) {
      applyTokenType(row, (s.labels.gen_ai_token_type || '').toLowerCase(), s.value)
    }
  }

  // Prefer duration_count for request totals when present; else use token counts.
  const hasDurationCounts = samples.some((s) => REQUEST_COUNT_METRICS.includes(s.name))
  if (!hasDurationCounts) {
    for (const s of samples) {
      if (!TOKEN_COUNT_METRICS.includes(s.name)) continue
      const id = modelLabel(s.labels)
      if (id === 'unknown') continue
      const row = ensure(id, providerLabel(s.labels, id))
      if ((s.labels.gen_ai_token_type || '').toLowerCase() === 'output') row.requests += s.value
    }
  }

  for (const s of samples) {
    if (!REQUEST_COUNT_METRICS.includes(s.name)) continue
    const id = modelLabel(s.labels)
    const row = byId.get(id)
    if (row) row.latencyCount += s.value
  }

  const models: ModelStat[] = [...byId.entries()]
    .map(([id, row]) => toModelStat(id, row))
    .sort((a, b) => b.requests - a.requests)

  const requests = models.reduce((s, m) => s + m.requests, 0)
  const inputTokens = models.reduce((s, m) => s + m.inputTokens, 0)
  const outputTokens = models.reduce((s, m) => s + m.outputTokens, 0)
  const cost = models.reduce((s, m) => s + m.cost, 0)
  const weightedLatency = models.reduce((s, m) => s + m.avgLatency * m.requests, 0)
  const weightedTtft = models.reduce((s, m) => s + m.avgTtft * m.requests, 0)
  const avgLatency = requests ? Math.round(weightedLatency / requests) : 0
  const p95Latency = avgLatency

  const overview: Overview = {
    range,
    totals: {
      requests,
      errors: 0,
      errorRate: 0,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      cost,
      avgLatency,
      p95Latency,
      avgTtft: requests ? Math.round(weightedTtft / requests) : 0,
      tokensPerSec: models.reduce((s, m) => s + m.tokensPerSec, 0),
    },
    deltas: { requests: 0, cost: 0, errorRate: 0, latency: 0 },
    series: seriesFromCumulative(range, {
      requests,
      inputTokens,
      outputTokens,
      cost,
      avgLatency,
      p95Latency,
    }),
    topModels: models.slice(0, 5),
    statusBreakdown: [
      { name: '2xx', value: requests },
      { name: '4xx', value: 0 },
      { name: '5xx', value: 0 },
    ],
  }

  return { overview, models }
}

async function tryPromql(base: string, range: TimeRange) {
  const models = await buildModelsFromPromql(base, range)
  const series = await buildSeriesFromPromql(base, range)
  const probe = await promQuery(
    base,
    `sum(increase({__name__=~"${orName(REQUEST_COUNT_METRICS)}"}[${rangeWindow(range)}]))`,
  )
  const tokenProbe = await promQuery(
    base,
    `sum(increase({__name__=~"${orName(TOKEN_SUM_METRICS)}"}[${rangeWindow(range)}]))`,
  )
  const up = await promQuery(base, 'up')
  const hasTraffic =
    models.some((m) => m.requests > 0) || sumInstant(probe) > 0 || sumInstant(tokenProbe) > 0

  // Unreachable PromQL endpoint — let caller try scrape / fall back.
  if (!hasTraffic && up.length === 0) return null

  const requests = models.reduce((s, m) => s + m.requests, 0)
  const inputTokens = models.reduce((s, m) => s + m.inputTokens, 0)
  const outputTokens = models.reduce((s, m) => s + m.outputTokens, 0)
  const cost = models.reduce((s, m) => s + m.cost, 0)
  const weightedLatency = models.reduce((s, m) => s + m.avgLatency * m.requests, 0)
  const weightedTtft = models.reduce((s, m) => s + m.avgTtft * m.requests, 0)

  const overview: Overview = {
    range,
    totals: {
      requests,
      errors: 0,
      errorRate: 0,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      cost,
      avgLatency: requests ? Math.round(weightedLatency / requests) : 0,
      p95Latency: requests ? Math.round(weightedLatency / requests) : 0,
      avgTtft: requests ? Math.round(weightedTtft / requests) : 0,
      tokensPerSec: models.reduce((s, m) => Math.max(s, m.tokensPerSec), 0),
    },
    deltas: { requests: 0, cost: 0, errorRate: 0, latency: 0 },
    series,
    topModels: models.filter((m) => m.requests > 0).slice(0, 5),
    statusBreakdown: [
      { name: '2xx', value: requests },
      { name: '4xx', value: 0 },
      { name: '5xx', value: 0 },
    ],
  }

  return { overview, models }
}

async function tryScrape(url: string, range: TimeRange) {
  const res = await fetch(url, {
    headers: { ...gatewayAuthHeaders(), Accept: 'text/plain' },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const text = await res.text()
  // Controller/admin endpoints often expose Prometheus text without GenAI series.
  if (!text.includes('gen_ai_')) {
    console.warn(
      `[live-metrics] scraped ${url} but found no gen_ai_* series (wrong target?). ` +
        `AI Gateway GenAI metrics come from the ai-gateway-extproc admin port (1064), not the controller :8080.`,
    )
    return null
  }
  const samples = parsePrometheus(text)
  if (!scrapeHasGenAi(samples)) return null
  return buildFromScrape(samples, range)
}

export type LiveMetricsResult = {
  overview: Overview
  models: ModelStat[]
}

/**
 * Pull Overview / Models data from Prometheus (PromQL) or a raw /metrics scrape.
 * Returns null when the metrics backend is unreachable or has no gen_ai series.
 */
export async function fetchLiveMetrics(range: TimeRange): Promise<LiveMetricsResult | null> {
  const base = metricsBaseUrl()
  if (!base) return null

  try {
    if (!base.endsWith('/metrics')) {
      const prom = await tryPromql(base, range)
      if (prom) return prom
    }
  } catch {
    // fall through to scrape
  }

  try {
    const scrapeUrl = base.endsWith('/metrics') ? base : `${base.replace(/\/$/, '')}/metrics`
    return await tryScrape(scrapeUrl, range)
  } catch {
    return null
  }
}

export async function fetchLiveOverview(range: TimeRange): Promise<Overview | null> {
  const live = await fetchLiveMetrics(range)
  return live?.overview ?? null
}

export async function fetchLiveModels(range: TimeRange): Promise<ModelStat[] | null> {
  const live = await fetchLiveMetrics(range)
  return live?.models ?? null
}

function emptyModelDetail(
  id: string,
  name: string,
  provider: string,
  range: TimeRange,
): ModelDetail {
  return {
    id,
    name,
    provider,
    requests: 0,
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    cost: 0,
    avgLatency: 0,
    p95Latency: 0,
    avgTtft: 0,
    errorRate: 0,
    tokensPerSec: 0,
    trendPct: 0,
    contextWindow: 0,
    inputPricePerM: 0,
    outputPricePerM: 0,
    series: emptySeries(range),
    latencyBuckets: [
      { bucket: '0-250ms', count: 0 },
      { bucket: '250-500ms', count: 0 },
      { bucket: '500ms-1s', count: 0 },
      { bucket: '1-2s', count: 0 },
      { bucket: '2s+', count: 0 },
    ],
    recentLogs: [],
  }
}

async function modelDetailFromCatalog(
  id: string,
  range: TimeRange,
): Promise<ModelDetail | null> {
  if (!isAiGatewayConfigured()) return null
  try {
    const catalog = await fetchGatewayModels()
    const m = catalog.find((c) => c.id === id)
    if (!m) return null
    return emptyModelDetail(m.id, m.name, m.provider, range)
  } catch {
    return null
  }
}

export async function fetchLiveModelDetail(
  id: string,
  range: TimeRange,
  prefetched?: LiveMetricsResult | null,
): Promise<ModelDetail | null> {
  const live = prefetched === undefined ? await fetchLiveMetrics(range) : prefetched

  if (live) {
    const stat = live.models.find((m) => m.id === id)
    if (stat) {
      return {
        ...stat,
        series: seriesFromCumulative(range, {
          requests: stat.requests,
          inputTokens: stat.inputTokens,
          outputTokens: stat.outputTokens,
          cost: stat.cost,
          avgLatency: stat.avgLatency,
          p95Latency: stat.p95Latency,
        }),
        latencyBuckets: latencyBucketsFromAvg(stat.avgLatency, stat.requests),
        recentLogs: [],
      }
    }
  }

  // Metrics missing or model has no traffic yet — still resolve from the live catalog.
  return modelDetailFromCatalog(id, range)
}

function latencyBucketsFromAvg(avgLatencyMs: number, requests: number) {
  const buckets = [
    { bucket: '0-250ms', min: 0, max: 250 },
    { bucket: '250-500ms', min: 250, max: 500 },
    { bucket: '500ms-1s', min: 500, max: 1000 },
    { bucket: '1-2s', min: 1000, max: 2000 },
    { bucket: '2s+', min: 2000, max: Infinity },
  ]
  return buckets.map((b) => ({
    bucket: b.bucket,
    count: avgLatencyMs >= b.min && avgLatencyMs < b.max ? requests : 0,
  }))
}

export function emptyLiveOverview(range: TimeRange): Overview {
  return emptyOverview(range)
}

import { MODEL_CATALOG } from './demo'
import type {
  LogEntry,
  ModelDetail,
  ModelStat,
  Overview,
  TimeRange,
  TimeseriesPoint,
} from './types'

export const RANGE_MS: Record<TimeRange, number> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

interface BucketCfg {
  size: number
  count: number
}

const BUCKETS: Record<TimeRange, BucketCfg> = {
  '1h': { size: 5 * 60 * 1000, count: 12 },
  '24h': { size: 60 * 60 * 1000, count: 24 },
  '7d': { size: 6 * 60 * 60 * 1000, count: 28 },
  '30d': { size: 24 * 60 * 60 * 1000, count: 30 },
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx]
}

function formatLabel(ts: number, range: TimeRange): string {
  const d = new Date(ts)
  if (range === '1h' || range === '24h') {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function filterByRange(logs: LogEntry[], now: number, range: TimeRange): LogEntry[] {
  const from = now - RANGE_MS[range]
  return logs.filter((l) => l.timestamp >= from)
}

function buildSeries(logs: LogEntry[], now: number, range: TimeRange): TimeseriesPoint[] {
  const { size, count } = BUCKETS[range]
  const end = Math.ceil(now / size) * size
  const start = end - size * count
  const buckets: { latencies: number[]; point: TimeseriesPoint }[] = []
  for (let i = 0; i < count; i++) {
    const ts = start + i * size
    buckets.push({
      latencies: [],
      point: {
        ts,
        label: formatLabel(ts, range),
        requests: 0,
        errors: 0,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        latencyP50: 0,
        latencyP95: 0,
      },
    })
  }
  for (const l of logs) {
    const idx = Math.floor((l.timestamp - start) / size)
    if (idx < 0 || idx >= count) continue
    const b = buckets[idx]
    b.point.requests += 1
    if (l.status === 'error') b.point.errors += 1
    b.point.inputTokens += l.inputTokens
    b.point.outputTokens += l.outputTokens
    b.point.cost += l.cost
    if (l.status === 'success') b.latencies.push(l.latencyMs)
  }
  for (const b of buckets) {
    b.latencies.sort((a, c) => a - c)
    b.point.latencyP50 = Math.round(percentile(b.latencies, 50))
    b.point.latencyP95 = Math.round(percentile(b.latencies, 95))
    b.point.cost = Number(b.point.cost.toFixed(4))
  }
  return buckets.map((b) => b.point)
}

function statsFor(logs: LogEntry[]) {
  const requests = logs.length
  const errors = logs.filter((l) => l.status === 'error').length
  const successLogs = logs.filter((l) => l.status === 'success')
  const inputTokens = logs.reduce((s, l) => s + l.inputTokens, 0)
  const outputTokens = logs.reduce((s, l) => s + l.outputTokens, 0)
  const cost = logs.reduce((s, l) => s + l.cost, 0)
  const latencies = successLogs.map((l) => l.latencyMs).sort((a, b) => a - b)
  const ttfts = successLogs.map((l) => l.ttftMs)
  const avgLatency = latencies.length
    ? Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length)
    : 0
  const avgTtft = ttfts.length ? Math.round(ttfts.reduce((s, v) => s + v, 0) / ttfts.length) : 0
  const totalGenTokens = successLogs.reduce((s, l) => s + l.outputTokens, 0)
  const totalGenSeconds = successLogs.reduce((s, l) => s + l.latencyMs / 1000, 0)
  return {
    requests,
    errors,
    errorRate: requests ? errors / requests : 0,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    cost,
    avgLatency,
    p95Latency: Math.round(percentile(latencies, 95)),
    avgTtft,
    tokensPerSec: totalGenSeconds ? Math.round(totalGenTokens / totalGenSeconds) : 0,
  }
}

export function computeModels(logs: LogEntry[], now: number, range: TimeRange): ModelStat[] {
  const current = filterByRange(logs, now, range)
  const prevFrom = now - 2 * RANGE_MS[range]
  const prevTo = now - RANGE_MS[range]
  const previous = logs.filter((l) => l.timestamp >= prevFrom && l.timestamp < prevTo)

  const byModel = new Map<string, LogEntry[]>()
  for (const l of current) {
    const arr = byModel.get(l.model) ?? []
    arr.push(l)
    byModel.set(l.model, arr)
  }
  const prevByModel = new Map<string, number>()
  for (const l of previous) prevByModel.set(l.model, (prevByModel.get(l.model) ?? 0) + 1)

  const stats: ModelStat[] = MODEL_CATALOG.map((m) => {
    const mlogs = byModel.get(m.id) ?? []
    const s = statsFor(mlogs)
    const prevCount = prevByModel.get(m.id) ?? 0
    const trendPct = prevCount ? ((s.requests - prevCount) / prevCount) * 100 : s.requests ? 100 : 0
    return {
      id: m.id,
      name: m.name,
      provider: m.provider,
      requests: s.requests,
      totalTokens: s.totalTokens,
      inputTokens: s.inputTokens,
      outputTokens: s.outputTokens,
      cost: s.cost,
      avgLatency: s.avgLatency,
      p95Latency: s.p95Latency,
      avgTtft: s.avgTtft,
      errorRate: s.errorRate,
      tokensPerSec: s.tokensPerSec,
      trendPct,
      contextWindow: m.contextWindow,
      inputPricePerM: m.inputPricePerM,
      outputPricePerM: m.outputPricePerM,
    }
  })

  return stats.sort((a, b) => b.requests - a.requests)
}

export function computeOverview(logs: LogEntry[], now: number, range: TimeRange): Overview {
  const current = filterByRange(logs, now, range)
  const prevFrom = now - 2 * RANGE_MS[range]
  const prevTo = now - RANGE_MS[range]
  const previous = logs.filter((l) => l.timestamp >= prevFrom && l.timestamp < prevTo)

  const s = statsFor(current)
  const p = statsFor(previous)

  const pct = (cur: number, prev: number) => (prev ? ((cur - prev) / prev) * 100 : cur ? 100 : 0)

  const topModels = computeModels(logs, now, range).slice(0, 5)

  const statusBreakdown = [
    { name: '2xx', value: current.filter((l) => l.statusCode >= 200 && l.statusCode < 300).length },
    { name: '4xx', value: current.filter((l) => l.statusCode >= 400 && l.statusCode < 500).length },
    { name: '5xx', value: current.filter((l) => l.statusCode >= 500).length },
  ]

  return {
    range,
    totals: {
      requests: s.requests,
      errors: s.errors,
      errorRate: s.errorRate,
      inputTokens: s.inputTokens,
      outputTokens: s.outputTokens,
      totalTokens: s.totalTokens,
      cost: s.cost,
      avgLatency: s.avgLatency,
      p95Latency: s.p95Latency,
      avgTtft: s.avgTtft,
      tokensPerSec: s.tokensPerSec,
    },
    deltas: {
      requests: pct(s.requests, p.requests),
      cost: pct(s.cost, p.cost),
      errorRate: s.errorRate - p.errorRate,
      latency: pct(s.avgLatency, p.avgLatency),
    },
    series: buildSeries(current, now, range),
    topModels,
    statusBreakdown,
  }
}

export function computeModelDetail(
  id: string,
  logs: LogEntry[],
  now: number,
  range: TimeRange,
): ModelDetail | null {
  const stat = computeModels(logs, now, range).find((m) => m.id === id)
  if (!stat) return null
  const current = filterByRange(logs, now, range).filter((l) => l.model === id)

  const latencyRanges = [
    { bucket: '0-250ms', min: 0, max: 250 },
    { bucket: '250-500ms', min: 250, max: 500 },
    { bucket: '500ms-1s', min: 500, max: 1000 },
    { bucket: '1-2s', min: 1000, max: 2000 },
    { bucket: '2s+', min: 2000, max: Infinity },
  ]
  const latencyBuckets = latencyRanges.map((r) => ({
    bucket: r.bucket,
    count: current.filter((l) => l.status === 'success' && l.latencyMs >= r.min && l.latencyMs < r.max).length,
  }))

  return {
    ...stat,
    series: buildSeries(current, now, range),
    latencyBuckets,
    recentLogs: current.slice(0, 25),
  }
}

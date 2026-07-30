import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import {
  fetchGatewayModels,
  getPreferredGatewayModel,
  isAiGatewayConfigured,
} from './ai-gateway'
import { dataSource } from './gateway'
import {
  emptyLiveOverview,
  fetchLiveMetrics,
  fetchLiveModelDetail,
} from './live-metrics'
import type { LogsResponse, ModelStat, TimeRange } from './types'

function catalogModelsAsStats(
  catalog: { id: string; name: string; provider: string }[],
): ModelStat[] {
  return catalog.map((m) => ({
    id: m.id,
    name: m.name,
    provider: m.provider,
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
  }))
}

/**
 * Cached server data layer for Cache Components.
 *
 * Each exported function is a `use cache` entry point keyed only by its
 * serializable arguments (range / id). Results land in the Next.js data
 * cache and are reused across requests. Pages await them so the initial
 * HTML already contains data.
 *
 * All metrics come from the live gateway / Prometheus path. When the
 * gateway is not configured or metrics are unreachable, callers get empty
 * structures — never synthetic sample traffic.
 */
export async function getOverviewData(range: TimeRange) {
  'use cache'
  cacheLife('minutes')
  cacheTag('gateway-data', `overview:${range}`)

  if (!isAiGatewayConfigured()) {
    return { overview: emptyLiveOverview(range), source: dataSource() }
  }

  const live = await fetchLiveMetrics(range)
  if (live) {
    return { overview: live.overview, source: dataSource('live') }
  }
  return { overview: emptyLiveOverview(range), source: dataSource('unavailable') }
}

export async function getModelsData(range: TimeRange) {
  'use cache'
  cacheLife('minutes')
  cacheTag('gateway-data', `models:${range}`)

  if (!isAiGatewayConfigured()) {
    return { models: [], source: dataSource() }
  }

  const live = await fetchLiveMetrics(range)
  if (live) {
    return { models: live.models, source: dataSource('live') }
  }

  // Metrics missing — still list the live catalog with zeroed stats.
  try {
    const catalog = await fetchGatewayModels()
    return {
      models: catalogModelsAsStats(catalog),
      source: dataSource('unavailable'),
    }
  } catch {
    return { models: [], source: dataSource('unavailable') }
  }
}

export async function getModelDetailData(id: string, range: TimeRange) {
  'use cache'
  cacheLife('minutes')
  cacheTag('gateway-data', `model:${id}:${range}`)

  if (!isAiGatewayConfigured()) {
    return { model: null, source: dataSource() }
  }

  const live = await fetchLiveMetrics(range)
  const model = await fetchLiveModelDetail(id, range, live)
  return {
    model,
    source: dataSource(live ? 'live' : 'unavailable'),
  }
}

/** First page of logs for the default 24h view (seeds first paint). */
export async function getDefaultLogsData(): Promise<LogsResponse> {
  'use cache'
  cacheLife('minutes')
  cacheTag('gateway-data', 'logs:default')

  // No live log backend yet — keep empty rather than synthetic rows.
  return { logs: [], total: 0, page: 1, pageSize: 20 }
}

export async function getMetaData() {
  'use cache'
  cacheLife('minutes')
  cacheTag('gateway-meta')

  const preferredModel = getPreferredGatewayModel()

  if (!isAiGatewayConfigured()) {
    return {
      models: [],
      providers: [],
      preferredModel,
      source: dataSource(),
    }
  }

  const live = await fetchLiveMetrics('24h')
  const source = dataSource(live ? 'live' : 'unavailable')
  try {
    const gatewayModels = await fetchGatewayModels()
    return {
      models: gatewayModels.map((m) => ({
        id: m.id,
        name: m.name,
        provider: m.provider,
      })),
      providers: Array.from(new Set(gatewayModels.map((m) => m.provider))),
      preferredModel,
      source,
    }
  } catch {
    return {
      models: [],
      providers: [],
      preferredModel,
      source,
    }
  }
}

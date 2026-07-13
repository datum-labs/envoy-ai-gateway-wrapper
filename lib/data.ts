import 'server-only'
import { cacheLife, cacheTag } from 'next/cache'
import { computeModelDetail, computeModels, computeOverview } from './aggregate'
import { getDataset, MODEL_CATALOG } from './demo'
import { dataSource } from './gateway'
import type { LogsResponse, TimeRange } from './types'

/**
 * Cached server data layer for Cache Components.
 *
 * Each exported function is a `use cache` entry point keyed only by its
 * serializable arguments (range / id). Results land in the Next.js data
 * cache and are reused across requests, and pages await them so the initial
 * HTML already contains data — removing the post-hydration fetch waterfall.
 *
 * The demo dataset is deterministic and anchored to a single `Date.now()`
 * captured the first time `getDataset()` runs. We warm it here at module load
 * so that one-time, non-deterministic anchor executes OUTSIDE any `use cache`
 * scope; inside the cached functions `getDataset()` only returns the memoized
 * value, keeping the cached output fully reproducible.
 */
getDataset()

const DAY_MS = 24 * 60 * 60 * 1000

export async function getOverviewData(range: TimeRange) {
  'use cache'
  cacheLife('minutes')
  cacheTag('gateway-data', `overview:${range}`)
  const { logs, now } = getDataset()
  return { overview: computeOverview(logs, now, range), source: dataSource() }
}

export async function getModelsData(range: TimeRange) {
  'use cache'
  cacheLife('minutes')
  cacheTag('gateway-data', `models:${range}`)
  const { logs, now } = getDataset()
  return { models: computeModels(logs, now, range), source: dataSource() }
}

export async function getModelDetailData(id: string, range: TimeRange) {
  'use cache'
  cacheLife('minutes')
  cacheTag('gateway-data', `model:${id}:${range}`)
  const { logs, now } = getDataset()
  return { model: computeModelDetail(id, logs, now, range), source: dataSource() }
}

/** First page of unfiltered logs for the default 24h view (seeds first paint). */
export async function getDefaultLogsData(): Promise<LogsResponse> {
  'use cache'
  cacheLife('minutes')
  cacheTag('gateway-data', 'logs:default')
  const { logs, now } = getDataset()
  const from = now - DAY_MS
  const filtered = logs.filter((l) => l.timestamp >= from)
  return { logs: filtered.slice(0, 20), total: filtered.length, page: 1, pageSize: 20 }
}

export async function getMetaData() {
  'use cache'
  cacheLife('hours')
  cacheTag('gateway-meta')
  return {
    models: MODEL_CATALOG.map((m) => ({ id: m.id, name: m.name, provider: m.provider })),
    providers: Array.from(new Set(MODEL_CATALOG.map((m) => m.provider))),
    source: dataSource(),
  }
}

import type { LogEntry, LogStatus } from './types'

// ----- deterministic RNG (mulberry32) -----
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(1337)

function gaussian(mean: number, stdev: number) {
  // Box-Muller
  const u = 1 - rand()
  const v = rand()
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  return mean + z * stdev
}

function pick<T>(items: T[]): T {
  return items[Math.floor(rand() * items.length)]
}

export interface ModelCatalogEntry {
  id: string
  name: string
  provider: string
  weight: number
  inputPricePerM: number
  outputPricePerM: number
  baseLatency: number
  latencyJitter: number
  baseTtft: number
  errorRate: number
  contextWindow: number
  avgInputTokens: number
  avgOutputTokens: number
  tokensPerSec: number
}

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', weight: 26, inputPricePerM: 2.5, outputPricePerM: 10, baseLatency: 780, latencyJitter: 420, baseTtft: 340, errorRate: 0.012, contextWindow: 128000, avgInputTokens: 920, avgOutputTokens: 480, tokensPerSec: 92 },
  { id: 'gpt-4o-mini', name: 'GPT-4o mini', provider: 'OpenAI', weight: 34, inputPricePerM: 0.15, outputPricePerM: 0.6, baseLatency: 430, latencyJitter: 210, baseTtft: 180, errorRate: 0.008, contextWindow: 128000, avgInputTokens: 640, avgOutputTokens: 320, tokensPerSec: 138 },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', weight: 22, inputPricePerM: 3, outputPricePerM: 15, baseLatency: 860, latencyJitter: 460, baseTtft: 380, errorRate: 0.01, contextWindow: 200000, avgInputTokens: 1080, avgOutputTokens: 540, tokensPerSec: 84 },
  { id: 'claude-3-5-haiku', name: 'Claude 3.5 Haiku', provider: 'Anthropic', weight: 14, inputPricePerM: 0.8, outputPricePerM: 4, baseLatency: 470, latencyJitter: 230, baseTtft: 200, errorRate: 0.009, contextWindow: 200000, avgInputTokens: 720, avgOutputTokens: 360, tokensPerSec: 122 },
  { id: 'llama-3.3-70b', name: 'Llama 3.3 70B', provider: 'Meta', weight: 12, inputPricePerM: 0.59, outputPricePerM: 0.79, baseLatency: 640, latencyJitter: 380, baseTtft: 260, errorRate: 0.017, contextWindow: 128000, avgInputTokens: 800, avgOutputTokens: 420, tokensPerSec: 108 },
  { id: 'mistral-large', name: 'Mistral Large', provider: 'Mistral', weight: 8, inputPricePerM: 2, outputPricePerM: 6, baseLatency: 700, latencyJitter: 360, baseTtft: 300, errorRate: 0.013, contextWindow: 128000, avgInputTokens: 760, avgOutputTokens: 400, tokensPerSec: 96 },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google', weight: 10, inputPricePerM: 1.25, outputPricePerM: 5, baseLatency: 820, latencyJitter: 440, baseTtft: 360, errorRate: 0.014, contextWindow: 1000000, avgInputTokens: 1240, avgOutputTokens: 500, tokensPerSec: 88 },
  { id: 'deepseek-v3', name: 'DeepSeek V3', provider: 'DeepSeek', weight: 9, inputPricePerM: 0.27, outputPricePerM: 1.1, baseLatency: 690, latencyJitter: 400, baseTtft: 280, errorRate: 0.019, contextWindow: 64000, avgInputTokens: 700, avgOutputTokens: 380, tokensPerSec: 102 },
]

const REGIONS = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1']
const ENDPOINTS = ['/v1/chat/completions', '/v1/completions', '/v1/embeddings']
const FINISH_REASONS = ['stop', 'stop', 'stop', 'stop', 'length', 'tool_calls']
const ERROR_CODES = [429, 500, 502, 503, 400]
const ERROR_MESSAGES: Record<number, string> = {
  429: 'Rate limit exceeded for upstream provider',
  500: 'Upstream provider returned an internal error',
  502: 'Bad gateway from upstream provider',
  503: 'Upstream provider temporarily unavailable',
  400: 'Invalid request: context length exceeded',
}

const LOG_COUNT = 6400
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

// Diurnal + weekly weighting so traffic looks realistic.
function timeWeight(ts: number): number {
  const d = new Date(ts)
  const hour = d.getUTCHours()
  const day = d.getUTCDay()
  const diurnal = 0.5 + 0.5 * Math.sin(((hour - 8) / 24) * 2 * Math.PI)
  const weekend = day === 0 || day === 6 ? 0.55 : 1
  return diurnal * weekend
}

function buildDataset() {
  const now = Date.now()
  const start = now - WINDOW_MS
  const modelById = new Map(MODEL_CATALOG.map((m) => [m.id, m]))
  const weightTotal = MODEL_CATALOG.reduce((s, m) => s + m.weight, 0)

  const logs: LogEntry[] = []
  for (let i = 0; i < LOG_COUNT; i++) {
    // weighted model pick
    let r = rand() * weightTotal
    let model = MODEL_CATALOG[0]
    for (const m of MODEL_CATALOG) {
      r -= m.weight
      if (r <= 0) {
        model = m
        break
      }
    }

    // timestamp with diurnal rejection sampling
    let ts = start + rand() * WINDOW_MS
    for (let k = 0; k < 3; k++) {
      if (rand() < timeWeight(ts)) break
      ts = start + rand() * WINDOW_MS
    }
    // bias toward recent activity
    if (rand() < 0.35) ts = now - rand() * (WINDOW_MS / 6)

    const inputTokens = Math.max(20, Math.round(gaussian(model.avgInputTokens, model.avgInputTokens * 0.35)))
    const isEmbedding = false
    const outputTokens = Math.max(0, Math.round(gaussian(model.avgOutputTokens, model.avgOutputTokens * 0.4)))
    const totalTokens = inputTokens + outputTokens

    // error?
    const spike = timeWeight(ts) < 0.35 ? 1.8 : 1
    const status: LogStatus = rand() < model.errorRate * spike ? 'error' : 'success'

    const genTime = outputTokens / model.tokensPerSec // seconds
    const latencyMs = Math.max(
      80,
      Math.round(model.baseLatency + genTime * 1000 * 0.6 + gaussian(0, model.latencyJitter)),
    )
    const ttftMs = Math.max(40, Math.round(model.baseTtft + gaussian(0, model.baseTtft * 0.3)))

    const cost =
      (inputTokens / 1_000_000) * model.inputPricePerM +
      (outputTokens / 1_000_000) * model.outputPricePerM

    const statusCode = status === 'error' ? pick(ERROR_CODES) : 200

    logs.push({
      id: `req_${(1e9 + i).toString(36)}`,
      requestId: `${Math.floor(rand() * 0xffffffff).toString(16).padStart(8, '0')}-${Math.floor(rand() * 0xffff).toString(16).padStart(4, '0')}`,
      timestamp: Math.round(ts),
      model: model.id,
      provider: model.provider,
      endpoint: isEmbedding ? '/v1/embeddings' : pick(ENDPOINTS),
      status,
      statusCode,
      latencyMs: status === 'error' ? Math.round(latencyMs * 0.4) : latencyMs,
      ttftMs,
      inputTokens,
      outputTokens: status === 'error' ? 0 : outputTokens,
      totalTokens: status === 'error' ? inputTokens : totalTokens,
      cost: status === 'error' ? 0 : cost,
      region: pick(REGIONS),
      finishReason: status === 'error' ? 'error' : pick(FINISH_REASONS),
      errorMessage: status === 'error' ? ERROR_MESSAGES[statusCode] : undefined,
    })
  }

  logs.sort((a, b) => b.timestamp - a.timestamp)
  return { logs, now, modelById }
}

// Cache the dataset for the lifetime of the server process.
let cached: ReturnType<typeof buildDataset> | null = null
export function getDataset() {
  if (!cached) cached = buildDataset()
  return cached
}

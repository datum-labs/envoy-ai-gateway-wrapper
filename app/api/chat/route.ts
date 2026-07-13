import { MODEL_CATALOG } from '@/lib/demo'

const GATEWAY_URL = process.env.ENVOY_AI_GATEWAY_URL?.replace(/\/$/, '') || null
const GATEWAY_API_KEY = process.env.ENVOY_AI_GATEWAY_API_KEY || null

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

function encoderLine(obj: unknown) {
  return new TextEncoder().encode(JSON.stringify(obj) + '\n')
}

const DEMO_SENTENCES = [
  'Envoy AI Gateway sits in front of your model providers and gives you a single OpenAI-compatible endpoint.',
  'Because this console is running in demo mode, the response is simulated locally instead of hitting a live upstream.',
  'You can wire up a real deployment by setting the ENVOY_AI_GATEWAY_URL and ENVOY_AI_GATEWAY_API_KEY environment variables.',
  'Once connected, requests here are proxied straight through to the gateway and streamed back token by token.',
  'Metrics like latency, time-to-first-token, and token usage are captured for every request you send.',
]

async function demoStream(model: string, controller: ReadableStreamDefaultController) {
  const cat = MODEL_CATALOG.find((m) => m.id === model) ?? MODEL_CATALOG[0]
  const start = Date.now()
  const ttft = Math.round(cat.baseTtft + Math.random() * cat.baseTtft * 0.4)
  await new Promise((r) => setTimeout(r, ttft))
  controller.enqueue(encoderLine({ type: 'start', model: cat.id, ttftMs: ttft }))

  const text = DEMO_SENTENCES.slice(0, 2 + Math.floor(Math.random() * 3)).join(' ')
  const tokens = text.split(/(\s+)/)
  let outputTokens = 0
  const perToken = Math.max(8, Math.round(1000 / cat.tokensPerSec))
  for (const tk of tokens) {
    await new Promise((r) => setTimeout(r, perToken))
    controller.enqueue(encoderLine({ type: 'delta', text: tk }))
    if (tk.trim()) outputTokens += 1
  }

  const latencyMs = Date.now() - start
  const inputTokens = Math.round(cat.avgInputTokens * 0.3)
  const cost =
    (inputTokens / 1_000_000) * cat.inputPricePerM +
    (outputTokens / 1_000_000) * cat.outputPricePerM
  controller.enqueue(
    encoderLine({
      type: 'done',
      usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
      latencyMs,
      ttftMs: ttft,
      cost,
      tokensPerSec: Math.round(outputTokens / (latencyMs / 1000)),
    }),
  )
  controller.close()
}

async function liveStream(
  model: string,
  messages: ChatMessage[],
  temperature: number,
  controller: ReadableStreamDefaultController,
) {
  const start = Date.now()
  let ttft = 0
  let outputTokens = 0
  const res = await fetch(`${GATEWAY_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(GATEWAY_API_KEY ? { Authorization: `Bearer ${GATEWAY_API_KEY}` } : {}),
    },
    body: JSON.stringify({ model, messages, temperature, stream: true }),
  })

  if (!res.ok || !res.body) {
    controller.enqueue(
      encoderLine({ type: 'error', message: `Gateway responded ${res.status}` }),
    )
    controller.close()
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  controller.enqueue(encoderLine({ type: 'start', model }))

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (payload === '[DONE]') continue
      try {
        const json = JSON.parse(payload)
        const delta = json.choices?.[0]?.delta?.content
        if (delta) {
          if (!ttft) ttft = Date.now() - start
          outputTokens += 1
          controller.enqueue(encoderLine({ type: 'delta', text: delta }))
        }
      } catch {
        // ignore malformed keepalive lines
      }
    }
  }

  controller.enqueue(
    encoderLine({
      type: 'done',
      usage: { inputTokens: 0, outputTokens, totalTokens: outputTokens },
      latencyMs: Date.now() - start,
      ttftMs: ttft,
      cost: 0,
      tokensPerSec: Math.round(outputTokens / ((Date.now() - start) / 1000)),
    }),
  )
  controller.close()
}

export async function POST(request: Request) {
  const body = await request.json()
  const model: string = body.model || MODEL_CATALOG[0].id
  const messages: ChatMessage[] = body.messages || []
  const temperature: number = typeof body.temperature === 'number' ? body.temperature : 0.7

  const stream = new ReadableStream({
    async start(controller) {
      try {
        if (GATEWAY_URL) {
          await liveStream(model, messages, temperature, controller)
        } else {
          await demoStream(model, controller)
        }
      } catch (err) {
        controller.enqueue(
          encoderLine({ type: 'error', message: err instanceof Error ? err.message : 'Unknown error' }),
        )
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
}

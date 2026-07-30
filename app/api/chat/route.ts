import {
  createGatewayLanguageModel,
  isAiGatewayConfigured,
  resolveGatewayModel,
} from '@/lib/ai-gateway'
import {
  APICallError,
  convertToModelMessages,
  smoothStream,
  streamText,
  type UIMessage,
} from 'ai'

const MAX_MESSAGES = 50

const EFFORT_BUDGETS = { low: 4000, medium: 10000, high: 20000 } as const
const DEFAULT_THINKING_BUDGET = 10000
const EFFORT_TO_REASONING = { low: 'low', medium: 'medium', high: 'high' } as const
const DEFAULT_REASONING_EFFORT = 'high'

function resolveEffortBudget(effort: unknown): number {
  return typeof effort === 'string' && effort in EFFORT_BUDGETS
    ? EFFORT_BUDGETS[effort as keyof typeof EFFORT_BUDGETS]
    : DEFAULT_THINKING_BUDGET
}

function resolveReasoningEffort(effort: unknown): string {
  return typeof effort === 'string' && effort in EFFORT_TO_REASONING
    ? EFFORT_TO_REASONING[effort as keyof typeof EFFORT_TO_REASONING]
    : DEFAULT_REASONING_EFFORT
}

function usesAdaptiveThinking(modelId: string): boolean {
  return /^claude-(?:opus|sonnet|haiku|fable)-5(?:-|$)/.test(modelId)
}

function formatAssistantError(error: unknown): string {
  if (APICallError.isInstance(error)) {
    if (typeof error.responseBody === 'string' && error.responseBody.length > 0) {
      try {
        const parsed = JSON.parse(error.responseBody) as {
          error?: { message?: string }
          message?: string
        }
        const msg = parsed.error?.message ?? parsed.message
        if (typeof msg === 'string' && msg.trim()) return msg.trim()
      } catch {
        // fall through
      }
    }
    if (error.message.trim()) return error.message.trim()
  }

  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause
    if (cause) {
      const nested = formatAssistantError(cause)
      if (nested !== 'An error occurred.') return nested
    }
    if (error.message.trim() && error.message !== 'An error occurred.') {
      return error.message.trim()
    }
  }

  return 'An error occurred.'
}

export async function POST(request: Request) {
  if (!isAiGatewayConfigured()) {
    return Response.json(
      {
        error:
          'AI gateway is not configured. Set ENVOY_AI_GATEWAY_URL and ENVOY_AI_GATEWAY_API_KEY (or TOKEN_FILE).',
      },
      { status: 503 },
    )
  }

  const body = await request.json()
  const {
    messages,
    model: requestedModel,
    effort: requestedEffort,
  } = body as {
    messages: UIMessage[]
    model?: string
    effort?: string
  }

  try {
    const selected = await resolveGatewayModel(requestedModel)
    const languageModel = createGatewayLanguageModel(selected.id, selected.protocol)

    const thinkingBudget = resolveEffortBudget(requestedEffort)
    const reasoningEffort = resolveReasoningEffort(requestedEffort)
    const adaptive = selected.protocol === 'anthropic' && usesAdaptiveThinking(selected.id)

    const result = streamText({
      model: languageModel,
      messages: await convertToModelMessages(messages.slice(-MAX_MESSAGES)),
      maxOutputTokens:
        selected.protocol === 'anthropic' && !adaptive ? thinkingBudget + 4096 : 8192,
      experimental_transform: smoothStream({ chunking: 'word', delayInMs: 40 }),
      providerOptions:
        selected.protocol === 'anthropic'
          ? {
              anthropic: {
                thinking: adaptive
                  ? { type: 'adaptive' as const, display: 'summarized' as const }
                  : { type: 'enabled' as const, budgetTokens: thinkingBudget },
                ...(adaptive ? { effort: reasoningEffort as 'low' | 'medium' | 'high' } : {}),
              },
            }
          : {
              datumAiGateway: {
                reasoningEffort,
              },
            },
    })

    return result.toUIMessageStreamResponse({
      sendReasoning: true,
      onError: formatAssistantError,
    })
  } catch (err) {
    return Response.json({ error: formatAssistantError(err) }, { status: 500 })
  }
}

import type { AssistantConfig, EffortOption, ModelOption } from '@datum-cloud/datum-ui/assistant'
import { defaultRenderLink } from '@datum-cloud/datum-ui/assistant'

export const EFFORT_OPTIONS: EffortOption[] = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
]

export const DEFAULT_EFFORT_ID = 'high' as const

export const PLAYGROUND_SUGGESTIONS = [
  'Explain what Envoy AI Gateway does in one paragraph.',
  'Compare OpenAI-compatible vs Anthropic Messages routing.',
  'Give me a sample curl against /v1/chat/completions.',
] as const

export function buildPlaygroundAssistantConfig(
  models: ModelOption[] = [],
  preferredModelId?: string | null,
): AssistantConfig {
  const defaultModelId =
    (preferredModelId && models.some((m) => m.id === preferredModelId) && preferredModelId) ||
    models[0]?.id ||
    ''

  return {
    greeting: () => 'Try the gateway',
    suggestions: [...PLAYGROUND_SUGGESTIONS],
    showReasoning: true,
    modelSelector:
      models.length > 0
        ? {
            models,
            efforts: EFFORT_OPTIONS,
            defaultModelId,
            defaultEffortId: DEFAULT_EFFORT_ID,
          }
        : false,
    toolLabels: {},
    renderLink: defaultRenderLink,
  }
}

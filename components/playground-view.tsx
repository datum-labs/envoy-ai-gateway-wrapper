'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import { Trash2 } from 'lucide-react'
import {
  AssistantConfigProvider,
  Conversation,
  EmptyState,
  PromptCard,
  type ModelOption,
} from '@datum-cloud/datum-ui/assistant'
import { Badge } from '@datum-cloud/datum-ui/badge'
import { Button } from '@datum-cloud/datum-ui/button'
import { fetcher } from '@/lib/client'
import { PageHeader } from '@/components/page-header'
import { buildPlaygroundAssistantConfig } from '@/components/playground/playground-config'
import { usePlaygroundChat } from '@/components/playground/use-playground-chat'

interface MetaResponse {
  models: { id: string; name: string; provider: string }[]
  preferredModel?: string | null
  source: { mode: 'live' | 'unconfigured' }
}

export function PlaygroundView() {
  const { data: meta } = useSWR<MetaResponse>('/api/meta', fetcher)

  const models: ModelOption[] = useMemo(
    () => (meta?.models ?? []).map((m) => ({ id: m.id, label: m.name })),
    [meta?.models],
  )

  const config = useMemo(
    () => buildPlaygroundAssistantConfig(models, meta?.preferredModel),
    [models, meta?.preferredModel],
  )

  const chat = usePlaygroundChat(models, meta?.preferredModel)
  const isLive = meta?.source.mode === 'live'
  const hasMessages = chat.messages.length > 0

  const composer = (
    <PromptCard
      editor={chat.editor}
      isReady={chat.isReady}
      canRetry={Boolean(chat.error)}
      onSend={chat.handleSendClick}
      onStop={chat.stop}
      onRetry={chat.handleRetry}
      modelId={chat.modelId}
      effortId={chat.effortId}
      onModelChange={chat.setModelId}
      onEffortChange={chat.setEffortId}
    />
  )

  return (
    <div className="flex h-[calc(100dvh-3.5rem-3rem)] flex-col gap-4 md:h-[calc(100dvh-3.5rem-4.5rem)]">
      <PageHeader
        title="Playground"
        description={
          isLive
            ? 'Requests route through your AI gateway.'
            : 'Set ENVOY_AI_GATEWAY_URL and a token to enable chat.'
        }
        actions={
          <div className="flex items-center gap-2">
            <Badge type={isLive ? 'success' : 'muted'}>{isLive ? 'Live' : 'Not configured'}</Badge>
            <Button
              theme="outline"
              size="small"
              onClick={chat.clearConversation}
              disabled={!hasMessages || !chat.isReady}
            >
              <Trash2 className="size-3.5" />
              Clear
            </Button>
          </div>
        }
      />

      <AssistantConfigProvider config={config}>
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
          {hasMessages ? (
            <Conversation
              messages={chat.messages}
              status={chat.status}
              error={chat.error}
              htmlByUserMsgIndex={chat.htmlByUserMsgIndex}
              containerRef={chat.messagesContainerRef}
              bottomRef={chat.bottomRef}
              userScrolledUpRef={chat.userScrolledUp}
              footer={composer}
            />
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <EmptyState isReady={chat.isReady} onSuggestion={chat.sendSuggestion}>
                  {/* PromptCard is pinned below; EmptyState still expects a child slot. */}
                  <div className="h-0 overflow-hidden" aria-hidden />
                </EmptyState>
              </div>
              <div className="relative shrink-0 px-4 pb-4">
                <div className="mx-auto w-full max-w-2xl">{composer}</div>
              </div>
            </>
          )}
        </div>
      </AssistantConfigProvider>
    </div>
  )
}

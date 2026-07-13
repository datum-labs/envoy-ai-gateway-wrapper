'use client'

import { useRef, useState } from 'react'
import useSWR from 'swr'
import { Send, Square, Trash2, User, Bot } from 'lucide-react'
import { Card } from '@datum-cloud/datum-ui/card'
import { Button } from '@datum-cloud/datum-ui/button'
import { Textarea } from '@datum-cloud/datum-ui/textarea'
import { Label } from '@datum-cloud/datum-ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@datum-cloud/datum-ui/select'
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from '@/components/ui/message-scroller'
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
} from '@/components/ui/message'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { fetcher } from '@/lib/client'
import { PageHeader } from '@/components/page-header'
import { formatCurrencyPrecise, formatLatency } from '@/lib/format'

interface MetaResponse {
  models: { id: string; name: string; provider: string }[]
  source: { mode: 'live' | 'demo' }
}

interface ChatMetrics {
  latencyMs: number
  ttftMs: number
  cost: number
  tokensPerSec: number
  totalTokens: number
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  metrics?: ChatMetrics
}

export function PlaygroundView() {
  const { data: meta } = useSWR<MetaResponse>('/api/meta', fetcher)
  const [model, setModel] = useState('')
  const [temperature, setTemperature] = useState(0.7)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [streaming, setStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const activeModel = model || meta?.models[0]?.id || ''
  const isDemo = meta?.source.mode === 'demo'

  async function send() {
    const text = input.trim()
    if (!text || streaming || !activeModel) return

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text }
    const assistantId = crypto.randomUUID()
    const history = [...messages, userMsg]
    setMessages([...history, { id: assistantId, role: 'assistant', content: '' }])
    setInput('')
    setStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: activeModel,
          temperature,
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      if (!res.body) throw new Error('No response body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          const evt = JSON.parse(line)
          if (evt.type === 'delta') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + evt.text } : m,
              ),
            )
          } else if (evt.type === 'done') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      metrics: {
                        latencyMs: evt.latencyMs,
                        ttftMs: evt.ttftMs,
                        cost: evt.cost,
                        tokensPerSec: evt.tokensPerSec,
                        totalTokens: evt.usage.totalTokens,
                      },
                    }
                  : m,
              ),
            )
          } else if (evt.type === 'error') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content || `Error: ${evt.message}` }
                  : m,
              ),
            )
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId && !m.content
              ? { ...m, content: 'Request failed. Check the gateway connection.' }
              : m,
          ),
        )
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  function stop() {
    abortRef.current?.abort()
    setStreaming(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Playground"
        description="Send requests through the gateway and inspect latency, tokens, and cost per response."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        <Card className="flex h-[calc(100vh-16rem)] min-h-[420px] flex-col overflow-hidden">
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground">
              <Bot className="size-8" />
              <p className="text-sm">Start a conversation to see it routed through the gateway.</p>
              {isDemo && (
                <p className="max-w-xs text-xs">
                  Running in demo mode — responses are simulated. Set the gateway env vars to go live.
                </p>
              )}
            </div>
          ) : (
            <MessageScrollerProvider autoScroll>
              <MessageScroller className="flex-1">
                <MessageScrollerViewport>
                  <MessageScrollerContent className="p-4">
                    {messages.map((m) => {
                      const isUser = m.role === 'user'
                      return (
                        <MessageScrollerItem
                          key={m.id}
                          messageId={m.id}
                          scrollAnchor={isUser}
                        >
                          <Message align={isUser ? 'end' : 'start'}>
                            <MessageAvatar>
                              <span
                                className={`flex size-8 items-center justify-center ${
                                  isUser ? 'text-primary' : 'text-muted-foreground'
                                }`}
                              >
                                {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
                              </span>
                            </MessageAvatar>
                            <MessageContent>
                              <Bubble
                                variant={isUser ? 'default' : 'muted'}
                                align={isUser ? 'end' : 'start'}
                              >
                                <BubbleContent>
                                  {m.content || (
                                    <span className="shimmer text-muted-foreground">Thinking…</span>
                                  )}
                                </BubbleContent>
                              </Bubble>
                              {m.metrics && (
                                <MessageFooter className="flex-wrap gap-2">
                                  <span>{formatLatency(m.metrics.ttftMs)} TTFT</span>
                                  <span>·</span>
                                  <span>{formatLatency(m.metrics.latencyMs)} total</span>
                                  <span>·</span>
                                  <span>{m.metrics.totalTokens} tok</span>
                                  <span>·</span>
                                  <span>{m.metrics.tokensPerSec} tok/s</span>
                                  <span>·</span>
                                  <span>{formatCurrencyPrecise(m.metrics.cost)}</span>
                                </MessageFooter>
                              )}
                            </MessageContent>
                          </Message>
                        </MessageScrollerItem>
                      )
                    })}
                  </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton />
              </MessageScroller>
            </MessageScrollerProvider>
          )}

          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Send a message…"
                rows={1}
                className="max-h-32 min-h-[42px] resize-none"
              />
              {streaming ? (
                <Button theme="outline" size="icon" onClick={stop} aria-label="Stop">
                  <Square className="size-4" />
                </Button>
              ) : (
                <Button size="icon" onClick={send} disabled={!input.trim()} aria-label="Send">
                  <Send className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </Card>

        <Card className="flex h-fit flex-col gap-5 p-4">
          <div className="flex flex-col gap-2">
            <Label>Model</Label>
            <Select value={activeModel} onValueChange={setModel}>
              <SelectTrigger>
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {meta?.models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Temperature</Label>
              <span className="font-mono text-sm text-muted-foreground">
                {temperature.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="w-full accent-primary"
              aria-label="Temperature"
            />
          </div>

          <Button
            theme="outline"
            onClick={() => setMessages([])}
            disabled={messages.length === 0 || streaming}
            className="w-full"
          >
            <Trash2 className="size-4" />
            Clear conversation
          </Button>

          <p className="text-xs text-muted-foreground">
            {isDemo
              ? 'Demo mode: responses are simulated locally with realistic latency and token metrics.'
              : 'Live mode: requests are proxied to your Envoy AI Gateway.'}
          </p>
        </Card>
      </div>
    </div>
  )
}

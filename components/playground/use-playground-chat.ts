'use client'

import { DEFAULT_EFFORT_ID } from './playground-config'
import {
  sanitizeUserHtml,
  type EffortId,
  type ModelOption,
} from '@datum-cloud/datum-ui/assistant'
import { cn } from '@datum-cloud/datum-ui/utils'
import { useChat } from '@ai-sdk/react'
import Placeholder from '@tiptap/extension-placeholder'
import { useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { DefaultChatTransport } from 'ai'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiUrl } from '@/lib/client'

function pickDefaultModelId(models: ModelOption[], preferred?: string | null): string {
  if (preferred && models.some((m) => m.id === preferred)) return preferred
  return models[0]?.id ?? ''
}

export function usePlaygroundChat(
  models: ModelOption[] = [],
  preferredModelId?: string | null,
) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const htmlByUserMsgIndex = useRef<string[]>([])
  const userScrolledUp = useRef(false)
  const scrollRaf = useRef(0)

  const [modelId, setModelId] = useState(() => pickDefaultModelId(models, preferredModelId))
  const [effortId, setEffortId] = useState<EffortId>(DEFAULT_EFFORT_ID)
  const modelIdRef = useRef(modelId)
  modelIdRef.current = modelId
  const effortIdRef = useRef(effortId)
  effortIdRef.current = effortId

  useEffect(() => {
    if (models.length === 0) return
    setModelId((prev) =>
      prev && models.some((m) => m.id === prev)
        ? prev
        : pickDefaultModelId(models, preferredModelId),
    )
  }, [models, preferredModelId])

  const messagesContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    const observer = new MutationObserver(() => {
      if (userScrolledUp.current) return
      cancelAnimationFrame(scrollRaf.current)
      scrollRaf.current = requestAnimationFrame(() => {
        node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
      })
    })
    observer.observe(node, { childList: true, subtree: true, characterData: true })
    return () => {
      observer.disconnect()
      cancelAnimationFrame(scrollRaf.current)
    }
  }, [])

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: apiUrl('/api/chat'),
        prepareSendMessagesRequest: ({ messages, id, body }) => ({
          body: {
            id,
            messages: messages.filter((m) => m.role !== 'system'),
            model: modelIdRef.current,
            effort: effortIdRef.current,
            ...body,
          },
        }),
      }),
    [],
  )

  const { messages, setMessages, sendMessage, stop, status, error, clearError } = useChat({
    transport,
  })
  const isReady = status === 'ready' || status === 'error'

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        horizontalRule: false,
        link: false,
      }),
      Placeholder.configure({ placeholder: 'Send a message through the gateway…' }),
    ],
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none',
          'px-1 py-1 text-sm focus:outline-none',
          '[&_p]:my-0.5',
        ),
      },
      handleKeyDown: (view, event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault()
          const text = view.state.doc.textContent.trim()
          if (text && isReady) {
            clearError()
            htmlByUserMsgIndex.current.push(`<p>${text}</p>`)
            void sendMessage({ text })
            const { state } = view
            view.dispatch(
              state.tr.replaceWith(0, state.doc.content.size, state.schema.nodes.paragraph.create()),
            )
          }
          return true
        }
        return false
      },
    },
  })

  const handleSendClick = () => {
    if (!editor || !isReady) return
    const text = editor.getText().trim()
    if (!text) return
    clearError()
    htmlByUserMsgIndex.current.push(editor.getHTML())
    void sendMessage({ text })
    editor.commands.clearContent()
    editor.commands.focus()
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  const sendSuggestion = useCallback(
    (suggestion: string) => {
      if (!isReady) return
      clearError()
      htmlByUserMsgIndex.current.push(sanitizeUserHtml(`<p>${suggestion}</p>`))
      void sendMessage({ text: suggestion })
    },
    [isReady, clearError, sendMessage],
  )

  const handleRetry = useCallback(() => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
    if (!lastUserMsg) return
    const text = lastUserMsg.parts.find((p) => p.type === 'text')?.text
    if (!text) return

    const lastUserIdx = messages.lastIndexOf(lastUserMsg)
    const retainedHtml = htmlByUserMsgIndex.current.slice(0, -1)
    setMessages(messages.slice(0, lastUserIdx))
    htmlByUserMsgIndex.current = retainedHtml
    clearError()

    requestAnimationFrame(() => {
      htmlByUserMsgIndex.current.push(retainedHtml.at(-1) ?? `<p>${text}</p>`)
      void sendMessage({ text })
    })
  }, [messages, setMessages, clearError, sendMessage])

  const clearConversation = useCallback(() => {
    setMessages([])
    htmlByUserMsgIndex.current = []
    clearError()
  }, [setMessages, clearError])

  return {
    messages,
    status,
    error,
    isReady,
    htmlByUserMsgIndex,
    bottomRef,
    messagesContainerRef,
    userScrolledUp,
    editor,
    handleSendClick,
    sendSuggestion,
    handleRetry,
    stop,
    clearConversation,
    modelId,
    setModelId,
    effortId,
    setEffortId,
  }
}

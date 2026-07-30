import type { Metadata } from 'next'
import { Suspense } from 'react'
import { PlaygroundView } from '@/components/playground-view'

export const metadata: Metadata = {
  title: 'Playground',
  description:
    'Send requests through the gateway and inspect streamed responses from the model catalog.',
}

function PlaygroundFallback() {
  return (
    <div className="flex h-[calc(100vh-16rem)] min-h-[480px] items-center justify-center text-sm text-muted-foreground">
      Loading playground…
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<PlaygroundFallback />}>
      <PlaygroundView />
    </Suspense>
  )
}

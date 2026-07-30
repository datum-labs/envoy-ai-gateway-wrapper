import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ModelDetailView } from '@/components/model-detail-view'

export const metadata: Metadata = {
  title: 'Model',
  description: 'Usage, latency, spend, and error rate for a model through the gateway.',
}

function ModelDetailFallback() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
      <div className="h-10 w-64 animate-pulse rounded-md bg-muted" />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<ModelDetailFallback />}>
      <ModelDetailView />
    </Suspense>
  )
}

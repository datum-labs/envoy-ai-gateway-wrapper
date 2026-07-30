import type { Metadata } from 'next'
import { ModelDetailView } from '@/components/model-detail-view'

export const metadata: Metadata = {
  title: 'Model',
  description: 'Usage, latency, spend, and error rate for a model through the gateway.',
}

export default function Page() {
  return <ModelDetailView />
}

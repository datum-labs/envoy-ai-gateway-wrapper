import { ModelDetailView } from '@/components/model-detail-view'
import { MODEL_CATALOG } from '@/lib/demo'

export function generateStaticParams() {
  return MODEL_CATALOG.map((m) => ({ id: m.id }))
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params
  const id = decodeURIComponent(raw)
  return <ModelDetailView id={id} />
}

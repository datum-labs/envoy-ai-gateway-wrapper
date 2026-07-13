'use client'

import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { ArrowUpRight } from 'lucide-react'
import { Card } from '@datum-cloud/datum-ui/card'
import { fetcher } from '@/lib/client'
import type { ModelStat, TimeRange } from '@/lib/types'
import { PageHeader } from '@/components/page-header'
import { RangeSelector } from '@/components/range-selector'
import { ProviderBadge } from '@/components/status-badge'
import { Reveal } from '@/components/reveal'
import { formatCurrency, formatLatency, formatNumber, formatPercent, PROVIDER_COLORS } from '@/lib/format'

interface ModelsResponse {
  models: ModelStat[]
}

export function ModelsView({ initial }: { initial?: ModelsResponse }) {
  const [range, setRange] = useState<TimeRange>('24h')
  const { data } = useSWR<ModelsResponse>(`/api/models?range=${range}`, fetcher, {
    fallbackData: initial,
    keepPreviousData: true,
  })
  const models = data?.models ?? []

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Models"
        description="Every model available through your gateway, with live usage and pricing."
        actions={<RangeSelector value={range} onChange={setRange} />}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {models.map((m, i) => (
          <Reveal key={m.id} index={i} className="h-full">
          <Link href={`/models/${encodeURIComponent(m.id)}`} className="group press block h-full">
            <Card className="lift flex h-full flex-col gap-4 p-4 group-hover:border-primary/50">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: PROVIDER_COLORS[m.provider] ?? 'var(--chart-1)' }}
                    aria-hidden
                  />
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground group-hover:text-primary">
                      {m.name}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{m.id}</span>
                  </div>
                </div>
                <ArrowUpRight className="size-4 -translate-x-1 translate-y-1 text-primary opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100" />
              </div>

              <div className="flex items-center gap-2">
                <ProviderBadge provider={m.provider} />
                <span className="text-xs text-muted-foreground">
                  {formatNumber(m.contextWindow)} ctx
                </span>
              </div>

              <div className="mt-auto grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
                <Metric label="Requests" value={formatNumber(m.requests)} />
                <Metric label="Spend" value={formatCurrency(m.cost)} />
                <Metric label="p95" value={formatLatency(m.p95Latency)} />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  ${m.inputPricePerM}/M in · ${m.outputPricePerM}/M out
                </span>
                <span className={m.errorRate > 0.02 ? 'text-destructive' : ''}>
                  {formatPercent(m.errorRate)} err
                </span>
              </div>
            </Card>
          </Link>
          </Reveal>
        ))}
        {models.length === 0 &&
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />
          ))}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-sm font-semibold text-foreground">{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Activity, CircleDollarSign, Timer, TriangleAlert } from 'lucide-react'
import { Card } from '@datum-cloud/datum-ui/card'
import { fetcher } from '@/lib/client'
import type { DataSourceInfo, Overview, TimeRange } from '@/lib/types'
import { PageHeader } from '@/components/page-header'
import { RangeSelector } from '@/components/range-selector'
import { StatCard } from '@/components/stat-card'
import { CostChart, LatencyChart, StatusPie, TokensChart, TrafficChart } from '@/components/charts'
import { TopModelsCard } from '@/components/top-models-card'
import { Reveal } from '@/components/reveal'
import {
  formatCurrency,
  formatLatency,
  formatNumber,
  formatPercent,
  formatSignedPercent,
} from '@/lib/format'

interface OverviewPayload {
  overview: Overview
  source: DataSourceInfo
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Card className="lift flex h-full flex-col gap-4 p-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-title text-base font-medium text-foreground">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </Card>
  )
}

export function OverviewView({ initial }: { initial?: OverviewPayload }) {
  const [range, setRange] = useState<TimeRange>('24h')
  const { data } = useSWR<OverviewPayload>(`/api/overview?range=${range}`, fetcher, {
    fallbackData: initial,
    keepPreviousData: true,
    refreshInterval: 30_000,
  })

  const o = data?.overview
  const t = o?.totals

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Overview"
        description="Traffic, spend, and health across your Envoy AI Gateway."
        actions={<RangeSelector value={range} onChange={setRange} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Reveal index={0}>
          <StatCard
            label="Requests"
            icon={Activity}
            value={t ? formatNumber(t.requests) : '—'}
            delta={o?.deltas.requests}
            deltaLabel={o ? formatSignedPercent(o.deltas.requests) : undefined}
          />
        </Reveal>
        <Reveal index={1}>
          <StatCard
            label="Total spend"
            icon={CircleDollarSign}
            value={t ? formatCurrency(t.cost) : '—'}
            delta={o?.deltas.cost}
            deltaLabel={o ? formatSignedPercent(o.deltas.cost) : undefined}
          />
        </Reveal>
        <Reveal index={2}>
          <StatCard
            label="Avg latency"
            icon={Timer}
            value={t ? formatLatency(t.avgLatency) : '—'}
            delta={o?.deltas.latency}
            deltaLabel={o ? formatSignedPercent(o.deltas.latency) : undefined}
            invertDelta
          />
        </Reveal>
        <Reveal index={3}>
          <StatCard
            label="Error rate"
            icon={TriangleAlert}
            value={t ? formatPercent(t.errorRate) : '—'}
            delta={o ? o.deltas.errorRate : undefined}
            deltaLabel={o ? formatSignedPercent(o.deltas.errorRate * 100) + ' pts' : undefined}
            invertDelta
          />
        </Reveal>
      </div>

      <Reveal fade delay={50} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="Requests over time" description="Successful requests vs errors">
            {o ? <TrafficChart series={o.series} /> : <ChartSkeleton />}
          </ChartCard>
        </div>
        <ChartCard title="Status codes" description="Response distribution">
          {o ? <StatusPie data={o.statusBreakdown} /> : <ChartSkeleton />}
        </ChartCard>
      </Reveal>

      <Reveal fade delay={90} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Spend over time" description="Estimated cost in USD">
          {o ? <CostChart series={o.series} /> : <ChartSkeleton />}
        </ChartCard>
        <ChartCard title="Latency" description="p50 and p95 response time">
          {o ? <LatencyChart series={o.series} /> : <ChartSkeleton />}
        </ChartCard>
      </Reveal>

      <Reveal fade delay={130} className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TopModelsCard models={o?.topModels ?? []} />
        </div>
        <ChartCard title="Token throughput" description="Input vs output tokens">
          {o ? <TokensChart series={o.series} /> : <ChartSkeleton />}
        </ChartCard>
      </Reveal>
    </div>
  )
}

function ChartSkeleton() {
  return <div className="h-[240px] w-full animate-pulse rounded-md bg-muted" />
}

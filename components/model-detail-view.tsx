'use client'

import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { ArrowLeft, Activity, CircleDollarSign, Gauge, Timer, TriangleAlert, Zap } from 'lucide-react'
import { Card } from '@datum-cloud/datum-ui/card'
import { fetcher } from '@/lib/client'
import type { ModelDetail, TimeRange } from '@/lib/types'
import { RangeSelector } from '@/components/range-selector'
import { StatCard } from '@/components/stat-card'
import { ProviderBadge, StatusBadge } from '@/components/status-badge'
import { CostChart, LatencyChart, LatencyHistogram, TrafficChart } from '@/components/charts'
import {
  formatCurrency,
  formatCurrencyPrecise,
  formatInt,
  formatLatency,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  PROVIDER_COLORS,
} from '@/lib/format'

interface DetailResponse {
  model: ModelDetail
}

function ChartCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="font-title text-base font-medium text-foreground">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </Card>
  )
}

export function ModelDetailView({ id, initial }: { id: string; initial?: DetailResponse }) {
  const [range, setRange] = useState<TimeRange>('24h')
  const { data, error } = useSWR<DetailResponse>(
    `/api/models/${encodeURIComponent(id)}?range=${range}`,
    fetcher,
    { fallbackData: initial, keepPreviousData: true },
  )

  const m = data?.model

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <p className="text-lg font-medium text-foreground">Model not found</p>
        <Link href="/models" className="text-sm text-primary hover:underline">
          Back to models
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href="/models"
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Models
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ background: m ? PROVIDER_COLORS[m.provider] ?? 'var(--chart-1)' : 'var(--muted)' }}
              aria-hidden
            />
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h1 className="font-title text-2xl font-semibold tracking-tight text-foreground">
                  {m?.name ?? id}
                </h1>
                {m && <ProviderBadge provider={m.provider} />}
              </div>
              <p className="font-mono text-sm text-muted-foreground">{id}</p>
            </div>
          </div>
          <RangeSelector value={range} onChange={setRange} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Requests" icon={Activity} value={m ? formatNumber(m.requests) : '—'} />
        <StatCard label="Spend" icon={CircleDollarSign} value={m ? formatCurrency(m.cost) : '—'} />
        <StatCard label="Avg latency" icon={Timer} value={m ? formatLatency(m.avgLatency) : '—'} />
        <StatCard label="p95 latency" icon={Gauge} value={m ? formatLatency(m.p95Latency) : '—'} />
        <StatCard label="Avg TTFT" icon={Zap} value={m ? formatLatency(m.avgTtft) : '—'} />
        <StatCard label="Tokens/sec" icon={Zap} value={m ? `${m.tokensPerSec}` : '—'} />
        <StatCard label="Total tokens" icon={Activity} value={m ? formatNumber(m.totalTokens) : '—'} />
        <StatCard
          label="Error rate"
          icon={TriangleAlert}
          value={m ? formatPercent(m.errorRate) : '—'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Requests over time" description="Successful requests vs errors">
          {m ? <TrafficChart series={m.series} /> : <Skeleton />}
        </ChartCard>
        <ChartCard title="Latency" description="p50 and p95 response time">
          {m ? <LatencyChart series={m.series} /> : <Skeleton />}
        </ChartCard>
        <ChartCard title="Spend over time" description="Estimated cost in USD">
          {m ? <CostChart series={m.series} /> : <Skeleton />}
        </ChartCard>
        <ChartCard title="Latency distribution" description="Request count by latency bucket">
          {m ? <LatencyHistogram data={m.latencyBuckets} /> : <Skeleton />}
        </ChartCard>
      </div>

      <Card className="flex flex-col gap-4 p-4">
        <h2 className="font-title text-base font-medium text-foreground">Recent requests</h2>
        <div className="flex flex-col divide-y divide-border">
          {m?.recentLogs.length ? (
            m.recentLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                <div className="flex items-center gap-3">
                  <StatusBadge status={log.status} code={log.statusCode} />
                  <span className="text-muted-foreground">{formatRelativeTime(log.timestamp)}</span>
                  <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
                    {log.requestId}
                  </span>
                </div>
                <div className="flex items-center gap-4 font-mono text-xs">
                  <span>{formatLatency(log.latencyMs)}</span>
                  <span className="hidden sm:inline">{formatInt(log.totalTokens)} tok</span>
                  <span>{formatCurrencyPrecise(log.cost)}</span>
                </div>
              </div>
            ))
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">No recent requests.</p>
          )}
        </div>
      </Card>
    </div>
  )
}

function Skeleton() {
  return <div className="h-[240px] w-full animate-pulse rounded-md bg-muted" />
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { ArrowDown, ArrowUp, ChevronRight, Minus } from 'lucide-react'
import { Card } from '@datum-cloud/datum-ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@datum-cloud/datum-ui/table'
import { fetcher } from '@/lib/client'
import type { ModelStat, TimeRange } from '@/lib/types'
import { PageHeader } from '@/components/page-header'
import { RangeSelector } from '@/components/range-selector'
import { ProviderBadge } from '@/components/status-badge'
import {
  formatCurrency,
  formatLatency,
  formatNumber,
  formatPercent,
  PROVIDER_COLORS,
} from '@/lib/format'

interface ModelsResponse {
  models: ModelStat[]
}

type SortKey = 'requests' | 'totalTokens' | 'cost' | 'avgLatency' | 'errorRate' | 'tokensPerSec'

const COLUMNS: { key: SortKey; label: string; format: (m: ModelStat) => string }[] = [
  { key: 'requests', label: 'Requests', format: (m) => formatNumber(m.requests) },
  { key: 'totalTokens', label: 'Tokens', format: (m) => formatNumber(m.totalTokens) },
  { key: 'cost', label: 'Spend', format: (m) => formatCurrency(m.cost) },
  { key: 'avgLatency', label: 'Avg latency', format: (m) => formatLatency(m.avgLatency) },
  { key: 'tokensPerSec', label: 'Tokens/s', format: (m) => `${m.tokensPerSec}` },
  { key: 'errorRate', label: 'Errors', format: (m) => formatPercent(m.errorRate) },
]

export function LeaderboardView({ initial }: { initial?: ModelsResponse }) {
  const [range, setRange] = useState<TimeRange>('24h')
  const [sortKey, setSortKey] = useState<SortKey>('requests')

  const { data } = useSWR<ModelsResponse>(`/api/models?range=${range}`, fetcher, {
    fallbackData: initial,
    keepPreviousData: true,
  })

  const models = [...(data?.models ?? [])]
    .filter((m) => m.requests > 0)
    .sort((a, b) => b[sortKey] - a[sortKey])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Model Leaderboard"
        description="Compare every model routed through the gateway by traffic, cost, and performance."
        actions={<RangeSelector value={range} onChange={setRange} />}
      />

      <Card className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12 text-center">#</TableHead>
              <TableHead>Model</TableHead>
              {COLUMNS.map((c) => (
                <TableHead key={c.key} className="text-right">
                  <button
                    type="button"
                    onClick={() => setSortKey(c.key)}
                    className={`inline-flex items-center gap-1 hover:text-foreground ${
                      sortKey === c.key ? 'text-foreground' : ''
                    }`}
                  >
                    {c.label}
                    {sortKey === c.key && <ArrowDown className="size-3" />}
                  </button>
                </TableHead>
              ))}
              <TableHead className="w-24 text-right">Trend</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.map((m, i) => (
              <TableRow key={m.id} className="group transition-colors">
                <TableCell className="text-center font-mono text-sm text-muted-foreground">
                  {i + 1}
                </TableCell>
                <TableCell>
                  <Link href={`/models/${encodeURIComponent(m.id)}`} className="flex items-center gap-2">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: PROVIDER_COLORS[m.provider] ?? 'var(--chart-1)' }}
                      aria-hidden
                    />
                    <span className="font-medium text-foreground group-hover:text-primary">
                      {m.name}
                    </span>
                    <ProviderBadge provider={m.provider} />
                  </Link>
                </TableCell>
                {COLUMNS.map((c) => (
                  <TableCell
                    key={c.key}
                    className={`text-right font-mono text-sm ${
                      c.key === 'errorRate' && m.errorRate > 0.02 ? 'text-destructive' : ''
                    }`}
                  >
                    {c.format(m)}
                  </TableCell>
                ))}
                <TableCell className="text-right">
                  <TrendPill value={m.trendPct} />
                </TableCell>
                <TableCell>
                  <Link
                    href={`/models/${encodeURIComponent(m.id)}`}
                    className="inline-flex text-muted-foreground transition-all duration-200 hover:text-foreground group-hover:translate-x-0.5"
                    aria-label={`View ${m.name} details`}
                  >
                    <ChevronRight className="size-4" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
            {models.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                  No model traffic in this range.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

function TrendPill({ value }: { value: number }) {
  const neutral = Math.abs(value) < 1
  const up = value > 0
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        neutral ? 'text-muted-foreground' : up ? 'text-chart-4' : 'text-destructive'
      }`}
    >
      {neutral ? (
        <Minus className="size-3" />
      ) : up ? (
        <ArrowUp className="size-3" />
      ) : (
        <ArrowDown className="size-3" />
      )}
      {Math.abs(value).toFixed(0)}%
    </span>
  )
}

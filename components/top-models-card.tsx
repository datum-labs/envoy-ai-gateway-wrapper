'use client'

import Link from 'next/link'
import { Card } from '@datum-cloud/datum-ui/card'
import { ArrowUpRight } from 'lucide-react'
import type { ModelStat } from '@/lib/types'
import { formatCurrency, formatNumber, PROVIDER_COLORS } from '@/lib/format'

export function TopModelsCard({ models }: { models: ModelStat[] }) {
  const max = Math.max(1, ...models.map((m) => m.requests))
  return (
    <Card className="lift flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h2 className="font-title text-base font-medium text-foreground">Top models</h2>
          <p className="text-xs text-muted-foreground">Ranked by request volume</p>
        </div>
        <Link
          href="/leaderboard"
          className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
        >
          Leaderboard
          <ArrowUpRight className="size-3" />
        </Link>
      </div>
      <div className="flex flex-col gap-3">
        {models.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">No traffic in range</p>
        )}
        {models.map((m) => (
          <Link
            key={m.id}
            href={`/models/${encodeURIComponent(m.id)}`}
            className="group flex flex-col gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-muted/60"
          >
            <div className="flex items-center justify-between gap-2 text-sm">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: PROVIDER_COLORS[m.provider] ?? 'var(--chart-1)' }}
                  aria-hidden
                />
                <span className="truncate font-medium text-foreground group-hover:text-primary">
                  {m.name}
                </span>
              </div>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {formatNumber(m.requests)} · {formatCurrency(m.cost)}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: `${(m.requests / max) * 100}%`,
                  background: PROVIDER_COLORS[m.provider] ?? 'var(--chart-1)',
                }}
              />
            </div>
          </Link>
        ))}
      </div>
    </Card>
  )
}

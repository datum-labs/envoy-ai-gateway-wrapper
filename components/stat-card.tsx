'use client'

import type { ComponentType } from 'react'
import { Card } from '@datum-cloud/datum-ui/card'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string
  icon: ComponentType<{ className?: string }>
  delta?: number
  deltaLabel?: string
  /** when true, a positive delta is bad (e.g. error rate, latency) */
  invertDelta?: boolean
  hint?: string
}

export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  deltaLabel,
  invertDelta = false,
  hint,
}: StatCardProps) {
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta)
  const positive = (delta ?? 0) >= 0
  const good = invertDelta ? !positive : positive
  const neutral = hasDelta && Math.abs(delta ?? 0) < 0.01

  return (
    <Card className="lift flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
          {value}
        </span>
        <div className="flex items-center gap-2">
          {hasDelta && (
            <span
              className={`inline-flex items-center gap-0.5 text-xs font-medium ${
                neutral
                  ? 'text-muted-foreground'
                  : good
                    ? 'text-chart-4'
                    : 'text-destructive'
              }`}
            >
              {!neutral &&
                (positive ? (
                  <ArrowUpRight className="size-3" />
                ) : (
                  <ArrowDownRight className="size-3" />
                ))}
              {deltaLabel}
            </span>
          )}
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
      </div>
    </Card>
  )
}

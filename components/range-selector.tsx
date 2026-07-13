'use client'

import type { TimeRange } from '@/lib/types'
import { RANGE_SHORT } from '@/lib/client'

const ORDER: TimeRange[] = ['1h', '24h', '7d', '30d']

export function RangeSelector({
  value,
  onChange,
}: {
  value: TimeRange
  onChange: (r: TimeRange) => void
}) {
  return (
    <div
      className="inline-flex items-center rounded-lg border border-border bg-card p-0.5"
      role="radiogroup"
      aria-label="Time range"
    >
      {ORDER.map((r) => {
        const active = value === r
        return (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(r)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {RANGE_SHORT[r]}
          </button>
        )
      })}
    </div>
  )
}

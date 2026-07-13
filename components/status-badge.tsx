import { Badge } from '@datum-cloud/datum-ui/badge'
import type { LogStatus } from '@/lib/types'

export function StatusBadge({ status, code }: { status: LogStatus; code: number }) {
  const ok = status === 'success'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
        ok
          ? 'bg-chart-4/15 text-chart-4'
          : 'bg-destructive/15 text-destructive'
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${ok ? 'bg-chart-4' : 'bg-destructive'}`}
        aria-hidden
      />
      {code}
    </span>
  )
}

export function ProviderBadge({ provider }: { provider: string }) {
  return (
    <Badge variant="secondary" className="font-normal">
      {provider}
    </Badge>
  )
}

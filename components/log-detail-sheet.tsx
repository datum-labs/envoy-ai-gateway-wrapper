'use client'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@datum-cloud/datum-ui/sheet'
import { Separator } from '@datum-cloud/datum-ui/separator'
import type { LogEntry } from '@/lib/types'
import { StatusBadge } from '@/components/status-badge'
import {
  formatCurrencyPrecise,
  formatDateTime,
  formatInt,
  formatLatency,
} from '@/lib/format'

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm text-foreground ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

export function LogDetailSheet({
  log,
  onOpenChange,
}: {
  log: LogEntry | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={!!log} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {log && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                Request detail
                <StatusBadge status={log.status} code={log.statusCode} />
              </SheetTitle>
              <SheetDescription className="font-mono text-xs">{log.requestId}</SheetDescription>
            </SheetHeader>
            <div className="flex flex-col px-4 pb-6">
              <p className="pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Request
              </p>
              <Row label="Timestamp" value={formatDateTime(log.timestamp)} />
              <Row label="Model" value={log.model} mono />
              <Row label="Provider" value={log.provider} />
              <Row label="Endpoint" value={log.endpoint} mono />
              <Row label="Region" value={log.region} />
              <Separator className="my-2" />
              <p className="pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Performance
              </p>
              <Row label="Total latency" value={formatLatency(log.latencyMs)} mono />
              <Row label="Time to first token" value={formatLatency(log.ttftMs)} mono />
              <Row label="Finish reason" value={log.finishReason} />
              <Separator className="my-2" />
              <p className="pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Usage
              </p>
              <Row label="Input tokens" value={formatInt(log.inputTokens)} mono />
              <Row label="Output tokens" value={formatInt(log.outputTokens)} mono />
              <Row label="Total tokens" value={formatInt(log.totalTokens)} mono />
              <Row label="Cost" value={formatCurrencyPrecise(log.cost)} mono />
              {log.errorMessage && (
                <>
                  <Separator className="my-2" />
                  <p className="pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-destructive">
                    Error
                  </p>
                  <p className="rounded-md bg-destructive/10 p-3 font-mono text-xs text-destructive">
                    {log.errorMessage}
                  </p>
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

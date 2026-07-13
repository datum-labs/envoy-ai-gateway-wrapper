'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Search } from 'lucide-react'
import { Card } from '@datum-cloud/datum-ui/card'
import { Input } from '@datum-cloud/datum-ui/input'
import { Button } from '@datum-cloud/datum-ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@datum-cloud/datum-ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@datum-cloud/datum-ui/table'
import { fetcher } from '@/lib/client'
import type { LogEntry, LogsResponse, TimeRange } from '@/lib/types'
import { PageHeader } from '@/components/page-header'
import { RangeSelector } from '@/components/range-selector'
import { StatusBadge } from '@/components/status-badge'
import { LogDetailSheet } from '@/components/log-detail-sheet'
import { formatCurrencyPrecise, formatInt, formatLatency, formatRelativeTime } from '@/lib/format'

interface MetaResponse {
  models: { id: string; name: string; provider: string }[]
  providers: string[]
}

export function LogsView({
  initialLogs,
  initialMeta,
}: {
  initialLogs?: LogsResponse
  initialMeta?: MetaResponse
}) {
  const [range, setRange] = useState<TimeRange>('24h')
  const [model, setModel] = useState('all')
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<LogEntry | null>(null)
  const pageSize = 20

  const { data: meta } = useSWR<MetaResponse>('/api/meta', fetcher, {
    fallbackData: initialMeta,
  })

  const params = new URLSearchParams({
    range,
    page: String(page),
    pageSize: String(pageSize),
    model,
    status,
    search,
  })
  const { data, isLoading } = useSWR<LogsResponse>(`/api/logs?${params}`, fetcher, {
    fallbackData: initialLogs,
    keepPreviousData: true,
  })

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  function resetPageThen<T>(setter: (v: T) => void) {
    return (v: T) => {
      setPage(1)
      setter(v)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Logs"
        description="Every request routed through the gateway, with token usage, latency, and cost."
        actions={<RangeSelector value={range} onChange={resetPageThen(setRange)} />}
      />

      <Card className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => resetPageThen(setSearch)(e.target.value)}
              placeholder="Search request ID, model, endpoint…"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-3">
            <Select value={model} onValueChange={resetPageThen(setModel)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Model" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All models</SelectItem>
                {meta?.models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={resetPageThen(setStatus)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">Latency</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && !data ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <div className="h-5 w-full animate-pulse rounded bg-muted" />
                    </TableCell>
                  </TableRow>
                ))
              ) : data && data.logs.length > 0 ? (
                data.logs.map((log) => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer transition-colors"
                    onClick={() => setSelected(log)}
                  >
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatRelativeTime(log.timestamp)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={log.status} code={log.statusCode} />
                    </TableCell>
                    <TableCell className="font-medium">{log.model}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatLatency(log.latencyMs)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatInt(log.totalTokens)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrencyPrecise(log.cost)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No requests match your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {total > 0
              ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${formatInt(total)}`
              : 'No results'}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </Card>

      <LogDetailSheet log={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  )
}

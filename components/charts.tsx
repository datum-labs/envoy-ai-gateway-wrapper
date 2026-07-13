'use client'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@datum-cloud/datum-ui/chart'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts'
import type { TimeseriesPoint } from '@/lib/types'
import { formatCurrency, formatLatency, formatNumber } from '@/lib/format'

const axisProps = {
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
  minTickGap: 24,
  className: 'text-xs',
}

export function TrafficChart({ series }: { series: TimeseriesPoint[] }) {
  const config = {
    requests: { label: 'Requests', color: 'var(--chart-1)' },
    errors: { label: 'Errors', color: 'var(--chart-5)' },
  }
  return (
    <ChartContainer config={config} className="aspect-auto h-[240px] w-full">
      <AreaChart data={series} margin={{ left: 4, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="fillRequests" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-requests)" stopOpacity={0.5} />
            <stop offset="95%" stopColor="var(--color-requests)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={36} tickFormatter={(v) => formatNumber(Number(v))} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          dataKey="requests"
          type="monotone"
          fill="url(#fillRequests)"
          stroke="var(--color-requests)"
          strokeWidth={2}
        />
        <Area
          dataKey="errors"
          type="monotone"
          fill="transparent"
          stroke="var(--color-errors)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
      </AreaChart>
    </ChartContainer>
  )
}

export function TokensChart({ series }: { series: TimeseriesPoint[] }) {
  const config = {
    inputTokens: { label: 'Input', color: 'var(--chart-2)' },
    outputTokens: { label: 'Output', color: 'var(--chart-1)' },
  }
  return (
    <ChartContainer config={config} className="aspect-auto h-[240px] w-full">
      <BarChart data={series} margin={{ left: 4, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={40} tickFormatter={(v) => formatNumber(Number(v))} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="inputTokens" stackId="t" fill="var(--color-inputTokens)" radius={[0, 0, 0, 0]} />
        <Bar dataKey="outputTokens" stackId="t" fill="var(--color-outputTokens)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}

export function LatencyChart({ series }: { series: TimeseriesPoint[] }) {
  const config = {
    latencyP50: { label: 'p50', color: 'var(--chart-4)' },
    latencyP95: { label: 'p95', color: 'var(--chart-3)' },
  }
  return (
    <ChartContainer config={config} className="aspect-auto h-[240px] w-full">
      <LineChart data={series} margin={{ left: 4, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={44} tickFormatter={(v) => formatLatency(Number(v))} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line dataKey="latencyP50" type="monotone" stroke="var(--color-latencyP50)" strokeWidth={2} dot={false} />
        <Line dataKey="latencyP95" type="monotone" stroke="var(--color-latencyP95)" strokeWidth={2} dot={false} />
      </LineChart>
    </ChartContainer>
  )
}

export function CostChart({ series }: { series: TimeseriesPoint[] }) {
  const config = { cost: { label: 'Spend', color: 'var(--chart-3)' } }
  return (
    <ChartContainer config={config} className="aspect-auto h-[240px] w-full">
      <AreaChart data={series} margin={{ left: 4, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="fillCost" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-cost)" stopOpacity={0.5} />
            <stop offset="95%" stopColor="var(--color-cost)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={48} tickFormatter={(v) => formatCurrency(Number(v))} />
        <ChartTooltip
          content={<ChartTooltipContent formatter={(v) => formatCurrency(Number(v))} />}
        />
        <Area
          dataKey="cost"
          type="monotone"
          fill="url(#fillCost)"
          stroke="var(--color-cost)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  )
}

export function StatusPie({
  data,
}: {
  data: { name: string; value: number }[]
}) {
  const colors: Record<string, string> = {
    '2xx': 'var(--chart-4)',
    '4xx': 'var(--chart-3)',
    '5xx': 'var(--chart-5)',
  }
  const config = {
    value: { label: 'Requests' },
    '2xx': { label: '2xx', color: 'var(--chart-4)' },
    '4xx': { label: '4xx', color: 'var(--chart-3)' },
    '5xx': { label: '5xx', color: 'var(--chart-5)' },
  }
  return (
    <ChartContainer config={config} className="mx-auto aspect-square h-[220px]">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} strokeWidth={2}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={colors[entry.name]} className="stroke-background" />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  )
}

export function LatencyHistogram({
  data,
}: {
  data: { bucket: string; count: number }[]
}) {
  const config = { count: { label: 'Requests', color: 'var(--chart-1)' } }
  return (
    <ChartContainer config={config} className="aspect-auto h-[220px] w-full">
      <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
        <XAxis dataKey="bucket" {...axisProps} />
        <YAxis {...axisProps} width={36} tickFormatter={(v) => formatNumber(Number(v))} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}

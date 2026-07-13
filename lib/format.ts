export function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return `${Math.round(n)}`
}

export function formatInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(n))
}

export function formatCurrency(n: number): string {
  if (n >= 1000) return `$${formatNumber(n)}`
  return `$${n.toFixed(2)}`
}

export function formatCurrencyPrecise(n: number): string {
  if (n < 0.01 && n > 0) return `$${n.toFixed(5)}`
  return `$${n.toFixed(n < 1 ? 4 : 2)}`
}

export function formatLatency(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
  return `${Math.round(ms)}ms`
}

export function formatPercent(fraction: number, digits = 2): string {
  return `${(fraction * 100).toFixed(digits)}%`
}

export function formatSignedPercent(pct: number, digits = 1): string {
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(digits)}%`
}

export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export const PROVIDER_COLORS: Record<string, string> = {
  OpenAI: 'var(--chart-1)',
  Anthropic: 'var(--chart-3)',
  Meta: 'var(--chart-2)',
  Mistral: 'var(--chart-5)',
  Google: 'var(--chart-4)',
  DeepSeek: 'var(--chart-2)',
}

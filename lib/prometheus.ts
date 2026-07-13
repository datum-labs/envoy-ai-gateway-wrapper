// Minimal Prometheus text-exposition-format parser.
// Envoy AI Gateway exposes metrics such as:
//   gen_ai_client_token_usage_total{gen_ai_request_model="gpt-4o",...} 1234
//   gen_ai_server_request_duration_seconds_bucket{le="0.5",...} 42
// This parser turns the raw text into structured samples so a live
// deployment can be wired up without changing the UI layer.

export interface PromSample {
  name: string
  labels: Record<string, string>
  value: number
}

function parseLabels(raw: string): Record<string, string> {
  const labels: Record<string, string> = {}
  if (!raw) return labels
  const re = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw))) {
    labels[m[1]] = m[2].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\')
  }
  return labels
}

export function parsePrometheus(text: string): PromSample[] {
  const samples: PromSample[] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{[^}]*\})?\s+(.+)$/)
    if (!match) continue
    const value = Number(match[3].split(/\s+/)[0])
    if (Number.isNaN(value)) continue
    samples.push({
      name: match[1],
      labels: parseLabels(match[2] ? match[2].slice(1, -1) : ''),
      value,
    })
  }
  return samples
}

export function sumBy(samples: PromSample[], name: string, labelKey?: string) {
  const out = new Map<string, number>()
  for (const s of samples) {
    if (s.name !== name) continue
    const key = labelKey ? s.labels[labelKey] ?? 'unknown' : '_total'
    out.set(key, (out.get(key) ?? 0) + s.value)
  }
  return out
}

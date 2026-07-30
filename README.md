## What this is

This is a read-only console that sits in front of an [Envoy AI Gateway](https://aigateway.envoyproxy.io/) and shows you what's going through it: how many requests, how much you're spending, how fast responses come back, and which models are getting used. It also has a playground for sending test prompts through the gateway.

All dashboard numbers and Playground traffic come from a live gateway. There is no built-in demo dataset — configure URL + token before expecting data.

## Pages

- **Overview** — request volume, total spend, average latency, and error rate, plus charts for traffic, cost, latency, token throughput, and status codes.
- **Logs** — every request as a filterable table. Filter by model, status, or search text, and click a row to see the full request/response detail.
- **Leaderboard** — models ranked by requests, spend, latency, or error rate.
- **Models** — a card per model with its key stats, and a detail page for each one.
- **Playground** — a chat interface that proxies prompts through your gateway.

## Running it locally

You'll need Node 18+ and pnpm.

```bash
pnpm install
cp .env.example .env.local   # then fill in gateway URL + token
pnpm dev
```

That starts the app on `http://localhost:3000`. Without gateway env vars the shell still loads, but pages stay empty and Playground chat returns 503.

## Connecting a real gateway

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

| Variable                       | Required | What it does                                                                                                          |
| ------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------- |
| `ENVOY_AI_GATEWAY_URL`         | Yes*     | Base URL of your gateway (no path).                                                                                   |
| `ENVOY_AI_GATEWAY_API_KEY`     | Yes*     | Bearer token sent with gateway and metrics requests (local Dex JWT).                                                  |
| `ENVOY_AI_GATEWAY_TOKEN_FILE`  | Yes*     | Path to a projected SA token file; used when `ENVOY_AI_GATEWAY_API_KEY` is unset.                                     |
| `ENVOY_AI_GATEWAY_MODEL`       | No       | Preferred Playground model id when it appears in the gateway catalog.                                                 |
| `ENVOY_AI_GATEWAY_METRICS_URL` | No       | Prometheus/VictoriaMetrics base URL (PromQL) or a raw `/metrics` scrape URL. Powers Overview, Models, and Leaderboard. |

\* Live mode requires `ENVOY_AI_GATEWAY_URL` plus either `ENVOY_AI_GATEWAY_API_KEY` or `ENVOY_AI_GATEWAY_TOKEN_FILE`.

In live mode the Playground discovers models from both `/v1/models` (OpenAI-compatible) and `/anthropic/v1/models`, then routes each chat request on the matching protocol — the same dual-catalog approach as staff-portal.

Dashboard pages query `gen_ai_*` Prometheus series (token usage, request duration, time-to-first-token). If `ENVOY_AI_GATEWAY_METRICS_URL` is unset, the console tries `${ENVOY_AI_GATEWAY_URL}/metrics`. Datum’s public AI hostname does not expose that path — set `ENVOY_AI_GATEWAY_METRICS_URL` to your Prometheus/VictoriaMetrics base (or a port-forward to the extproc admin port). Without a reachable metrics backend, Overview/Models/Leaderboard show zeros. Spend and list prices stay at zero until the gateway exposes pricing.

## Deploying

Push to a Git repo and import it into Vercel, or use the CLI:

```bash
pnpm build   # check the production build locally first
```

Add the gateway environment variables under **Settings → Environment Variables** in your Vercel project.

### Docker

The repo ships with a multi-stage `Dockerfile` that uses Next.js [standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output), so the final image only contains the files the app actually needs.

```bash
docker build -t envoy-ai-gateway-console .
docker run -p 3000:3000 \
  -e ENVOY_AI_GATEWAY_URL=https://your-gateway.example.com \
  -e ENVOY_AI_GATEWAY_API_KEY=your-token \
  envoy-ai-gateway-console
```

Or with an env file: `docker run -p 3000:3000 --env-file .env.local envoy-ai-gateway-console`.

## How it's built

- [Next.js 16](https://nextjs.org/) with the App Router and Cache Components enabled.
- [Datum UI](https://www.npmjs.com/package/@datum-cloud/datum-ui) for the logo, theming, and base components, on top of [shadcn/ui](https://ui.shadcn.com/).
- [Tailwind CSS v4](https://tailwindcss.com/) for styling.
- [SWR](https://swr.vercel.app/) for data fetching, with [Recharts](https://recharts.org/) for the charts.

Each page renders its shell right away and streams data into the cards independently, so navigation feels like a single-page app rather than waiting on a raw full-page load. The API routes read through a cached data layer (`lib/data.ts`) using the `use cache` directive.

## Project layout

```
app/
  (dashboard)/        Overview, logs, leaderboard, models, playground
  api/                Route handlers backed by the cached data layer
components/            Views, cards, charts, and the app shell
  playground/         Chat hook + assistant config for the Playground
lib/
  data.ts             Cached data functions (use cache)
  ai-gateway.ts       Dual-protocol gateway client (models + auth + AI SDK)
  live-metrics.ts     PromQL / scrape → overview & models
  gateway.ts          Auth helpers, logs stub, data-source labels
```

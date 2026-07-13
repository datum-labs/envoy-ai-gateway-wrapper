## What this is

This is a read-only console that sits in front of an [Envoy AI Gateway](https://aigateway.envoyproxy.io/) and shows you what's going through it: how many requests, how much you're spending, how fast responses come back, and which models are getting used. It also has a playground for sending test prompts through the gateway.

It runs in demo mode out of the box. Point it at a real gateway when you're ready, no code changes needed.

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
pnpm dev
```

That starts the app on `http://localhost:3000` in demo mode with deterministic sample data. Nothing else to configure.

## Connecting a real gateway

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

| Variable                       | Required | What it does                                                                                                          |
| ------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------- |
| `ENVOY_AI_GATEWAY_URL`         | No       | Base URL of your gateway's OpenAI-compatible endpoint. Setting this switches the console from demo mode to live mode. |
| `ENVOY_AI_GATEWAY_API_KEY`     | No       | Bearer token sent with gateway and metrics requests.                                                                  |
| `ENVOY_AI_GATEWAY_METRICS_URL` | No       | Override for the Prometheus metrics endpoint. Defaults to `${ENVOY_AI_GATEWAY_URL}/metrics`.                          |

All three are optional. Leave them blank and you stay in demo mode.

## Deploying

Push to a Git repo and import it into Vercel, or use the CLI:

```bash
pnpm build   # check the production build locally first
```

If you're connecting a live gateway, add the same environment variables under **Settings → Environment Variables** in your Vercel project.

## How it's built

- [Next.js 16](https://nextjs.org/) with the App Router and Cache Components enabled.
- [Datum UI](https://www.npmjs.com/package/@datum-cloud/datum-ui) for the logo, theming, and base components, on top of [shadcn/ui](https://ui.shadcn.com/).
- [Tailwind CSS v4](https://tailwindcss.com/) for styling.
- [SWR](https://swr.vercel.app/) for data fetching, with [Recharts](https://recharts.org/) for the charts.

Each page renders its shell right away and streams data into the cards independently, so navigation feels like a single-page app rather than waiting on a full-page load. The API routes read through a cached data layer (`lib/data.ts`) using the `use cache` directive.

## Project layout

```
app/
  (dashboard)/        Overview, logs, leaderboard, models, playground
  api/                Route handlers backed by the cached data layer
components/            Views, cards, charts, and the app shell
lib/
  data.ts             Cached data functions (use cache)
  gateway.ts          Demo vs. live gateway logic
  aggregate.ts        Metric aggregation
```

## A note on the data

In demo mode the numbers are generated from a fixed seed, so they look realistic and stay consistent between reloads, but they aren't real. Once you connect a gateway, the console pulls live request data and Prometheus metrics instead.

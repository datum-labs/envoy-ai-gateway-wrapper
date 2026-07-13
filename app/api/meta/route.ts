import { NextResponse } from 'next/server'
import { getMetaData } from '@/lib/data'

// The live/demo decision reads ENVOY_AI_GATEWAY_URL at runtime; without this,
// cacheComponents prerenders this route at build time (env unset) and bakes in
// the demo catalog. Force per-request evaluation so it reflects the deployment.
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(await getMetaData())
}

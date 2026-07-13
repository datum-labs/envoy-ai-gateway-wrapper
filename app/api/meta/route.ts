import { NextResponse, connection } from 'next/server'
import { getMetaData } from '@/lib/data'

export async function GET() {
  // The live/demo decision reads ENVOY_AI_GATEWAY_URL at runtime. Under
  // cacheComponents this route would otherwise be prerendered at build time
  // (env unset) and bake in the demo catalog; connection() opts into
  // per-request evaluation so it reflects the deployment.
  await connection()
  return NextResponse.json(await getMetaData())
}

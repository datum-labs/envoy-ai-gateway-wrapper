import { NextResponse } from 'next/server'
import { getMetaData } from '@/lib/data'

export async function GET() {
  return NextResponse.json(await getMetaData())
}

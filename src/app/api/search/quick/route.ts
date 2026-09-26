import type { NextRequest } from 'next/server';
import { ok } from '@/lib/api-helpers';
import { quickSearch } from '@/server/services/catalog.service';

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get('q') ?? '';
  const hits = await quickSearch(q);
  return ok({ hits });
}

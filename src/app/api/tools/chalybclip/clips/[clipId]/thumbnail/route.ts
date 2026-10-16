// GET /api/tools/chalybclip/clips/{clipId}/thumbnail — streamed from the engine
// (Range-aware), so the browser never calls it directly.

import { clipBytes } from '@/lib/tools/adapters/clips/editor-bytes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ clipId: string }> },
): Promise<Response> {
  return clipBytes(req, (await params).clipId, 'thumbnail');
}

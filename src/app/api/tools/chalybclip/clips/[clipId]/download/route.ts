// GET /api/tools/chalybclip/clips/{clipId}/download — a stable hub URL for the
// clip's export (once rendered): redirects to a fresh short-lived signed engine link (the
// browser loads the bytes from the engine, never through the hub).

import { clipMediaRedirect } from '@/lib/tools/adapters/clips/editor-bytes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ clipId: string }> },
): Promise<Response> {
  return clipMediaRedirect(req, (await params).clipId, 'download');
}

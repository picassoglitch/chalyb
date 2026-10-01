// Download endpoint for the mock Clips adapter's clips. Only exists in mock
// mode, and only serves the signed-in owner's jobs. The file is a stand-in, so
// "Descargar" can be exercised end to end before real clips exist.

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { clipsHubMode } from '@/lib/config/flags';
import { getClipsAdapter } from '@/lib/tools/adapters/clips';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ job: string; n: string }> },
) {
  if (clipsHubMode() !== 'mock') return new NextResponse(null, { status: 404 });
  const session = await getSessionUser();
  if (!session) return new NextResponse(null, { status: 401 });
  const { job: jobId, n } = await params;
  const job = await getClipsAdapter()?.getJob(session.user.id, jobId);
  const clip = job?.state === 'ready' ? job.clips[Number(n) - 1] : undefined;
  if (!clip) return new NextResponse(null, { status: 404 });
  return new NextResponse(`mock clip ${clip.id} · ${clip.durationSec}s · ${job!.format}\n`, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${clip.id}.txt"`,
    },
  });
}

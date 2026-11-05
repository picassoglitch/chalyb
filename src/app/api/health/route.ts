// Public liveness only. Dependency readiness is protected at /api/ready.
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(
    { status: 'ok', service: 'chalyb', check: 'liveness' },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}

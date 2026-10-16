// /api/tools/chalybclip/publish/** — the Publish Center (/app/clips/publicar)
// talks to the Clips engine's Zernio publishing API only through here. The
// allowlist and the gates live in src/lib/tools/adapters/clips/publish-*.ts.

import { publishHandler } from '@/lib/tools/adapters/clips/publish-route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Publishing renders the clip first when it isn't cached; bulk and
// "reprocesar" work through several clips. The BFF allows those calls a few
// minutes (PUBLISH_LONG_TIMEOUT_MS); the function must outlive them.
export const maxDuration = 300;

export const GET = publishHandler('GET');
export const POST = publishHandler('POST');

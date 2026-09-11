import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Per-engine tab icon. A file-based icon (src/app/icon.svg) overrides any
// `metadata.icons` we'd set in generateMetadata, so the only way to give the
// ChalybClip workspace its own favicon is this code-generated icon route, which
// receives the dynamic `slug` and branches on it. Every other engine keeps the
// global Chalyb mark so nothing else regresses.

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default async function Icon({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const isChalybclip = slug === 'chalybclip';
  const filePath = isChalybclip
    ? join(process.cwd(), 'public', 'chalybclip-mark.png')
    : join(process.cwd(), 'src', 'app', 'icon.svg');
  const mime = isChalybclip ? 'image/png' : 'image/svg+xml';
  const data = await readFile(filePath);
  const src = `data:${mime};base64,${data.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: '100%',
          background: '#03040b',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse (Satori) only supports raw <img>, not next/image */}
        <img src={src} width={64} height={64} alt="" />
      </div>
    ),
    { ...size },
  );
}

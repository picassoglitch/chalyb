import { getPublicFleet } from '@/lib/data/public-engines';

export const dynamic = 'force-dynamic';

// Human-readable twin of /api/health.
export default async function HealthPage() {
  const fleet = await getPublicFleet();
  return (
    <pre className="p-8 font-mono text-sm">
      {`chalyb: ok
kit: ${fleet.ready} ready · ${fleet.upcoming} upcoming${fleet.fromCatalog ? '' : ' · catalog unreachable'}
${fleet.engines.map((e) => `${e.ready ? '●' : '○'} ${e.name} — ${e.ready ? 'ready' : 'coming soon'}`).join('\n')}`}
    </pre>
  );
}

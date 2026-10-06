import manifest from '../../../../public/chalito/showcase/manifest.json';

/** One real render of the runtime (public/chalito/showcase, copied from Chalito's render-showcase). */
export interface ShowcaseAsset {
  id: string;
  /** Public path, e.g. "/chalito/showcase/hero-chalito.webp". */
  src: string;
  /** The still frame shown instead of the animation under reduced motion. */
  poster: string | null;
  w: number;
  h: number;
  alt: { es: string; en: string };
}

interface ManifestEntry {
  id: string;
  file: string;
  poster?: string;
  w: number;
  h: number;
  alt: { es: string; en: string };
}

/** A render by id. Called at module scope, so an id missing from the manifest fails the build. */
export const showcase = (id: string): ShowcaseAsset => {
  const a = (manifest.assets as ManifestEntry[]).find((x) => x.id === id);
  if (!a) throw new Error(`showcase asset "${id}" is not in public/chalito/showcase/manifest.json`);
  return {
    id: a.id,
    src: `/chalito/${a.file}`,
    poster: a.poster ? `/chalito/${a.poster}` : null,
    w: a.w,
    h: a.h,
    alt: a.alt,
  };
};

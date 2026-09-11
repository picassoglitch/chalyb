'use client';

import Image from 'next/image';
import {
  CandlestickChart,
  Video,
  Radio,
  Bot,
  Target,
  Home,
  TrendingUp,
  Boxes,
  type LucideIcon,
} from 'lucide-react';

// Engine glyphs as crisp vector icons (lucide) instead of emoji — emoji render
// inconsistently across OS/fonts (the old ✂ / 📊 / 🎥 showed as tofu boxes).
// Mapped by slug, with a neutral fallback for any engine we haven't styled yet.
// Color comes from the parent via `currentColor`, so the card tints per state.
//
// ChalybClip is the exception: it has a real brand mark (public/chalybclip-mark.png),
// so we render the logo tile filling the parent box instead of a lucide glyph.
// The mark carries its own dark background, so the parent's tint shows only as a
// thin frame. The parent box must be `relative` (and is square + overflow-hidden)
// for the `fill` image to lay out correctly.

const BY_SLUG: Record<string, LucideIcon> = {
  chalybcrypto: CandlestickChart,
  chalybtrade: TrendingUp,
  chalybobs: Video,
  chalybstream: Radio,
  chalybbot: Bot,
  chalybpicks: Target,
  chalybrealtor: Home,
};

export function EngineGlyph({
  slug,
  size = 22,
  className,
}: {
  slug: string;
  size?: number;
  className?: string;
}) {
  if (slug === 'chalybclip') {
    return (
      <Image
        src="/chalybclip-mark.png"
        alt=""
        aria-hidden
        fill
        sizes="64px"
        className={`object-cover ${className ?? ''}`}
      />
    );
  }
  const Icon = BY_SLUG[slug] ?? Boxes;
  return <Icon size={size} strokeWidth={1.75} className={className} aria-hidden />;
}

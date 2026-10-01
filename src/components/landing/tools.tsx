import type { Route } from 'next';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, Check } from 'lucide-react';
import { Link } from '@/i18n/routing';
import type { PublicTool } from '@/lib/tools/public-tools';
import { ToolTile } from './tool-tile';
import { SectionHead } from './section-head';

// 2 · Herramientas (#herramientas): one card per ACTIVE tool, then "Tu idea".

export async function ToolsSection({ tools }: { tools: PublicTool[] }) {
  const t = await getTranslations('landing.tools');
  return (
    <section id="herramientas" className="pub-band pub-band--white" aria-labelledby="tools-title">
      <div className="pub-wrap">
        <SectionHead id="tools-title" label={t('label')} title={t('title')} sub={t('sub')} />
        <ul className="pub-tg">
          {tools.map((tool) => (
            <li key={tool.slug} className="pub-tc">
              <ToolTile slug={tool.slug} color={tool.color} size={56} />
              <h3>{tool.name}</h3>
              <p>{t(`desc.${tool.slug}`)}</p>
              <span className="pub-tc__inc">
                <Check aria-hidden="true" />
                {t('included')}
              </span>
            </li>
          ))}
          <li className="pub-tc pub-tc--idea">
            <ToolTile slug="idea" color="#E8A600" size={56} />
            <h3>{t('ideaTitle')}</h3>
            <p>{t('ideaSub')}</p>
            <Link href={'/#idea' as Route} className="pub-tc__inc">
              {t('ideaCta')}
              <ArrowRight aria-hidden="true" />
            </Link>
          </li>
        </ul>
      </div>
    </section>
  );
}

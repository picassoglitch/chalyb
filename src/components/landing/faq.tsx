import { getTranslations } from 'next-intl/server';
import { ChevronDown } from 'lucide-react';
import { PRICING } from '@/config/pricing';
import { cfdiEnabled, supportWhatsappUrl } from '@/lib/config/flags';
import { toolList, type PublicTool } from '@/lib/tools/public-tools';
import { SectionHead } from './section-head';

// 8 · Preguntas (#preguntas). The WhatsApp line needs SUPPORT_WHATSAPP_URL and
// "¿Me dan factura?" needs CFDI_ENABLED (P4-5); the reminder days and the
// tool list come from config and the active tools.

export async function Faq({ tools, locale }: { tools: PublicTool[]; locale: string }) {
  const t = await getTranslations('landing.faq');
  const whatsapp = supportWhatsappUrl();
  const items: Array<{ q: string; a: string; extra?: string }> = [
    { q: t('q1'), a: t('a1', { dias: PRICING.trial.days }) },
    { q: t('q2'), a: t('a2'), extra: whatsapp ? t('a2help') : undefined },
    { q: t('q3'), a: t('a3', { lista: toolList(tools, locale) }) },
    { q: t('q4'), a: t('a4') },
    { q: t('q5'), a: t('a5') },
    ...(cfdiEnabled() ? [{ q: t('q6'), a: t('a6') }] : []),
  ];

  return (
    <section id="preguntas" className="pub-band pub-band--white" aria-labelledby="faq-title">
      <div className="pub-wrap">
        <SectionHead id="faq-title" label={t('label')} title={t('title')} />
        <div className="pub-faq">
          {items.map((item) => (
            <details key={item.q} className="pub-fq">
              <summary>
                {item.q}
                <ChevronDown aria-hidden="true" />
              </summary>
              <p>
                {item.a}
                {item.extra && (
                  <>
                    {' '}
                    <a
                      href={whatsapp!}
                      className="ch-lnk"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {item.extra}
                    </a>
                  </>
                )}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

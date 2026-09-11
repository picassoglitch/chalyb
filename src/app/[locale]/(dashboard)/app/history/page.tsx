import { setRequestLocale } from 'next-intl/server';

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="cc-scroll">
      <div
        style={{
          padding: '60px 24px',
          border: '1px dashed var(--cc-line-2)',
          borderRadius: 'var(--cc-r-l)',
          textAlign: 'center',
          color: 'var(--cc-txt-3)',
          fontSize: 14,
          lineHeight: 1.65,
        }}
      >
        Aún no tienes nada en tu historial.
        <br />
        <span
          style={{
            color: 'var(--cc-txt-4)',
            fontSize: 12,
            fontFamily: 'var(--cc-mono), monospace',
          }}
        >
          Cuando corras tu primer sistema, en prueba o en vivo, aquí vas a ver cada trabajo, sus
          logs y cómo salió.
        </span>
      </div>
    </div>
  );
}

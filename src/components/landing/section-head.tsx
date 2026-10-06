/** Centered section header: label, h2, optional sub (mockup 10 `.shd`). */
export function SectionHead({
  id,
  label,
  title,
  sub,
}: {
  id: string;
  label?: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="pub-shd">
      {label && <p className="ch-label">{label}</p>}
      <h2 id={id}>{title}</h2>
      {sub && <p>{sub}</p>}
    </div>
  );
}

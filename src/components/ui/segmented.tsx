// Segmented choice (3 · 6 · 10) built on native radios, so it works with the
// keyboard and inside plain forms with no JavaScript.

export function Segmented<T extends string | number>({
  name,
  options,
  defaultValue,
  legend,
}: {
  name: string;
  options: { value: T; label: string }[];
  defaultValue: T;
  legend: string;
}) {
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <legend className="ch-sr">{legend}</legend>
      <div className="ch-seg">
        {options.map((o) => (
          <label key={String(o.value)}>
            <input
              type="radio"
              name={name}
              value={o.value}
              defaultChecked={o.value === defaultValue}
            />
            <span className="ch-chip">{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

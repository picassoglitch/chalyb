// Labelled input (h62, radius 16, accent focus halo).

export function Field({
  id,
  label,
  hint,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; hint?: string }) {
  return (
    <div className="ch-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className="ch-input"
        aria-describedby={hint ? `${id}-hint` : undefined}
        {...input}
      />
      {hint && (
        <p id={`${id}-hint`} className="ch-muted" style={{ fontSize: 16, marginTop: 8 }}>
          {hint}
        </p>
      )}
    </div>
  );
}

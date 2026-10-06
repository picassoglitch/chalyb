'use client';

// 56×34 switch, a real button with role="switch" (rebuild prompt §5).

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className="ch-switch"
      onClick={() => onChange(!checked)}
    />
  );
}

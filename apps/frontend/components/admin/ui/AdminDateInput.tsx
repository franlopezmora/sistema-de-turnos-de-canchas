import { CalendarDays } from 'lucide-react';

type AdminDateInputProps = {
  value: string;            // YYYY-MM-DD
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Styled native date input.
 *
 * Renders a visible button with a CalendarDays icon and the formatted date
 * (or a placeholder). An invisible <input type="date"> sits on top so the
 * native date picker opens on click without any library.
 */
export default function AdminDateInput({
  value,
  onChange,
  min,
  max,
  placeholder = 'Seleccionar fecha',
  disabled = false,
  className = '',
}: AdminDateInputProps) {
  const displayValue = value
    ? (() => {
        // Format YYYY-MM-DD → DD/MM/YYYY without timezone shifting
        const [y, m, d] = value.split('-');
        return `${d}/${m}/${y}`;
      })()
    : '';

  return (
    <div
      className={`relative flex h-10 items-center rounded-xl border border-[#dce2ee] bg-white px-3 transition-all focus-within:border-[#3053e2] ${disabled ? 'pointer-events-none opacity-50' : ''} ${className}`}
    >
      <CalendarDays size={14} className="mr-2 shrink-0 text-[#8b95aa]" />
      <span
        className={`pointer-events-none flex-1 truncate text-[13px] ${displayValue ? 'text-[#1f2638]' : 'text-[#8b93a5]'}`}
      >
        {displayValue || placeholder}
      </span>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label={placeholder}
      />
    </div>
  );
}

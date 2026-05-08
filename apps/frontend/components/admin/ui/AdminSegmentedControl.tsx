type AdminSegmentedOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type AdminSegmentedControlProps = {
  options: AdminSegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
};

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

export default function AdminSegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: AdminSegmentedControlProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cx('inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-p-border bg-p-surface p-1 whitespace-nowrap', className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cx(
              'h-9 rounded-lg px-3 text-[12px] font-semibold transition outline-none focus-visible:ring-2 focus-visible:ring-lima-300/40',
              active ? 'bg-p-positive-bg text-p-accent' : 'text-p-text-muted hover:bg-p-surface-2',
              option.disabled && 'cursor-not-allowed opacity-45 hover:bg-transparent'
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

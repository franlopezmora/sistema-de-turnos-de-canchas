type AdminModuleTab = {
  value: string;
  label: string;
  comingSoon?: boolean;
};

type AdminModuleTabsProps = {
  tabs: AdminModuleTab[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
};

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

export default function AdminModuleTabs({
  tabs,
  value,
  onChange,
  ariaLabel,
  className,
}: AdminModuleTabsProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cx(
        'inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-[#dce2ee] bg-white p-1 whitespace-nowrap',
        className
      )}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cx(
              'inline-flex h-9 items-center gap-1 rounded-lg px-3 text-[12px] font-semibold transition outline-none focus-visible:ring-2 focus-visible:ring-[#cfd9ff]',
              active ? 'bg-[#edf1ff] text-[#3053e2]' : 'text-[#6f7890] hover:bg-[#f8f9fd]'
            )}
          >
            <span>{tab.label}</span>
            {tab.comingSoon && (
              <span className="rounded bg-[#eef1ff] px-1.5 py-[1px] text-[9px] uppercase tracking-wide text-[#4c5ec6]">
                Proximamente
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

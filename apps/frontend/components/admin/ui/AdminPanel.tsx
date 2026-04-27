import type { ReactNode } from 'react';

type AdminPanelProps = {
  children: ReactNode;
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
};

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

export default function AdminPanel({
  children,
  title,
  description,
  actions,
  className,
  bodyClassName,
}: AdminPanelProps) {
  return (
    <section className={cx('rounded-xl border border-[#dce2ee] bg-white shadow-[0_8px_26px_rgba(34,42,68,0.05)]', className)}>
      {(title || description || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eef2f8] px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-[13px] font-semibold text-[#1f2638]">{title}</h2>}
            {description && <p className="mt-1 text-[12px] text-[#6f7890]">{description}</p>}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </header>
      )}
      <div className={cx('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

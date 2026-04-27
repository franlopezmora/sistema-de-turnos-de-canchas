import type { ReactNode } from 'react';

type AdminPageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export default function AdminPageHeader({ eyebrow, title, description, actions }: AdminPageHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-wide text-[#3053e2]">{eyebrow}</p>}
        <h1 className="mt-1 text-[22px] font-semibold text-[#1f2638]">{title}</h1>
        {description && <p className="mt-1 max-w-[780px] text-[13px] leading-5 text-[#6f7890]">{description}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
  );
}

import type { ReactNode } from 'react';

type AdminEmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export default function AdminEmptyState({ title, description, action }: AdminEmptyStateProps) {
  return (
    <div className="grid min-h-[220px] place-items-center rounded-xl border border-dashed border-[#cfd8e8] bg-[#f8f9fd] px-4 py-8 text-center">
      <div className="max-w-[360px]">
        <p className="text-[15px] font-bold text-[#26314a]">{title}</p>
        {description && <p className="mt-2 text-[13px] leading-5 text-[#6f7890]">{description}</p>}
        {action && <div className="mt-4 flex justify-center">{action}</div>}
      </div>
    </div>
  );
}

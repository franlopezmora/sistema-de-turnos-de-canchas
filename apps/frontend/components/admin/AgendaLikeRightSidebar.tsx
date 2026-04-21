import type { ReactNode } from 'react';
import { X } from 'lucide-react';

type AgendaLikeRightSidebarProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  statusChip?: ReactNode;
  statusChipClassName?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClassName?: string;
};

export default function AgendaLikeRightSidebar({
  open,
  onClose,
  title,
  subtitle,
  statusChip,
  statusChipClassName = '',
  children,
  footer,
  maxWidthClassName = 'max-w-[620px]',
}: AgendaLikeRightSidebarProps) {
  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Cerrar panel"
          className="fixed left-0 right-0 bottom-0 top-16 z-[2147483200] bg-[#101326]/20 lg:left-[192px] lg:rounded-tl-[12px]"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 right-0 top-16 z-[2147483300] w-full ${maxWidthClassName} border-l border-[#e6e8ee] bg-white transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="relative h-full w-full flex flex-col">
          <header className="border-b border-[#eef0f5] px-6 py-5 flex items-start justify-between">
            <div>
              <h2 className="text-[24px] leading-none font-semibold text-[#1f2638] tracking-[-0.015em]">
                {title}
              </h2>
              {subtitle ? <p className="mt-3 text-[13px] leading-snug text-[#7d879d]">{subtitle}</p> : null}
              {statusChip ? (
                <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${statusChipClassName}`}>
                  {statusChip}
                </span>
              ) : null}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="h-9 w-9 rounded-full border border-[#e4e7ee] text-[#798194] grid place-items-center hover:bg-[#f7f8fb] shrink-0"
              aria-label="Cerrar"
            >
              <X size={16} />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>

          {footer ? <footer className="border-t border-[#eef0f5] bg-white p-4">{footer}</footer> : null}
        </div>
      </aside>
    </>
  );
}

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

type AdminSidebarTab = {
  id: string;
  label: string;
};

type AdminSidebarScaffoldProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  statusChip?: ReactNode;
  statusChipClassName?: string;
  children: ReactNode;
  footer?: ReactNode;
  widthClassName?: string;
  tabs?: AdminSidebarTab[];
  activeTabId?: string;
  onTabChange?: (id: string) => void;
  zIndexClassName?: string;
  frameContent?: boolean;
  contentClassName?: string;
  framedContentClassName?: string;
};

export default function AdminSidebarScaffold({
  open,
  onClose,
  title,
  subtitle,
  statusChip,
  statusChipClassName = '',
  children,
  footer,
  widthClassName = 'w-full max-w-[620px]',
  tabs = [],
  activeTabId,
  onTabChange,
  zIndexClassName = 'z-[2147483100]',
  frameContent = false,
  contentClassName = '',
  framedContentClassName = '',
}: AdminSidebarScaffoldProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className={`fixed inset-0 ${zIndexClassName}`} role="presentation">
      <button
        type="button"
        aria-label="Cerrar panel"
        className="fixed inset-x-0 bottom-0 top-16 bg-[#101326]/20 transition-[left] duration-200 ease-out will-change-[left] lg:left-[var(--admin-playground-sidebar-left,168px)] lg:rounded-tl-[12px]"
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal="true"
        className={`fixed inset-y-0 right-0 top-16 ${widthClassName} border-l border-[#e6e8ee] bg-white shadow-2xl transition-transform duration-300 translate-x-0`}
      >
        <div className="relative flex h-full w-full flex-col">
          <header className="border-b border-[#eef0f5] px-6 py-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[24px] leading-none font-semibold tracking-[-0.015em] text-[#1f2638]">
                  {title}
                </h2>
                {subtitle ? (
                  <p className="mt-3 text-[13px] leading-snug text-[#7d879d]">{subtitle}</p>
                ) : null}
                {statusChip ? (
                  <span
                    className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${statusChipClassName}`}
                  >
                    {statusChip}
                  </span>
                ) : null}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#e4e7ee] text-[#798194] hover:bg-[#f7f8fb]"
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            </div>
          </header>

          {tabs.length > 0 && (
            <div className="border-b border-[#eef0f5] px-6">
              <nav className="flex items-center gap-6 overflow-x-auto">
                {tabs.map((tab) => {
                  const isActive = activeTabId === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => onTabChange?.(tab.id)}
                      className={`h-12 whitespace-nowrap border-b-2 text-[13px] font-semibold uppercase tracking-[0.02em] transition ${
                        isActive
                          ? 'border-[#3155df] text-[#3155df]'
                          : 'border-transparent text-[#6f7890] hover:text-[#3f4760]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          )}

          <div className={`min-h-0 flex-1 overflow-y-auto px-6 py-6 ${contentClassName}`}>
            {frameContent ? (
              <section className={`rounded-2xl border border-[#dce2ee] bg-white px-4 py-4 ${framedContentClassName}`}>
                {children}
              </section>
            ) : (
              children
            )}
          </div>

          {footer ? <footer className="border-t border-[#eef0f5] bg-white p-4">{footer}</footer> : null}
        </div>
      </aside>
    </div>
  );
}

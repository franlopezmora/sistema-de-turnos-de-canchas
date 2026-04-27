import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

type AdminModalProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  closeOnEscape?: boolean;
  maxWidthClassName?: string;
};

export default function AdminModal({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  closeOnEscape = true,
  maxWidthClassName = 'max-w-[560px]',
}: AdminModalProps) {
  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [closeOnEscape, onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2147483200] flex items-center justify-center bg-[#0f172a]/40 p-4 backdrop-blur-[1px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${maxWidthClassName} rounded-2xl border border-[#dbe2ef] bg-white shadow-2xl`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#eef1f6] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[20px] font-bold tracking-[-0.01em] text-[#1f2a44]">{title}</h2>
            {description && <p className="mt-1 text-[12px] text-[#6f7890]">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#dce3ef] text-[#76819b] hover:bg-[#f6f8fc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cfd9ff]"
            aria-label={`Cerrar ${title}`}
          >
            <X size={14} />
          </button>
        </header>
        <div className="px-5 py-5">{children}</div>
        {footer && <footer className="flex items-center justify-end gap-2 border-t border-[#eef1f6] px-5 py-4">{footer}</footer>}
      </div>
    </div>
  );
}

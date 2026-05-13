import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { ADMIN_TOAST_EVENT } from '../../utils/adminToast';
import type { AdminToastPayload, AdminToastType } from '../../utils/adminToast';

interface ToastItem {
  id: number;
  message: string;
  type: AdminToastType;
}

const MAX_TOASTS = 4;
const DISMISS_MS = 2400;

/**
 * AdminToast — renders the global admin toast stack.
 * Mount once inside AdminPlaygroundShell. Toasts are fired via showAdminToast().
 */
export default function AdminToast() {
  const [mounted, setMounted] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(1);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const dismiss = (id: number) => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timersRef.current.delete(id);
    };

    const onEvent = (e: Event) => {
      const { message, type } = (e as CustomEvent<AdminToastPayload>).detail;
      const id = idRef.current++;
      setToasts((prev) => [...prev, { id, message, type }].slice(-MAX_TOASTS));
      const timer = setTimeout(() => dismiss(id), DISMISS_MS);
      timersRef.current.set(id, timer);
    };

    window.addEventListener(ADMIN_TOAST_EVENT, onEvent);
    return () => {
      window.removeEventListener(ADMIN_TOAST_EVENT, onEvent);
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  if (!mounted || typeof document === 'undefined' || toasts.length === 0) return null;

  return createPortal(
    <div
      aria-live="polite"
      aria-label="Notificaciones"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 2147483100,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      <style>{`
        @keyframes pique-toast-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: none; }
        }
      `}</style>
      {toasts.map((toast) => {
        const isError = toast.type === 'error';
        const isInfo = toast.type === 'info';
        const Icon = isError ? AlertTriangle : isInfo ? Info : CheckCircle2;
        return (
          <div
            key={toast.id}
            role="status"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              borderRadius: 10,
              background: isError ? 'var(--p-error, #dc2626)' : '#111827',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              boxShadow: '0 4px 16px rgba(0,0,0,0.28)',
              fontFamily: "'Geist',system-ui,sans-serif",
              letterSpacing: '.01em',
              maxWidth: 320,
              pointerEvents: 'auto',
              animation: 'pique-toast-in .18s ease',
            }}
          >
            <Icon size={14} style={{ flexShrink: 0, opacity: 0.85 }} />
            {toast.message}
          </div>
        );
      })}
    </div>,
    document.body,
  );
}

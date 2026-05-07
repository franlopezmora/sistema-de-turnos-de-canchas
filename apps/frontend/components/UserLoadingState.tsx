import type { CSSProperties } from 'react';
import { Loader2 } from 'lucide-react';
import { useUserTheme } from '../contexts/UserThemeContext';

type UserLoadingStateMode = 'page' | 'block' | 'inline';

interface UserLoadingStateProps {
  message?: string;
  mode?: UserLoadingStateMode;
  minHeight?: string | number;
}

const shellBase: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export default function UserLoadingState({
  message = 'Cargando...',
  mode = 'block',
  minHeight,
}: UserLoadingStateProps) {
  const { isLight } = useUserTheme();
  const panel = (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        padding: mode === 'inline' ? '8px 12px' : '14px 18px',
        borderRadius: 14,
        border: isLight ? '1px solid rgba(34,197,94,.24)' : '1px solid rgba(34,197,94,.2)',
        background: isLight ? 'rgba(34,197,94,.12)' : 'rgba(34,197,94,.08)',
        color: isLight ? '#166534' : '#a7f3d0',
        fontSize: mode === 'inline' ? 12 : 13,
        fontWeight: 700,
        letterSpacing: '.01em',
      }}
    >
      <Loader2 size={mode === 'inline' ? 14 : 16} className="animate-spin" />
      <span>{message}</span>
    </div>
  );

  if (mode === 'inline') return panel;

  if (mode === 'page') {
    return (
      <main
        style={{
          ...shellBase,
        minHeight: '100vh',
          background: isLight
            ? 'radial-gradient(circle at 18% 86%, rgba(34,197,94,.14), transparent 42%), radial-gradient(circle at 86% 10%, rgba(14,165,233,.1), transparent 40%), #eef3f8'
            : 'radial-gradient(circle at 18% 86%, rgba(34,197,94,.12), transparent 42%), radial-gradient(circle at 86% 10%, rgba(16,185,129,.08), transparent 40%), #050505',
          color: isLight ? '#0f172a' : '#f2f2f2',
          fontFamily: "'Sora',system-ui,sans-serif",
          padding: 24,
        }}
      >
        {panel}
      </main>
    );
  }

  return (
    <div
      style={{
        ...shellBase,
        minHeight: minHeight ?? '40vh',
      }}
    >
      {panel}
    </div>
  );
}

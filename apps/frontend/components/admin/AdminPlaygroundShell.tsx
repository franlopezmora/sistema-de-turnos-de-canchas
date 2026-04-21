import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/router';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { logout } from '../../services/AuthService';
import { normalizeSessionUser, setActiveClubId } from '../../utils/session';
import { PLAYGROUND_SIDEBAR_ITEMS } from './playgroundNavigation';

type AdminPlaygroundShellProps = {
  activeItem: string;
  children: ReactNode;
  contentMuted?: boolean;
  user: any;
};

const humanizeClubSlug = (value: unknown) => {
  const slug = String(value || '').trim();
  if (!slug) return '';
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export default function AdminPlaygroundShell({
  activeItem,
  children,
  contentMuted = false,
  user,
}: AdminPlaygroundShellProps) {
  const router = useRouter();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [clubMenuOpen, setClubMenuOpen] = useState(false);
  const [selectedClubId, setSelectedClubId] = useState<number>(0);
  const clubMenuRef = useRef<HTMLDivElement | null>(null);

  const normalizedUser = useMemo(() => normalizeSessionUser(user || null), [user]);
  const clubOptions = useMemo(
    () =>
      Array.isArray(normalizedUser?.memberships)
        ? normalizedUser.memberships.map((membership) => ({
            id: Number(membership.clubId),
            label: String(
              (membership as any)?.club?.name ||
                humanizeClubSlug((membership as any)?.club?.slug) ||
                `Club #${membership.clubId}`
            ),
          }))
        : [],
    [normalizedUser]
  );

  useEffect(() => {
    const activeClubId = Number(normalizedUser?.activeClubId || 0);
    if (Number.isInteger(activeClubId) && activeClubId > 0) {
      setSelectedClubId(activeClubId);
      return;
    }
    if (clubOptions[0]?.id) {
      setSelectedClubId(clubOptions[0].id);
    }
  }, [clubOptions, normalizedUser?.activeClubId]);

  useEffect(() => {
    if (!clubMenuOpen) return;

    const onDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && clubMenuRef.current && !clubMenuRef.current.contains(target)) {
        setClubMenuOpen(false);
      }
    };

    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setClubMenuOpen(false);
    };

    document.addEventListener('mousedown', onDocumentMouseDown);
    document.addEventListener('keydown', onDocumentKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocumentMouseDown);
      document.removeEventListener('keydown', onDocumentKeyDown);
    };
  }, [clubMenuOpen]);

  const sidebarWidthClass = isSidebarCollapsed ? 'w-[66px]' : 'w-[192px]';
  const selectedClubLabel =
    clubOptions.find((club) => club.id === selectedClubId)?.label ||
    clubOptions[0]?.label ||
    'Seleccionar club';
  const userInitial =
    String(user?.firstName || user?.name || 'U')
      .trim()
      .charAt(0)
      .toUpperCase() || 'U';

  const handleChangeActiveClub = (clubId: number) => {
    if (!Number.isInteger(clubId) || clubId <= 0) return;
    setSelectedClubId(clubId);
    setClubMenuOpen(false);
    setActiveClubId(clubId);
    window.setTimeout(() => window.location.reload(), 80);
  };

  return (
    <div className="h-screen w-full overflow-hidden bg-[#f5f6f8] text-[#1a1a1a]">
      <div className="flex h-full w-full flex-col">
        <header className="flex h-16 items-center bg-white px-4 lg:px-6">
          <div className="hidden w-[192px] items-center gap-2 overflow-hidden transition-[width] duration-200 ease-out lg:flex">
            <div className="grid h-8 w-8 place-items-center rounded-lg border border-[#d9dfeb] bg-[#f5f7ff] text-[11px] font-black text-[#2a2f5b]">
              TC
            </div>
            <span
              className={`whitespace-nowrap text-[12px] font-black tracking-[0.22em] text-[#2a2f5b] transition-[opacity,transform,max-width,filter] duration-200 ease-out ${
                isSidebarCollapsed
                  ? 'max-w-0 -translate-x-1 opacity-0 blur-[1px]'
                  : 'max-w-[140px] translate-x-0 opacity-100 blur-0'
              }`}
            >
              TUCANCHA
            </span>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <div className="grid h-8 w-8 place-items-center rounded-lg border border-[#d9dfeb] bg-[#f5f7ff] text-[11px] font-black text-[#2a2f5b]">
              TC
            </div>
            <span className="text-[12px] font-black tracking-[0.22em] text-[#2a2f5b]">TUCANCHA</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className="h-9 rounded-lg px-3 text-sm font-semibold text-[#4a5eaa] hover:bg-[#f3f6ff]"
            >
              Ayuda
            </button>

            <div ref={clubMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setClubMenuOpen((previous) => !previous)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setClubMenuOpen(true);
                  }
                }}
                aria-haspopup="menu"
                aria-expanded={clubMenuOpen}
                className={`inline-flex h-9 min-w-[180px] items-center justify-between gap-2 rounded-lg border bg-white px-3 text-sm font-semibold shadow-sm transition outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#dce6ff] focus-visible:ring-offset-0 ${
                  clubMenuOpen
                    ? 'border-[#bfc8da] text-[#1f2a44] ring-2 ring-[#ebf0ff]'
                    : 'border-[#dfe4ee] text-[#2a3348] hover:border-[#cfd7e6]'
                }`}
              >
                <span className="truncate">{selectedClubLabel}</span>
                <ChevronDown
                  size={14}
                  className={`text-[#7a8398] transition-transform ${clubMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {clubMenuOpen && (
                <div className="absolute right-0 z-40 mt-2 w-[240px] rounded-xl border border-[#dbe2ef] bg-white p-1 shadow-xl">
                  {clubOptions.length === 0 ? (
                    <div className="px-3 py-2 text-[13px] text-[#7a8398]">Sin clubes disponibles</div>
                  ) : (
                    clubOptions.map((club) => {
                      const active = club.id === selectedClubId;
                      return (
                        <button
                          key={club.id}
                          type="button"
                          onClick={() => handleChangeActiveClub(club.id)}
                          className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] transition ${
                            active
                              ? 'bg-[#edf1ff] font-semibold text-[#2748cc]'
                              : 'text-[#3a435b] hover:bg-[#f5f7fb]'
                          }`}
                        >
                          <span className="truncate">{club.label}</span>
                          {active && <span className="text-[11px] font-bold">Activo</span>}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full border border-[#e5e7eb] bg-white text-sm font-bold text-[#2a3348]"
              title="Usuario actual"
            >
              {userInitial}
            </button>
            <button
              type="button"
              onClick={() => logout({ redirectTo: '/login' })}
              className="grid h-9 w-9 place-items-center rounded-lg border border-[#e5e7eb] bg-white text-[#58627a] hover:bg-[#f8f9fc]"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 bg-white">
          <aside
            className={`relative z-20 hidden h-full ${sidebarWidthClass} flex-col items-center overflow-visible bg-white py-4 transition-[width,opacity] duration-200 ease-out will-change-[width] lg:flex ${
              contentMuted ? 'pointer-events-none select-none opacity-40' : 'opacity-100'
            }`}
          >
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((previous) => !previous)}
              className="absolute -right-3 top-1/2 z-30 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full border border-[#dfe4ec] bg-white text-[#6f7890] shadow-sm transition-transform duration-200 hover:bg-[#f7f9fc]"
              title={isSidebarCollapsed ? 'Expandir panel lateral' : 'Colapsar panel lateral'}
              aria-label={isSidebarCollapsed ? 'Expandir panel lateral' : 'Colapsar panel lateral'}
            >
              {isSidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>

            <nav className="w-full space-y-1 px-2">
              {PLAYGROUND_SIDEBAR_ITEMS.map(({ label, icon: Icon, href }) => {
                const active = label === activeItem;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      if (href && router.pathname !== href) void router.push(href);
                    }}
                    className={`w-full rounded-md py-2 text-left text-[11px] transition-colors ${
                      active ? 'bg-[#eef1ff] text-[#2b3fa8]' : 'text-[#8b92a0] hover:bg-[#f4f5f7]'
                    } px-0`}
                    title={label}
                  >
                    <span className="grid grid-cols-[48px_1fr] items-center">
                      <span className="inline-flex w-full shrink-0 justify-center">
                        <Icon size={14} />
                      </span>
                      <span
                        className={`truncate whitespace-nowrap transition-[opacity,transform,max-width,filter] duration-200 ease-out ${
                          isSidebarCollapsed
                            ? 'max-w-0 -translate-x-1 opacity-0 blur-[1px]'
                            : 'max-w-[124px] translate-x-0 opacity-100 blur-0'
                        }`}
                      >
                        {label}
                      </span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <main
            className={`relative flex-1 h-full min-w-0 rounded-tl-[12px] overflow-hidden bg-[#f5f6f8] transition ${
              contentMuted ? 'pointer-events-none select-none opacity-80' : 'opacity-100'
            }`}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

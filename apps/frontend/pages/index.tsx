import { useEffect, useState, useRef, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { ClubService, Club } from '../services/ClubService';
import { getApiUrl } from '../utils/apiUrl';
import { LocationService, Location } from '../services/LocationService';
import DatePickerDark from '../components/ui/DatePickerDark';
import AppModal from '../components/AppModal';
import { Search, MapPin, Calendar, TrendingUp, ShieldCheck, ArrowRight, Menu, X, Phone, Mail, Instagram, Activity, ChevronRight, ChevronLeft, MousePointerClick, CalendarCheck, PlayCircle, Coffee, Droplets, Lightbulb, Trophy, ChevronDown, LogOut, Check, MessageSquare, Calculator, Users, Heart } from 'lucide-react';
import Link from 'next/link';
import { logout } from '../services/AuthService';
import { getMyBookings } from '../services/BookingService';
import { getActiveClubSlug, hasAdminAccess, normalizeSessionUser } from '../utils/session';
import { reportUiError } from '../utils/uiError';
import { useAuth } from '../contexts/AuthContext';
import { isAuthSessionInvalidatedError } from '../utils/apiClient';
// Importamos los iconos de la libreria
import { FaTableTennis } from "react-icons/fa"; // Paleta (Perfecta para Padel)
import { IoFootballOutline } from "react-icons/io5"; // Pelota de futbol limpia
import { IoTennisballOutline } from "react-icons/io5"; // Pelota de tenis limpia

const APP_NOTICE_EVENT = 'app:notice';
type AppNoticeTone = 'success' | 'error' | 'info' | 'warning';

const countActiveBookings = (rows: any[]): number => {
  const now = Date.now();
  return rows.filter((booking: any) => {
    const status = String(booking?.status || '').toUpperCase();
    if (status === 'CANCELLED' || status === 'COMPLETED') return false;
    const endValue = booking?.endDateTime || booking?.startDateTime;
    const endTs = new Date(endValue).getTime();
    if (!Number.isFinite(endTs)) return true;
    return endTs >= now;
  }).length;
};

// ReactDOM portal removed: menu will be rendered inside the sidebar to keep positioning stable under zoom

// --- COMPONENTE DE ANIMACION AL SCROLLEAR ---
const RevealOnScroll = ({ children, delay = 0, className = "" }: { children: React.ReactNode, delay?: number, className?: string }) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1 } // Se activa cuando el 10% del elemento es visible
    );
    const currentRef = ref.current;
    if (currentRef) observer.observe(currentRef);
    return () => { if (currentRef) observer.unobserve(currentRef); };
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-1000 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

// --- HELPERS DE UBICACION ---
type LocationSuggestion = {
  label: string;
  query: string;
  city: string;
  province: string;
  country: string;
};

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const LOCATION_LIMIT = 6;
const DEFAULT_RADIUS_KM = 20;

const normalizeText = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const sportAliases: Record<string, string[]> = {
  padel: ['padel'],
  tenis: ['tenis', 'tennis'],
  futbol: ['futbol', 'football']
};

const matchesSport = (activityName: string, sport: string) => {
  const normalizedActivity = normalizeText(activityName);
  const aliases = sportAliases[sport] || [sport];
  return aliases.some((alias) => normalizedActivity.includes(normalizeText(alias)));
};

const fetchLocations = async (
  query: string,
  limit = LOCATION_LIMIT,
  signal?: AbortSignal
): Promise<{ lat: number; lon: number }[]> => {
  if (!query.trim()) return [];
  const params = new URLSearchParams({
    format: 'jsonv2',
    limit: `${limit}`,
    addressdetails: '1',
    q: query
  });
  const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, { signal });
  if (!response.ok) return [];
  const data = await response.json();
  return Array.isArray(data)
    ? data.map((item: any) => ({ lat: Number(item.lat), lon: Number(item.lon) }))
    : [];
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const calculateDistanceKm = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return earthRadiusKm * c;
};

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatClubAddress = (club: Club) => {
  return [club.addressLine, club.city, club.province, club.country].filter(Boolean).join(', ');
};

export default function Home() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loadingClubs, setLoadingClubs] = useState(true);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [showContact, setShowContact] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeBookingsCount, setActiveBookingsCount] = useState(0);
  const [favoriteClubIds, setFavoriteClubIds] = useState<Set<number>>(new Set());
  const [favoriteClubs, setFavoriteClubs] = useState<Club[]>([]);
  const [favoriteBusyByClub, setFavoriteBusyByClub] = useState<Record<number, boolean>>({});
  // track which FAQ item is currently open (null if none)
  const sportClubCounts = useMemo(() => {
    if (!clubs.length) return { futbol: 0, padel: 0, tenis: 0, otros: 0 };
    const counts = { futbol: 0, padel: 0, tenis: 0, otros: 0 };
    for (const club of clubs) {
      const keys = club.fixedBookingSettingsByActivity ? Object.keys(club.fixedBookingSettingsByActivity) : [];
      if (keys.some(k => matchesSport(k, 'futbol'))) counts.futbol++;
      if (keys.some(k => matchesSport(k, 'padel'))) counts.padel++;
      if (keys.some(k => matchesSport(k, 'tenis'))) counts.tenis++;
      if (!keys.length || keys.every(k => !matchesSport(k, 'futbol') && !matchesSport(k, 'padel') && !matchesSport(k, 'tenis'))) counts.otros++;
    }
    return counts;
  }, [clubs]);

  const sportWords = ['fútbol', 'pádel', 'tenis', 'básquet'];
  const [heroSportIdx, setHeroSportIdx] = useState(0);
  const [heroWordVisible, setHeroWordVisible] = useState(true);
  const [navHidden, setNavHidden] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const faqRefs = useRef<Array<HTMLDivElement | null>>([]);

  // close open FAQ when clicking outside the open item's box
  useEffect(() => {
    const handler = (evt: MouseEvent) => {
      if (openFaqIndex === null) return;
      const currentRef = faqRefs.current[openFaqIndex];
      if (currentRef && !currentRef.contains(evt.target as Node)) {
        setOpenFaqIndex(null);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [openFaqIndex]);

  useEffect(() => {
    let lastY = window.scrollY;
    const handler = () => {
      const y = window.scrollY;
      if (y < 80) { setNavHidden(false); lastY = y; return; }
      if (Math.abs(y - lastY) < 4) return; // ignorar micro-scrolls
      setNavHidden(y > lastY);
      lastY = y;
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroWordVisible(false);
      setTimeout(() => {
        setHeroSportIdx(i => (i + 1) % sportWords.length);
        setHeroWordVisible(true);
      }, 380);
    }, 2700);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const els = document.querySelectorAll('.tc-sr,.tc-sr-up,.tc-sr-left,.tc-sr-right');
    if (!els.length) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('tc-in'); obs.unobserve(e.target); } });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const closeTransientPanels = () => {
      setShowContact(false);
      setContactMenu(null);
      setShowUserMenu(false);
    };
    router.events.on('routeChangeStart', closeTransientPanels);
    return () => {
      router.events.off('routeChangeStart', closeTransientPanels);
    };
  }, [router.events]);

  useEffect(() => {
    const closingSection = closingSectionRef.current;
    const ownerSection = ownerSectionRef.current;
    if (!closingSection && !ownerSection) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let rafId: number | null = null;

    const applyParallax = (section: HTMLElement, cssVarName: string, amplitude: number) => {
      const rect = section.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 1;
      const progress = (viewportHeight - rect.top) / (viewportHeight + rect.height);
      const clamped = Math.max(0, Math.min(1, progress));
      const shift = (clamped - 0.5) * amplitude;
      section.style.setProperty(cssVarName, `${shift.toFixed(2)}px`);
    };

    const updateParallax = () => {
      if (reducedMotion.matches) {
        if (closingSection) closingSection.style.setProperty('--tc-closing-parallax', '0px');
        if (ownerSection) ownerSection.style.setProperty('--tc-owner-parallax', '0px');
        return;
      }
      if (closingSection) applyParallax(closingSection, '--tc-closing-parallax', 28); // -14..14
      if (ownerSection) applyParallax(ownerSection, '--tc-owner-parallax', 24); // -12..12
    };

    const scheduleParallax = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        updateParallax();
      });
    };

    scheduleParallax();
    window.addEventListener('scroll', scheduleParallax, { passive: true });
    window.addEventListener('resize', scheduleParallax);

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', scheduleParallax);
      window.removeEventListener('resize', scheduleParallax);
    };
  }, []);

  const resultsRef = useRef<HTMLElement>(null);
  const searchBarRef = useRef<HTMLDivElement | null>(null);
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const ownerSectionRef = useRef<HTMLElement | null>(null);
  const closingSectionRef = useRef<HTMLElement | null>(null);
  const apiBase = useMemo(() => `${getApiUrl()}/api`, []);

  // Estados del Buscador
  const [searchCity, setSearchCity] = useState('');
  const [showCityDropdown, setShowCityDropdown] = useState(false); 
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationSuggestion | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [displayedClubs, setDisplayedClubs] = useState<Club[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [clubCoords, setClubCoords] = useState<Record<number, { lat: number; lon: number } | null>>({});

  const [searchSport, setSearchSport] = useState('padel');
  const [showSportDropdown, setShowSportDropdown] = useState(false);
  // Fecha seleccionada en formato YYYY-MM-DD. Por defecto, el dia de hoy.
  const getEffectiveToday = () => {
    // Aqui podemos aplicar offsets si fuera necesario (zona horaria / reglas de negocio).
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  };
  const [searchDate, setSearchDate] = useState(() => formatLocalDate(getEffectiveToday()));
  const [lastSearchLabel, setLastSearchLabel] = useState<string>('');
  const [availableTimesByClub, setAvailableTimesByClub] = useState<Record<number, string[]>>({});
  const searchRequestIdRef = useRef(0);

  // Menu de acciones para contactos (abrir / copiar)
  const [contactMenu, setContactMenu] = useState<{
    type: 'whatsapp' | 'email' | 'instagram';
    top: number;
    left: number;
    href: string;
    copyText: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setContactMenu(null);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContactMenu(null);
    };
    document.addEventListener('mousedown', handleDocClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleDocClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const openContactMenu = (e: React.MouseEvent, type: 'whatsapp' | 'email' | 'instagram') => {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    // If the sidebar ref exists, position the menu relative to the sidebar container
    let top = rect.bottom + 8;
    let left = rect.left;
    if (sidebarRef.current) {
      const sidebarRect = sidebarRef.current.getBoundingClientRect();
      top = rect.bottom - sidebarRect.top + 8; // relative to sidebar
      left = rect.left - sidebarRect.left;
    }
    let href = '#';
    let copyText = '';
    if (type === 'whatsapp') {
      href = 'https://wa.me/5493513436163';
      copyText = '+5493513436163';
    } else if (type === 'email') {
      href = 'mailto:soporte.tucancha@gmail.com';
      copyText = 'soporte.tucancha@gmail.com';
    } else if (type === 'instagram') {
      href = 'https://www.instagram.com/tucancha.app_/';
      copyText = '@tucancha.app_';
    }
    setContactMenu({ type, top: Math.max(top, 10), left: Math.max(left, 10), href, copyText });
  };

  const handleOpenHref = (href: string) => {
    window.open(href, '_blank');
    setContactMenu(null);
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      reportUiError({ area: 'HomePage', action: 'copyContactData' }, err);
    }
    setContactMenu(null);
  };

  const userInitials = useMemo(() => {
    if (!user) return 'TU';
    const first = (user.firstName || user.name || '').trim();
    const last = (user.lastName || '').trim();
    const initials = `${first.charAt(0)}${last.charAt(0)}`.trim();
    return initials || 'TU';
  }, [user]);
  const isAdmin = hasAdminAccess(user);
  const adminClubSlug = useMemo(() => {
    if (!user || !isAdmin) return null;

    const normalizedUser = normalizeSessionUser(user);
    const activeSlug = getActiveClubSlug(normalizedUser);
    if (activeSlug) return activeSlug;

    const fallbackClubId = Number(normalizedUser?.activeClubId || normalizedUser?.clubId || normalizedUser?.club?.id);
    if (!Number.isFinite(fallbackClubId) || fallbackClubId <= 0) return null;

    const club = clubs.find((item) => Number(item.id) === fallbackClubId);
    return club?.slug || null;
  }, [clubs, isAdmin, user]);

  const sportOptions = useMemo(() => ([
  {
    value: 'padel',
    label: 'Padel',
    icon: (
      <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true">
        <g>
          <circle cx="12.41" cy="3.19" r="0.62" fill="currentColor" />
          <circle cx="14.17" cy="4.99" r="0.62" fill="currentColor" />
          <circle cx="15.94" cy="6.8" r="0.62" fill="currentColor" />
          <circle cx="10.61" cy="4.96" r="0.62" fill="currentColor" />
          <circle cx="12.37" cy="6.75" r="0.62" fill="currentColor" />
          <circle cx="14.14" cy="8.56" r="0.62" fill="currentColor" />
          <circle cx="8.81" cy="6.72" r="0.62" fill="currentColor" />
          <circle cx="10.56" cy="8.52" r="0.62" fill="currentColor" />
          <circle cx="12.34" cy="10.33" r="0.62" fill="currentColor" />
          <path
            fill="currentColor"
            d="M17.94,9.89a4.1,4.1,0,0,0,1.11-3.43A5.72,5.72,0,0,0,18,4l-.75-1-1-1-.15-.16A7.65,7.65,0,0,0,14.39.59,4.17,4.17,0,0,0,9.53,1,14.21,14.21,0,0,0,7.91,2.59,9.38,9.38,0,0,0,6,5.77c-.2.54-.28,1.12-.45,1.72-.42,1.36-.77,2.69-1.15,4a1.61,1.61,0,0,1-.42.74L2.77,13.47a.3.3,0,0,1-.41,0h0a.3.3,0,0,0-.43,0L.3,15.06a1,1,0,0,0,0,1.39l2.13,2.18a1,1,0,0,0,1.39,0L5.45,17a.32.32,0,0,0,0-.45h0a.29.29,0,0,1,0-.38L6.66,15a1.93,1.93,0,0,1,.78-.43l4-1,.3-.06a12.76,12.76,0,0,0,1.51-.36A11.46,11.46,0,0,0,17.94,9.89ZM3.3,17.54a.37.37,0,0,1-.52,0h0L1.4,16.12a.37.37,0,0,1,0-.52h0l.85-.84a.36.36,0,0,1,.51,0h0a.23.23,0,0,0,.29,0l1.57-1.52a.36.36,0,0,1,.51,0h0l.61.62a.37.37,0,0,1,0,.52h0L4.17,15.88a.24.24,0,0,0,0,.3h0a.37.37,0,0,1,0,.51Zm4.2-4.26A1.18,1.18,0,0,1,6.39,13L6,12.62a1.37,1.37,0,0,1-.26-1.12c.1-.38.2-.77.32-1.15A6.59,6.59,0,0,0,8.69,13ZM12.83,12a4.3,4.3,0,0,1-3.41,0A4.38,4.38,0,0,1,7.11,6.25,10.13,10.13,0,0,1,8.85,3.43c.27-.26.5-.55.75-.82A5,5,0,0,1,11,1.55a3,3,0,0,1,2.59.09,8.65,8.65,0,0,1,2.57,2.05,7.32,7.32,0,0,1,1.31,1.9A3,3,0,0,1,17,9,10.36,10.36,0,0,1,12.83,12Z"
          />
        </g>
      </svg>
    )
  },
  {
    value: 'futbol',
    label: 'Futbol',
    icon: <IoFootballOutline className="h-5 w-5" /> // Dejs la de la libreria que estaba buena
  },
  {
    value: 'tenis',
    label: 'Tenis',
    icon: <IoTennisballOutline className="h-5 w-5" /> // Dejs la de la libreria
  }
]), []);

  const selectedSport = sportOptions.find((sport) => sport.value === searchSport) || sportOptions[0];

  useEffect(() => {
    const loadClubs = async () => {
      try {
        const allClubs = await ClubService.getAllClubs();
        setClubs(allClubs);
      } catch (error) {
        reportUiError({ area: 'HomePage', action: 'loadClubs' }, error);
      } finally {
        setLoadingClubs(false);
      }
    };
    const loadLocations = async () => {
      try {
        const allLocations = await LocationService.getAllLocations();
        setLocations(allLocations);
      } catch (error) {
        reportUiError({ area: 'HomePage', action: 'loadLocations' }, error);
      } finally {
        setLoadingLocations(false);
      }
    };
    loadClubs();
    loadLocations();
  }, []);

  useEffect(() => {
    setUser(authUser ? normalizeSessionUser(authUser as any) : null);
    if (!authUser) {
      setShowUserMenu(false);
    }
  }, [authUser]);

  useEffect(() => {
    const loadActiveBookings = async () => {
      if (!user?.id) {
        setActiveBookingsCount(0);
        return;
      }
      try {
        const bookings = await getMyBookings(user.id);
        const active = Array.isArray(bookings) ? countActiveBookings(bookings) : 0;
        setActiveBookingsCount(active);
      } catch (error) {
        if (isAuthSessionInvalidatedError(error)) {
          return;
        }
        reportUiError({ area: 'HomePage', action: 'loadActiveBookings' }, error);
      }
    };

    loadActiveBookings();
  }, [user]);

  useEffect(() => {
    const loadFavorites = async () => {
      if (!user?.id) {
        setFavoriteClubIds(new Set());
        setFavoriteClubs([]);
        return;
      }
      try {
        const favorites = await ClubService.getMyFavorites();
        const nextIds = new Set<number>(favorites.map((item) => Number(item.clubId)));
        const nextClubs = favorites
          .map((item) => item.club)
          .filter((club): club is Club => Boolean(club && club.id));
        setFavoriteClubIds(nextIds);
        setFavoriteClubs(nextClubs);
      } catch (error) {
        if (isAuthSessionInvalidatedError(error)) {
          return;
        }
        reportUiError({ area: 'HomePage', action: 'loadFavorites' }, error);
      }
    };
    void loadFavorites();
  }, [user?.id]);

  const showAppNotice = (message: string, tone: AppNoticeTone = 'info') => {
    if (typeof window === 'undefined') return;
    const safe = String(message || '').trim();
    if (!safe) return;
    window.dispatchEvent(new CustomEvent(APP_NOTICE_EVENT, { detail: { message: safe, tone } }));
  };


  const handleToggleFavorite = async (e: React.MouseEvent, club: Club) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user?.id) {
      showAppNotice('Iniciá sesión para guardar favoritos.', 'info');
      return;
    }

    const clubId = Number(club.id);
    if (!Number.isFinite(clubId) || clubId <= 0) return;
    if (favoriteBusyByClub[clubId]) return;

    setFavoriteBusyByClub((prev) => ({ ...prev, [clubId]: true }));
    try {
      if (favoriteClubIds.has(clubId)) {
        await ClubService.unmarkFavorite(clubId);
        setFavoriteClubIds((prev) => {
          const next = new Set(prev);
          next.delete(clubId);
          return next;
        });
        setFavoriteClubs((prev) => prev.filter((item) => Number(item.id) !== clubId));
        showAppNotice('Club eliminado de favoritos.', 'success');
      } else {
        await ClubService.markFavorite(clubId);
        setFavoriteClubIds((prev) => {
          const next = new Set(prev);
          next.add(clubId);
          return next;
        });
        setFavoriteClubs((prev) => {
          const exists = prev.some((item) => Number(item.id) === clubId);
          return exists ? prev : [club, ...prev];
        });
        showAppNotice('Club agregado a favoritos.', 'success');
      }
    } catch (error) {
      reportUiError({ area: 'HomePage', action: 'toggleFavorite' }, error);
      showAppNotice('No pudimos actualizar tus favoritos. Intentá nuevamente.', 'error');
    } finally {
      setFavoriteBusyByClub((prev) => ({ ...prev, [clubId]: false }));
    }
  };

  useEffect(() => {
    setDisplayedClubs(clubs);
  }, [clubs]);

  const locationOptions = useMemo(() => {
    const map = new Map<string, LocationSuggestion>();
    locations.forEach((location) => {
      const city = location.city?.trim();
      const province = location.province?.trim();
      const country = location.country?.trim();
      if (!city || !province || !country) return;
      const label = `${city}, ${province}`;
      const query = [city, province, country].filter(Boolean).join(', ');
      const key = normalizeText(query);
      if (!map.has(key)) {
        map.set(key, { label, query, city, province, country });
      }
    });
    return Array.from(map.values());
  }, [locations]);

  useEffect(() => {
    if (!searchCity.trim()) {
      setLocationSuggestions([]);
      if (selectedLocation) {
        setSelectedLocation(null);
      }
      return;
    }

    if (selectedLocation && searchCity !== selectedLocation.label) {
      setSelectedLocation(null);
    }

    const term = normalizeText(searchCity);
    const filtered = locationOptions.filter((option) =>
      normalizeText(option.query).includes(term) || normalizeText(option.label).includes(term)
    );
    setLocationSuggestions(filtered.slice(0, LOCATION_LIMIT));
  }, [searchCity, selectedLocation, locationOptions]);

  const resolveClubCoords = async (club: Club) => {
    if (club.id in clubCoords) return clubCoords[club.id];

    const queries = [
      [club.addressLine, club.city, club.province, club.country, club.name],
      [club.city, club.province, club.country],
      [club.city, club.country]
    ]
      .map(parts => parts.filter(Boolean).join(', '))
      .filter(Boolean);

    for (const query of queries) {
      const results = await fetchLocations(query, 1);
      if (results[0]) {
        const coords = { lat: results[0].lat, lon: results[0].lon };
        setClubCoords(prev => ({ ...prev, [club.id]: coords }));
        return coords;
      }
    }

    setClubCoords(prev => ({ ...prev, [club.id]: null }));
    return null;
  };

  const parseSearchDate = (s: string) => {
    if (!s) return null;
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const changeDateBy = (days: number) => {
    const current = parseSearchDate(searchDate) || getEffectiveToday();
    const next = new Date(current);
    next.setDate(current.getDate() + days);
    const min = getEffectiveToday();
    if (next < min) return; // no retroceder mas que el minimo
    setSearchDate(formatLocalDate(next));
  };

  const canGoPrev = () => {
    const current = parseSearchDate(searchDate) || getEffectiveToday();
    const prev = new Date(current);
    prev.setDate(current.getDate() - 1);
    const min = getEffectiveToday();
    return prev >= min;
  };

  const scrollToSearchBarTop = () => {
    if (!searchBarRef.current) return;
    const top = window.scrollY + searchBarRef.current.getBoundingClientRect().top;
    const navbarOffset = 18;
    window.scrollTo({ top: Math.max(top - navbarOffset, 0), behavior: 'smooth' });
  };

  const handleSearch = () => {
    const query: Record<string, string> = {};
    if (searchCity.trim()) query.q = searchCity.trim();
    if (searchSport) query.sport = searchSport;
    router.push({ pathname: '/complejos', query });
  };

  // Cierra el DatePicker abierto (si existe) forzando blur sobre su input
  const closeDatepicker = () => {
    try {
      const el = document.querySelector('input[placeholder="Selecciona fecha"]') as HTMLInputElement | null;
      if (el) el.blur();
      // En algunos casos el popper queda montado en el body; lo removemos/ocultamos para asegurarnos
      try {
        document.querySelectorAll('.react-datepicker-popper, .react-datepicker').forEach((n) => {
          const eln = n as HTMLElement;
          if (eln && eln.parentNode) eln.parentNode.removeChild(eln);
        });
      } catch (err) {
        // noop
      }
    } catch (e) {
      // noop
    }
  };

  const selectCity = (location: LocationSuggestion) => {
    setSearchCity(location.label);
    setSelectedLocation(location);
    setShowCityDropdown(false);
  };

  const tcCss = `
    .tc-root { min-height:100vh; background:#050505; color:#f2f2f2; font-family:'Sora',system-ui,sans-serif; -webkit-font-smoothing:antialiased; overflow-x:clip; --tc-bg-a:#050505; --tc-bg-b:#0a0a0a; --tc-bg-c:#08110d; }
    .tc-root *,.tc-root *::before,.tc-root *::after { box-sizing:border-box; }
    .tc-root a { color:inherit; text-decoration:none; }
    .tc-root ::selection { background:#22c55e; color:#052010; }
    /* Header */
    .tc-header { position:fixed; top:0; left:0; right:0; z-index:50; background:rgba(5,5,5,.9); backdrop-filter:blur(16px); border-bottom:1px solid rgba(255,255,255,.06); transform:translateY(0); transition:transform .38s cubic-bezier(.4,0,.2,1); }
    .tc-header-hidden { transform:translateY(-110%); }
    .tc-header-inner { max-width:1360px; margin:0 auto; padding:0 24px; min-height:68px; display:flex; align-items:center; justify-content:space-between; gap:16px; }
    .tc-brand-text { font-size:13px; font-weight:800; letter-spacing:.22em; text-transform:uppercase; color:#22c55e; }
    .tc-btn { display:inline-flex; align-items:center; gap:8px; padding:9px 18px; border-radius:999px; font-size:13px; font-weight:700; border:1px solid rgba(255,255,255,.14); background:#111; color:#e8e8e8; cursor:pointer; transition:transform .15s,box-shadow .15s; font-family:inherit; }
    .tc-btn:hover { transform:translateY(-1px); box-shadow:0 4px 14px rgba(0,0,0,.3); }
    .tc-btn-primary { background:#22c55e!important; color:#052010!important; border-color:#22c55e!important; }
    .tc-btn-primary:hover { background:#16a34a!important; }
    .tc-btn-ghost { background:rgba(255,255,255,.06); border-color:rgba(255,255,255,.12); }
    .tc-btn-ghost:hover { background:rgba(255,255,255,.12); }
    /* User button */
    .tc-user-btn { display:flex; align-items:center; gap:10px; padding:5px 14px 5px 5px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1); border-radius:999px; cursor:pointer; transition:background .15s; }
    .tc-user-btn:hover { background:rgba(255,255,255,.1); }
    .tc-user-avatar { width:34px; height:34px; border-radius:50%; background:#22c55e; color:#052010; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:800; position:relative; flex-shrink:0; }
    .tc-user-name { font-size:13px; font-weight:600; color:#e8e8e8; }
    .tc-user-menu { position:absolute; right:0; top:calc(100% + 8px); width:260px; background:#111; border:1px solid rgba(255,255,255,.1); border-radius:16px; overflow:hidden; box-shadow:0 8px 32px rgba(0,0,0,.5); z-index:120; }
    /* Hero */
    .tc-hero { position:relative; z-index:10; min-height:92vh; display:flex; align-items:flex-end; padding:120px 40px 64px; overflow:visible; }
    .tc-hero-visuals { position:absolute; inset:0; overflow:hidden; pointer-events:none; z-index:0; }
    .tc-hero-bg { position:absolute; inset:0; background:linear-gradient(135deg,#0a1f0e 0%,#050505 45%,#0d1a0d 100%); }
    .tc-hero-bg::after { content:''; position:absolute; inset:0; background:radial-gradient(ellipse 60% 50% at 20% 100%,rgba(34,197,94,.14),transparent 70%),radial-gradient(ellipse 40% 40% at 85% 15%,rgba(34,197,94,.06),transparent 65%); }
    .tc-hero-noise { position:absolute; inset:0; opacity:.022; pointer-events:none; background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' seed='3'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .5 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>"); }
    .tc-hero-inner { position:relative; z-index:2; max-width:1360px; margin:0 auto; width:100%; display:grid; grid-template-columns:1.2fr auto; align-items:end; gap:48px; }
    .tc-hero-copy { max-width:720px; }
    .tc-hero-eyebrow { display:inline-flex; align-items:center; gap:10px; padding:6px 14px 6px 10px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); border-radius:999px; font-size:12px; font-weight:600; color:#e8e8e8; margin-bottom:28px; backdrop-filter:blur(12px); }
    .tc-hero-eyebrow-dot { width:6px; height:6px; border-radius:50%; background:#22c55e; box-shadow:0 0 0 3px rgba(34,197,94,.25); animation:tc-pulse 1.6s ease-in-out infinite; }
    @keyframes tc-pulse { 0%,100%{opacity:1}50%{opacity:.5} }
    .tc-hero-h1 { font-size:clamp(52px,8vw,108px); font-weight:800; letter-spacing:-.045em; line-height:.96; margin:0 0 24px; color:#fff; }
    .tc-hero-h1 i { font-style:italic; font-weight:700; color:#22c55e; }
    .tc-hero-h1 .tc-grad-text { color:unset; }
    .tc-hero-sub { font-size:17px; font-weight:400; color:#c8c8c8; line-height:1.55; max-width:500px; margin:0 0 36px; }
    /* Search */
    .tc-search { position:relative; z-index:25; display:flex; gap:0; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.1); border-radius:999px; padding:4px; backdrop-filter:blur(20px); max-width:620px; align-items:center; flex-wrap:wrap; }
    .tc-search-seg { display:flex; align-items:center; gap:8px; padding:10px 16px; font-size:13px; font-weight:600; color:#e8e8e8; cursor:pointer; position:relative; white-space:nowrap; border-radius:999px; transition:background .15s; }
    .tc-search-seg:hover { background:rgba(255,255,255,.06); }
    .tc-search-divider { width:1px; height:28px; background:rgba(255,255,255,.12); flex-shrink:0; margin:0 2px; }
    .tc-search-input { flex:1; min-width:120px; padding:10px 14px; background:transparent; border:none; color:#e8e8e8; font-family:'Sora',system-ui,sans-serif; font-size:13px; font-weight:500; outline:none; }
    .tc-search-input::placeholder { color:#555; }
    .tc-search-cta { padding:12px 20px; background:#22c55e; color:#052010; border:none; border-radius:999px; font-size:13px; font-weight:700; display:inline-flex; align-items:center; gap:8px; transition:background .15s; cursor:pointer; font-family:inherit; white-space:nowrap; flex-shrink:0; }
    .tc-search-cta:hover { background:#4ade80; }
    .tc-search-quicks { display:flex; gap:6px; margin-top:14px; flex-wrap:wrap; }
    .tc-quick-chip { padding:5px 13px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.1); border-radius:999px; font-size:12px; font-weight:500; color:#c8c8c8; transition:background .15s,color .15s; cursor:pointer; font-family:inherit; }
    .tc-quick-chip:hover { background:rgba(255,255,255,.1); color:#fff; }
    .tc-hero-side { display:flex; flex-direction:column; gap:12px; min-width:260px; }
    .tc-live-card { padding:20px 22px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.1); border-radius:20px; backdrop-filter:blur(20px); }
    .tc-live-head { display:flex; align-items:center; gap:8px; font-size:10px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#555; margin-bottom:10px; }
    .tc-live-dot { width:7px; height:7px; border-radius:50%; background:#22c55e; animation:tc-pulse 1.2s ease-in-out infinite; }
    .tc-live-stat { font-size:26px; font-weight:700; letter-spacing:-.03em; color:#fff; }
    .tc-live-label { font-size:12px; color:#c8c8c8; margin-top:8px; line-height:1.5; font-weight:400; }
    /* Trust */
    /* Sports */
    .tc-sports { padding:72px 40px; background:var(--tc-bg-a); border-bottom:1px solid rgba(255,255,255,.07); }
    .tc-sports-head { max-width:1360px; margin:0 auto 36px; display:flex; justify-content:space-between; align-items:flex-end; gap:24px; flex-wrap:wrap; }
    .tc-sports-h3 { font-size:32px; font-weight:700; letter-spacing:-.03em; margin:0; color:#f2f2f2; }
    .tc-sports-h3 i { font-style:italic; color:#22c55e; }
    .tc-sports-grid { max-width:1360px; margin:0 auto; display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
    .tc-sport-card { position:relative; height:260px; border-radius:18px; overflow:hidden; border:1px solid rgba(255,255,255,.07); display:flex; flex-direction:column; justify-content:flex-end; padding:20px 22px; cursor:pointer; transition:border-color .3s,transform .3s; text-decoration:none; }
    .tc-sport-card:hover { border-color:rgba(34,197,94,.3); transform:translateY(-3px); }
    .tc-sport-bg { position:absolute; inset:0; background-size:cover; background-position:center; transition:transform .5s; }
    .tc-sport-card:hover .tc-sport-bg { transform:scale(1.05); }
    .tc-sport-bg::after { content:''; position:absolute; inset:0; background:linear-gradient(0deg,rgba(5,5,5,.95),transparent 60%); }
    .tc-sport-content { position:relative; z-index:2; }
    .tc-sport-count { font-size:10px; color:#888; letter-spacing:.1em; text-transform:uppercase; font-weight:600; margin-bottom:6px; }
    .tc-sport-name { font-size:22px; font-weight:800; letter-spacing:-.02em; color:#fff; }
    /* Clubs */
    .tc-clubs { padding:80px 40px; background:#080808; border-top:1px solid rgba(255,255,255,.07); }
    .tc-clubs-inner { max-width:1360px; margin:0 auto; }
    .tc-clubs-h { font-size:28px; font-weight:700; letter-spacing:-.025em; color:#f2f2f2; margin:0 0 32px; display:flex; align-items:center; gap:10px; }
    .tc-club-card { background:#111; border:1px solid rgba(255,255,255,.08); border-radius:16px; overflow:hidden; transition:border-color .2s,transform .2s; display:flex; flex-direction:column; text-decoration:none; height:100%; }
    .tc-club-card:hover { border-color:rgba(34,197,94,.25); transform:translateY(-2px); }
    .tc-club-img { height:160px; background:#1a1a1a; position:relative; flex-shrink:0; }
    .tc-club-body { padding:18px 20px; flex:1; display:flex; flex-direction:column; gap:4px; }
    .tc-club-name { font-size:17px; font-weight:800; color:#f2f2f2; margin:0; }
    .tc-club-addr { font-size:13px; color:#777; margin:0; }
    .tc-club-cta { margin-top:auto; padding-top:14px; display:block; text-align:center; background:#22c55e; color:#052010; border-radius:10px; padding:10px; font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; transition:background .15s; }
    .tc-club-cta:hover { background:#4ade80; }
    /* Section wrapper */
    .tc-sec-w { max-width:1360px; margin:0 auto; padding:100px 40px; }
    .tc-eyebrow { display:inline-flex; align-items:center; gap:10px; font-size:11px; font-weight:700; letter-spacing:.16em; text-transform:uppercase; color:#555; margin-bottom:20px; }
    .tc-eyebrow::before { content:''; display:inline-block; width:24px; height:1px; background:#555; }
    .tc-sec-h { font-size:clamp(36px,4.5vw,60px); font-weight:700; letter-spacing:-.035em; line-height:1.02; margin:0 0 20px; color:#f2f2f2; }
    .tc-sec-h b { font-weight:900; }
    .tc-sec-h i { font-style:italic; color:#22c55e; }
    .tc-sec-sub { font-size:16px; font-weight:400; color:#c8c8c8; line-height:1.55; max-width:560px; margin:0 0 52px; }
    /* Values */
    .tc-values-band { border-top:1px solid rgba(255,255,255,.07); background:var(--tc-bg-b); }
    .tc-values-grid { display:grid; grid-template-columns:1fr 1fr; gap:80px; align-items:start; }
    .tc-values-h { position:sticky; top:90px; }
    .tc-values-list { display:flex; flex-direction:column; }
    .tc-value { padding:36px 0; border-top:1px solid rgba(255,255,255,.07); display:grid; grid-template-columns:72px 1fr; gap:24px; align-items:start; }
    .tc-value:first-child { border-top:0; padding-top:0; }
    .tc-value-num { font-size:34px; font-weight:700; color:#2a2a2a; letter-spacing:-.04em; line-height:1; }
    .tc-value-body h4 { margin:0 0 8px; font-size:20px; font-weight:800; color:#f2f2f2; }

    .tc-value-body p { margin:0; color:#c8c8c8; font-size:14px; line-height:1.7; max-width:400px; }
    /* Stats */
    /* Steps */
    .tc-step:hover { background:#0f0f0f; }
    .tc-step-num { font-weight:800; font-size:60px; color:#2a2a2a; line-height:1; letter-spacing:-.05em; margin-bottom:24px; transition:color .3s; }
    .tc-step:hover .tc-step-num { color:#22c55e; }
    .tc-step-foot { margin-top:24px; padding-top:24px; border-top:1px solid rgba(255,255,255,.07); font-size:12px; color:#555; display:flex; align-items:center; gap:8px; }
    .tc-step-foot b { color:#f2f2f2; font-weight:700; }
    /* Owner */
    .tc-owner { --tc-owner-parallax:0px; position:relative; isolation:isolate; border-top:1px solid rgba(255,255,255,.07); background:#050505; overflow:hidden; }
    .tc-owner-media { position:absolute; inset:0; overflow:hidden; pointer-events:none; z-index:0; transform:translate3d(0,var(--tc-owner-parallax),0); will-change:transform; }
    .tc-owner-media-img { position:absolute; inset:-4%; background-image:url('https://images.pexels.com/photos/32474981/pexels-photo-32474981.jpeg?auto=compress&cs=tinysrgb&w=1800'); background-size:cover; background-position:center; opacity:.58; transform:scale(1.03); will-change:transform; animation:tc-owner-kenburns 24s ease-in-out infinite alternate; }
    .tc-owner::after { content:''; position:absolute; inset:0; background:linear-gradient(112deg,rgba(5,8,6,.88) 12%,rgba(6,8,7,.7) 48%,rgba(5,5,5,.86) 100%),linear-gradient(180deg,rgba(5,5,5,.05) 0%,rgba(5,5,5,.72) 100%); z-index:1; pointer-events:none; }
    .tc-owner-inner { position:relative; z-index:2; max-width:1360px; margin:0 auto; padding:106px 40px; display:grid; grid-template-columns:1.05fr .95fr; gap:72px; align-items:center; }
    .tc-owner .tc-sec-h { max-width:620px; }
    .tc-owner .tc-sec-sub { max-width:520px; margin-bottom:30px; color:#d3d3d3; }
    .tc-owner-side { padding:34px; border:1px solid rgba(255,255,255,.16); border-radius:20px; background:rgba(6,10,8,.58); backdrop-filter:blur(8px); }
    .tc-owner-side-h { font-size:10px; color:#7f8d86; font-weight:700; letter-spacing:.14em; text-transform:uppercase; margin-bottom:20px; }
    .tc-owner-perk { display:flex; gap:14px; align-items:center; padding:13px 0; border-top:1px solid rgba(255,255,255,.07); font-size:13px; color:#c8c8c8; font-weight:400; }
    .tc-owner-perk:first-child { border-top:0; padding-top:0; }
    .tc-owner-perk b { color:#f2f2f2; font-size:16px; letter-spacing:-.02em; min-width:90px; font-weight:800; }
    .tc-owner-ctas { display:flex; gap:10px; margin-top:32px; flex-wrap:wrap; }
    @keyframes tc-owner-kenburns {
      0% { transform:scale(1.03) translate3d(-1.2%, -0.8%, 0); }
      50% { transform:scale(1.07) translate3d(0.9%, 1.1%, 0); }
      100% { transform:scale(1.05) translate3d(-0.6%, 1.3%, 0); }
    }
    /* FAQ */
    .tc-faq-band { border-top:1px solid rgba(255,255,255,.07); background:linear-gradient(180deg,var(--tc-bg-a) 0%,var(--tc-bg-c) 100%); }
    .tc-faq-grid { display:grid; grid-template-columns:1fr 1.2fr; gap:72px; align-items:start; }
    .tc-faq-list { position:relative; display:flex; flex-direction:column; padding-left:26px; }
    .tc-faq-list::before { content:''; position:absolute; left:0; top:6px; bottom:6px; width:1px; background:linear-gradient(180deg,rgba(34,197,94,.45) 0%,rgba(255,255,255,.06) 100%); }
    .tc-faq-item { border-top:1px solid rgba(255,255,255,.07); padding:22px 0 22px 2px; cursor:pointer; }
    .tc-faq-item:last-child { border-bottom:1px solid rgba(255,255,255,.07); }
    .tc-faq-q { display:flex; justify-content:space-between; align-items:center; gap:16px; font-size:16px; font-weight:700; color:#f2f2f2; }
    .tc-faq-icon { flex-shrink:0; color:#555; transition:transform .3s,color .3s; }
    .tc-faq-item.tc-open .tc-faq-icon { transform:rotate(45deg); color:#22c55e; }
    .tc-faq-a { max-height:0; overflow:hidden; transition:max-height .4s cubic-bezier(.2,.6,.2,1),margin .3s; color:#c8c8c8; font-size:14px; line-height:1.7; }
    .tc-faq-item.tc-open .tc-faq-a { max-height:300px; margin-top:14px; }
    /* Closing */
    .tc-closing { --tc-closing-parallax:0px; position:relative; isolation:isolate; border-top:1px solid rgba(255,255,255,.07); padding:100px 40px 80px; background:#050505; overflow:hidden; }
    .tc-closing-media { position:absolute; inset:0; overflow:hidden; pointer-events:none; z-index:0; transform:translate3d(0,var(--tc-closing-parallax),0); will-change:transform; }
    .tc-closing-media-img { position:absolute; inset:-4%; background-image:url('/closing-botines.jpg'); background-size:cover; background-position:center 43%; opacity:.84; transform:scale(1.03); will-change:transform; animation:tc-closing-kenburns 26s ease-in-out infinite alternate; }
    .tc-closing::after { content:''; position:absolute; inset:0; background:linear-gradient(110deg,rgba(5,8,7,.52) 8%,rgba(5,5,5,.24) 48%,rgba(5,5,5,.5) 100%),linear-gradient(180deg,rgba(5,5,5,.03) 0%,rgba(5,5,5,.5) 92%); z-index:1; pointer-events:none; }
    .tc-closing-inner { position:relative; z-index:2; max-width:1360px; margin:0 auto; }
    .tc-big-closing { font-size:clamp(44px,7vw,88px); font-weight:800; letter-spacing:-.05em; line-height:.98; color:#f2f2f2; margin:0 0 36px; }
    .tc-big-closing i { font-style:italic; color:#22c55e; }
    .tc-closing-ctas { display:flex; gap:12px; flex-wrap:wrap; }
    @keyframes tc-closing-kenburns {
      0% { transform:scale(1.03) translate3d(-1.3%, -1.1%, 0); }
      50% { transform:scale(1.08) translate3d(1.2%, 0.9%, 0); }
      100% { transform:scale(1.05) translate3d(-0.7%, 1.2%, 0); }
    }
    @media (prefers-reduced-motion: reduce) {
      .tc-owner-media { transform:translate3d(0,0,0); }
      .tc-owner-media-img { animation:none; transform:scale(1.03); }
      .tc-closing-media { transform:translate3d(0,0,0); }
      .tc-closing-media-img { animation:none; transform:scale(1.03); }
    }
    /* Footer */
    .tc-foot { background:#0a0a0a; border-top:1px solid rgba(255,255,255,.06); padding:52px 40px 28px; }
    .tc-foot-inner { max-width:1360px; margin:0 auto; }
    .tc-foot-cols { display:grid; grid-template-columns:1.6fr repeat(3,1fr); gap:48px; padding-bottom:36px; border-bottom:1px solid rgba(255,255,255,.06); }
    .tc-foot-brand { display:flex; flex-direction:column; gap:12px; max-width:320px; }
    .tc-foot-brand-name { font-size:13px; font-weight:800; letter-spacing:.2em; text-transform:uppercase; color:#22c55e; }
    .tc-foot-brand p { font-size:13px; line-height:1.6; color:#555; margin:0; }
    .tc-foot-col h6 { font-size:11px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:#444; margin:0 0 14px; }
    .tc-foot-col ul { list-style:none; padding:0; margin:0; display:flex; flex-direction:column; gap:10px; }
    .tc-foot-col li a,.tc-foot-col li button { font-size:13px; color:#777; font-weight:500; transition:color .15s; background:none; border:none; padding:0; cursor:pointer; font-family:inherit; text-align:left; }
    .tc-foot-col li a:hover,.tc-foot-col li button:hover { color:#22c55e; }
    .tc-foot-base { padding-top:24px; display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap; font-size:12px; color:#444; margin-top:28px; }
    /* Contact panel */
    .tc-contact-overlay { position:fixed; inset:0; background:rgba(0,0,0,.7); z-index:60; transition:opacity .3s; }
    .tc-contact-panel { position:fixed; top:0; right:0; height:100%; width:100%; max-width:360px; background:#111; z-index:70; box-shadow:-8px 0 32px rgba(0,0,0,.5); transform:translateX(100%); transition:transform .3s ease-out; border-left:1px solid rgba(255,255,255,.08); }
    .tc-contact-panel.tc-open { transform:translateX(0); }
    /* Dropdowns */
    .tc-dropdown { position:absolute; top:calc(100% + 8px); left:0; min-width:220px; background:#111; border:1px solid rgba(255,255,255,.1); border-radius:12px; overflow:hidden; box-shadow:0 8px 24px rgba(0,0,0,.4); z-index:100; }
    /* Responsive */
    @media(max-width:1024px){
      .tc-hero-inner{grid-template-columns:1fr;gap:40px}
      .tc-hero-side{flex-direction:row;min-width:auto;width:100%}
      .tc-values-grid{grid-template-columns:1fr;gap:40px}
      .tc-values-h{position:static}
      .tc-owner-inner{grid-template-columns:1fr;gap:48px;padding:72px 32px}
      .tc-faq-grid{grid-template-columns:1fr;gap:40px}
      .tc-sports-grid{grid-template-columns:repeat(2,1fr)}
    }
    @media(max-width:900px){
    }
    @media(max-width:720px){
      .tc-hero{padding:100px 24px 56px;min-height:auto}
      .tc-sports{padding:52px 24px}
      .tc-sports-grid{grid-template-columns:1fr;gap:10px}
      .tc-sec-w{padding:64px 24px}
      .tc-clubs{padding:56px 24px}
      .tc-owner-inner{padding:56px 24px}
      .tc-closing{padding:72px 24px}
      .tc-foot{padding:44px 24px 24px}
      .tc-foot-cols{grid-template-columns:1fr 1fr;gap:28px}
      .tc-foot-brand{grid-column:1 / -1;max-width:none}
      .tc-search{border-radius:16px;padding:8px}
      .tc-search-divider{display:none}
    }
    @media(max-width:480px){
      .tc-foot-cols{grid-template-columns:1fr}
    }
    @keyframes tc-spin{to{transform:rotate(360deg)}}
    /* Scroll reveal */
    .tc-sr { opacity:0; transform:translateY(28px); transition:opacity .75s cubic-bezier(.2,.8,.2,1), transform .75s cubic-bezier(.2,.8,.2,1); }
    .tc-sr.tc-in { opacity:1; transform:translateY(0); }
    .tc-sr-d1 { transition-delay:.08s; }
    .tc-sr-d2 { transition-delay:.18s; }
    .tc-sr-d3 { transition-delay:.28s; }
    .tc-sr-d4 { transition-delay:.38s; }
    .tc-sr-up { opacity:0; transform:translateY(40px); transition:opacity .8s cubic-bezier(.2,.8,.2,1), transform .8s cubic-bezier(.2,.8,.2,1); }
    .tc-sr-up.tc-in { opacity:1; transform:translateY(0); }
    .tc-sr-left { opacity:0; transform:translateX(-24px); transition:opacity .75s cubic-bezier(.2,.8,.2,1), transform .75s cubic-bezier(.2,.8,.2,1); }
    .tc-sr-left.tc-in { opacity:1; transform:translateX(0); }
    .tc-sr-right { opacity:0; transform:translateX(24px); transition:opacity .75s cubic-bezier(.2,.8,.2,1), transform .75s cubic-bezier(.2,.8,.2,1); }
    .tc-sr-right.tc-in { opacity:1; transform:translateX(0); }
    /* Hero fade-in stagger */
    @keyframes tc-fade-up { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    .tc-hero-eyebrow { animation:tc-fade-up .7s ease both .05s; }
    .tc-hero-h1 { animation:tc-fade-up .85s ease both .18s; }
    .tc-hero-sub { animation:tc-fade-up .7s ease both .38s; }
    .tc-search { animation:tc-fade-up .7s ease both .52s; }
    .tc-search-quicks { animation:tc-fade-up .6s ease both .68s; }
    /* Hero stat bar */
    .tc-hero-stat { display:flex; align-items:center; gap:8px; margin-top:18px; font-size:13px; color:#555; font-weight:500; animation:tc-fade-up .6s ease both .82s; }
    .tc-hero-stat b { color:#22c55e; font-weight:700; }
    .tc-hero-stat-dot { width:6px; height:6px; border-radius:50%; background:#22c55e; opacity:.7; flex-shrink:0; }
    /* Marquee strip */
    .tc-marquee-wrap { overflow:hidden; border-bottom:1px solid rgba(255,255,255,.06); background:#080808; padding:20px 0; }
    .tc-marquee-track { display:flex; gap:14px; width:max-content; animation:tc-marquee 40s linear infinite; }
    .tc-marquee-wrap:hover .tc-marquee-track { animation-play-state:paused; }
    @keyframes tc-marquee { to { transform:translateX(-50%); } }
    .tc-marquee-item { display:inline-flex; align-items:center; gap:8px; padding:7px 16px; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07); border-radius:999px; font-size:12px; font-weight:600; color:#666; white-space:nowrap; transition:color .2s,border-color .2s; cursor:default; }
    .tc-marquee-item:hover { color:#c8c8c8; border-color:rgba(255,255,255,.14); }
    .tc-marquee-dot { width:5px; height:5px; border-radius:50%; background:#22c55e; opacity:.5; flex-shrink:0; }
    /* Sport card count overlay */
    .tc-sport-club-count { font-size:11px; color:var(--card-accent,#22c55e); font-weight:700; letter-spacing:.08em; margin-bottom:4px; opacity:.85; }
    /* Aurora orbs */
    .tc-aurora-orb { position:absolute; border-radius:50%; filter:blur(90px); pointer-events:none; will-change:transform; }
    .tc-aurora-1 { width:700px; height:500px; top:-150px; left:-140px; background:rgba(34,197,94,.1); animation:tc-aurora-1 16s ease-in-out infinite; }
    .tc-aurora-2 { width:580px; height:420px; bottom:-120px; right:8%; background:rgba(56,189,248,.07); animation:tc-aurora-2 20s ease-in-out infinite; }
    .tc-aurora-3 { width:360px; height:280px; top:35%; right:22%; background:rgba(167,139,250,.055); animation:tc-aurora-3 24s ease-in-out infinite; }
    @keyframes tc-aurora-1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(70px,-60px) scale(1.1)} 66%{transform:translate(-40px,50px) scale(.93)} }
    @keyframes tc-aurora-2 { 0%,100%{transform:translate(0,0) scale(1)} 40%{transform:translate(-90px,35px) scale(1.13)} 70%{transform:translate(55px,-25px) scale(.97)} }
    @keyframes tc-aurora-3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(50px,70px) scale(1.18)} }
    /* Gradient animated text */
    .tc-grad-text { display:inline-block; overflow:visible; padding-inline:.14em; margin-inline:-.14em; background:linear-gradient(90deg,#22c55e 0%,#86efac 35%,#4ade80 65%,#22c55e 100%); background-size:220% 100%; background-repeat:no-repeat; background-position:0% 50%; -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text; animation:tc-grad-shift 4.6s ease-in-out infinite alternate; font-style:italic; }
    @keyframes tc-grad-shift { from{background-position:0% 50%} to{background-position:100% 50%} }
    /* Rotating sport word */
    .tc-sport-word { display:inline-block; letter-spacing:0; line-height:1.02; overflow:visible; padding-inline:.1em; margin-inline:-.1em; transition:opacity .36s ease, transform .36s ease; }
    .tc-sport-word-out { opacity:0; transform:translateY(12px); }
    /* Sport card per-card glow */
    .tc-sport-card:hover { border-color:rgba(255,255,255,.12); transform:translateY(-5px); }
  `;

  return (
    <>
      <Head>
        <title>TuCancha — Reservá, jugá, encontrá jugadores</title>
      </Head>
      <style dangerouslySetInnerHTML={{ __html: tcCss }} />
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <div className="tc-root" onClick={() => {
        setShowCityDropdown(false);
        setShowSportDropdown(false);
        setShowUserMenu(false);
      }}>
      
      {/* ── HEADER ── */}
      <header className={`tc-header${navHidden ? ' tc-header-hidden' : ''}`}>
        <div className="tc-header-inner">
          <Link href="/" className="tc-brand">
            <span className="tc-brand-text">TuCancha</span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {user ? (
              <div style={{ position: 'relative' }}>
                <button className="tc-user-btn" onClick={(e) => { e.stopPropagation(); setShowUserMenu(p => !p); }}>
                  <div className="tc-user-avatar">
                    {userInitials}
                    {activeBookingsCount > 0 && (
                      <span style={{ position: 'absolute', top: -3, right: -3, background: '#22c55e', color: '#052010', fontSize: 9, fontWeight: 900, borderRadius: '50%', width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {activeBookingsCount}
                      </span>
                    )}
                  </div>
                  <span className="tc-user-name">{user.firstName || user.name || 'Usuario'}</span>
                </button>
                {showUserMenu && (
                  <div className="tc-user-menu" onClick={e => e.stopPropagation()}>
                    <div style={{ padding: '20px', textAlign: 'center', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
                      <div className="tc-user-avatar" style={{ width: 52, height: 52, borderRadius: '50%', fontSize: 16, margin: '0 auto 10px' }}>{userInitials}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#22c55e' }}>{user.firstName || user.name || 'Usuario'}</div>
                      <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 3 }}>{isAdmin ? 'Administrador' : 'Miembro'}</div>
                    </div>
                    <div style={{ padding: 6 }}>
                      {isAdmin && <Link href="/admin/agenda" onClick={() => setShowUserMenu(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, color: '#c8c8c8', fontSize: 13, fontWeight: 600 }}><ShieldCheck size={15} /> Gestión</Link>}
                      {isAdmin && adminClubSlug && <Link href={`/club/${adminClubSlug}`} onClick={() => setShowUserMenu(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, color: '#c8c8c8', fontSize: 13, fontWeight: 600 }}><MapPin size={15} /> Mi club</Link>}
                      <Link href="/perfil" onClick={() => setShowUserMenu(false)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, color: '#c8c8c8', fontSize: 13, fontWeight: 600 }}><Users size={15} /> Mi perfil</Link>
                      <Link href="/bookings" onClick={() => setShowUserMenu(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 12px', borderRadius: 10, color: '#c8c8c8', fontSize: 13, fontWeight: 600 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Calendar size={15} /> Mis reservas</span>
                        {activeBookingsCount > 0 && <span style={{ background: '#22c55e', color: '#052010', fontSize: 10, fontWeight: 800, borderRadius: 999, padding: '1px 7px' }}>{activeBookingsCount}</span>}
                      </Link>
                      <button type="button" onClick={() => { setShowLogoutModal(true); setShowUserMenu(false); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, color: '#f87171', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', width: '100%', cursor: 'pointer', fontFamily: 'inherit' }}>
                        <LogOut size={15} /> Cerrar sesión
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <button onClick={() => setShowContact(true)} className="tc-btn tc-btn-ghost">Contacto</button>
                <Link href="/login" className="tc-btn tc-btn-primary">Ingresar</Link>
              </>
            )}
            <button onClick={(e) => { e.stopPropagation(); user ? setShowUserMenu(p => !p) : setShowContact(true); }} style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', color: '#e8e8e8', padding: 4 }} className="md:hidden">
              <Menu size={22} />
            </button>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="tc-hero">
        <div className="tc-hero-visuals" aria-hidden="true">
          <div className="tc-hero-bg" />
          <div className="tc-hero-noise" />
          <div className="tc-aurora-orb tc-aurora-1" />
          <div className="tc-aurora-orb tc-aurora-2" />
          <div className="tc-aurora-orb tc-aurora-3" />
        </div>
        <div className="tc-hero-inner">
          <div className="tc-hero-copy">
            <span className="tc-hero-eyebrow">
              <span className="tc-hero-eyebrow-dot" />
              <span>Reservas deportivas en Argentina</span>
            </span>
            <h1 className="tc-hero-h1">
              Reservá<br />
              <span className={`tc-sport-word${heroWordVisible ? '' : ' tc-sport-word-out'}`}>
                <span className="tc-grad-text" style={{ backgroundImage: [
                  'linear-gradient(90deg,#22c55e 0%,#86efac 40%,#4ade80 100%)',
                  'linear-gradient(90deg,#0ea5e9 0%,#7dd3fc 40%,#38bdf8 100%)',
                  'linear-gradient(90deg,#f97316 0%,#fbbf24 40%,#fb923c 100%)',
                  'linear-gradient(90deg,#8b5cf6 0%,#c4b5fd 40%,#a78bfa 100%)',
                ][heroSportIdx] }}>{sportWords[heroSportIdx]}</span>
              </span>
              <br />al toque.
            </h1>
            <p className="tc-hero-sub">Sin llamadas, sin WhatsApp, sin esperas. Elegí deporte, zona y horario, confirmá online y jugá.</p>

            {/* Search bar */}
            <div ref={searchBarRef} className="tc-search" onClick={e => e.stopPropagation()}>
              {/* Sport selector */}
              <div className="tc-search-seg" style={{ position: 'relative' }} onClick={(e) => { e.stopPropagation(); setShowCityDropdown(false); closeDatepicker(); setShowSportDropdown(p => !p); }}>
                <span style={{ color: '#888', display: 'flex' }}>{selectedSport.icon}</span>
                <span>{selectedSport.label}</span>
                <ChevronDown size={12} style={{ color: '#666' }} />
                {showSportDropdown && (
                  <div className="tc-dropdown" onClick={e => e.stopPropagation()}>
                    <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,.08)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.14em', color: '#555' }}>Elegí deporte</div>
                    {sportOptions.map(sport => (
                      <button key={sport.value} onClick={() => { setSearchSport(sport.value); setShowSportDropdown(false); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 16px', background: searchSport === sport.value ? 'rgba(34,197,94,.1)' : 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: searchSport === sport.value ? '#22c55e' : '#c8c8c8', fontSize: 14, fontWeight: 600 }}>
                        <span style={{ color: searchSport === sport.value ? '#22c55e' : '#666', display: 'flex' }}>{sport.icon}</span>
                        {sport.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="tc-search-divider" />
              {/* Location */}
              <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
                <input
                  id="cityInput"
                  type="text"
                  placeholder="¿Dónde jugás?"
                  className="tc-search-input"
                  value={searchCity}
                  onChange={(e) => { const v = e.target.value; setSearchCity(v); if (!v.trim()) setSelectedLocation(null); setShowCityDropdown(true); }}
                  onFocus={(e) => { e.target.select(); setShowSportDropdown(false); closeDatepicker(); setShowCityDropdown(true); }}
                  autoComplete="off"
                />
                {showCityDropdown && (
                  <div className="tc-dropdown" style={{ minWidth: 280 }} onClick={e => e.stopPropagation()}>
                    <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,.08)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.14em', color: '#555' }}>Lugares disponibles</div>
                    <ul style={{ maxHeight: 220, overflowY: 'auto', margin: 0, padding: 0, listStyle: 'none' }}>
                      {loadingLocations ? (
                        <li style={{ padding: '16px', textAlign: 'center', color: '#555', fontSize: 13 }}>Cargando...</li>
                      ) : locationSuggestions.length > 0 ? (
                        locationSuggestions.map((loc, i) => (
                          <li key={i} onClick={() => selectCity(loc)} style={{ padding: '11px 16px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#c8c8c8', fontWeight: 500, transition: 'background .15s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.05)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <MapPin size={13} style={{ color: '#22c55e', flexShrink: 0 }} />
                            <div><div style={{ fontWeight: 600, color: '#f2f2f2' }}>{loc.label}</div><div style={{ fontSize: 11, color: '#555' }}>{loc.country}</div></div>
                          </li>
                        ))
                      ) : (
                        <li style={{ padding: '16px', textAlign: 'center', color: '#555', fontSize: 13 }}>Sin resultados</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
              <div className="tc-search-divider" />
              {/* Date */}
              <div className="tc-search-seg" onClick={() => { setShowCityDropdown(false); setShowSportDropdown(false); }}>
                <Calendar size={13} style={{ color: '#666' }} />
                <DatePickerDark
                  selected={searchDate ? (() => { const [y,m,d] = searchDate.split('-').map(Number); return new Date(y,m-1,d); })() : null}
                  onChange={(date: Date | null) => { if (!date) { setSearchDate(''); return; } setSearchDate(formatLocalDate(date)); }}
                  minDate={getEffectiveToday()}
                  showIcon={false}
                  inputSize="compact"
                  dateFormat="dd MMM"
                  inputClassName="bg-transparent border-none outline-none font-semibold text-xs p-0 w-[64px] cursor-pointer focus:ring-0"
                  variant="dark"
                />
              </div>
              {/* CTA */}
              <button className="tc-search-cta" onClick={handleSearch} disabled={isSearching}>
                {isSearching ? 'Buscando...' : 'Buscar'}
                <Search size={13} />
              </button>
            </div>

            <div className="tc-search-quicks">
              {locationOptions.slice(0, 4).map((loc, i) => (
                <button key={i} className="tc-quick-chip" onClick={() => selectCity(loc)}>{loc.label}</button>
              ))}
            </div>
            {!loadingClubs && clubs.length > 0 && (
              <div className="tc-hero-stat">
                <span className="tc-hero-stat-dot" />
                <span><b>{clubs.length}</b> clubes disponibles en Argentina</span>
              </div>
            )}
          </div>

          <div className="tc-hero-side">
            <div className="tc-live-card">
              <div className="tc-live-head"><span className="tc-live-dot" />Disponibilidad</div>
              <div className="tc-live-stat">Al instante</div>
              <div className="tc-live-label">Ves qué canchas hay libres ahora mismo. Sin WhatsApp, sin esperar respuesta.</div>
            </div>
            <div className="tc-live-card">
              <div className="tc-live-head">Confirmación</div>
              <div className="tc-live-stat" style={{ fontSize: 20 }}>30 segundos</div>
              <div className="tc-live-label">Reservás, confirmás y listo. Tu turno queda guardado al instante.</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── MARQUEE STRIP ── */}
      {!loadingClubs && clubs.length > 0 && (
        <div className="tc-marquee-wrap">
          <div className="tc-marquee-track">
            {[...clubs, ...clubs].map((club, i) => (
              <div key={i} className="tc-marquee-item">
                <span className="tc-marquee-dot" />
                {club.name}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SPORTS GRID ── */}
      <section className="tc-sports">
        <div className="tc-sports-head">
          <h3 className="tc-sports-h3 tc-sr">Jugá lo que quieras, <i>donde quieras</i>.</h3>
        </div>
        <div className="tc-sports-grid">
          {[
            {
              name: 'Fútbol',
              sub: 'F5 · F7 · F11',
              sport: 'futbol',
              bg: 'linear-gradient(135deg,#061a0a,#0d2e12)',
              photo: 'https://images.pexels.com/photos/27394466/pexels-photo-27394466.jpeg?auto=compress&cs=tinysrgb&w=1600',
              bgPosition: 'center 52%',
              accent: '#22c55e',
              countKey: 'futbol' as const
            },
            {
              name: 'Pádel',
              sub: 'Cubierto & Panorámico',
              sport: 'padel',
              bg: 'linear-gradient(135deg,#06121a,#0c1e33)',
              photo: 'https://images.pexels.com/photos/32897038/pexels-photo-32897038.jpeg?auto=compress&cs=tinysrgb&w=1600',
              bgPosition: 'center 42%',
              accent: '#38bdf8',
              countKey: 'padel' as const
            },
            {
              name: 'Tenis',
              sub: 'Polvo & cemento',
              sport: 'tenis',
              bg: 'linear-gradient(135deg,#1a0e06,#2e1a08)',
              photo: 'https://images.pexels.com/photos/19872965/pexels-photo-19872965.jpeg?auto=compress&cs=tinysrgb&w=1600',
              bgPosition: 'center 54%',
              accent: '#fb923c',
              countKey: 'tenis' as const
            },
            {
              name: 'Otros deportes',
              sub: 'Hockey · Vóley · Básquet',
              sport: '',
              bg: 'linear-gradient(135deg,#0e081a,#180f2e)',
              photo: 'https://images.pexels.com/photos/9716286/pexels-photo-9716286.jpeg?auto=compress&cs=tinysrgb&w=1600',
              bgPosition: 'center',
              accent: '#a78bfa',
              countKey: 'otros' as const
            },
          ].map((s, si) => (
            <div key={s.name} className={`tc-sport-card tc-sr tc-sr-d${si + 1}`} style={{'--card-accent': s.accent} as React.CSSProperties} onClick={() => router.push({ pathname: '/complejos', query: s.sport ? { sport: s.sport } : {} })}>
              <div
                className="tc-sport-bg"
                style={{
                  background: s.bg,
                  backgroundImage: s.photo
                    ? `linear-gradient(160deg, rgba(5,8,6,.2) 0%, rgba(5,5,5,.55) 58%, rgba(5,5,5,.82) 100%), url('${s.photo}')`
                    : undefined,
                  backgroundPosition: s.bgPosition || 'center',
                }}
              />
              <div className="tc-sport-content">
                {!loadingClubs && sportClubCounts[s.countKey] > 0 && (
                  <div className="tc-sport-club-count">{sportClubCounts[s.countKey]} clubes</div>
                )}
                <div className="tc-sport-count">{s.sub}</div>
                <div className="tc-sport-name">{s.name} →</div>
              </div>
            </div>
          ))}
        </div>
      </section>
      {/* ── VALUES (POR QUÉ TUCANCHA) ── */}
      <section className="tc-values-band">
        <div className="tc-sec-w">
          <div className="tc-values-grid">
            <div className="tc-values-h tc-sr-left">
              <span className="tc-eyebrow">Por qué TuCancha</span>
              <h2 className="tc-sec-h">La forma más<br /><b>fluida</b> de <i>jugar</i>.</h2>
              <p className="tc-sec-sub">Nada de llamadas, esperar respuestas o señas por WhatsApp. Encontrás la cancha, confirmás y listo.</p>
            </div>
            <div className="tc-values-list">
              {[
                { num: '01', title: 'Confirmación al instante', desc: 'Si la cancha está libre, es tuya en segundos. Sin "te confirmo más tarde", sin esperar que alguien te conteste.' },
                { num: '02', title: 'Clubes verificados', desc: 'Cada complejo pasa por un control antes de entrar. Fotos reales, precios actualizados, horarios al día.' },
                { num: '03', title: 'Cancelás sin drama', desc: '¿Lluvia? ¿Se cae un jugador? Modificás o cancelás desde la app, con anticipación y sin llamar a nadie.' },
                { num: '04', title: 'Pagá como arreglás', desc: 'Online con tarjeta o en efectivo al llegar. Cada club tiene sus opciones y las ves claras antes de confirmar.' },
              ].map((v, vi) => (
                <div key={v.num} className={`tc-value tc-sr tc-sr-d${vi + 1}`}>
                  <div className="tc-value-num">{v.num}</div>
                  <div className="tc-value-body"><h4>{v.title}</h4><p>{v.desc}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── OWNER (PARA COMPLEJOS) ── */}
      <section ref={ownerSectionRef} className="tc-owner">
        <div className="tc-owner-media" aria-hidden="true">
          <div className="tc-owner-media-img" />
        </div>
        <div className="tc-owner-inner">
          <div className="tc-sr-left">
            <span className="tc-eyebrow">Para complejos</span>
            <h2 className="tc-sec-h">Convertí horas libres en<br /><i>reservas confirmadas</i>.</h2>
            <p className="tc-sec-sub">Digitalizá tu operación en un panel claro: agenda, cobros y comunicación con jugadores, todo en un mismo lugar.</p>
            <div className="tc-owner-ctas">
              <button className="tc-btn tc-btn-primary" onClick={() => setShowContact(true)}>Registrá tu complejo →</button>
            </div>
          </div>
          <div className="tc-owner-side tc-sr-right">
            <div className="tc-owner-side-h">Qué resolvemos</div>
            <div>
              {[
                { b: 'Agenda', t: 'Horarios y canchas en tiempo real, sin cruces ni planillas.' },
                { b: 'Cobros', t: 'Pagos más ordenados y trazables, en un flujo simple.' },
                { b: 'Clientes', t: 'Confirmaciones automáticas y acompañamiento desde el inicio.' },
              ].map(p => (
                <div key={p.b} className="tc-owner-perk"><b>{p.b}</b>{p.t}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="tc-faq-band" onClick={() => setOpenFaqIndex(null)}>
        <div className="tc-sec-w">
          <div className="tc-faq-grid">
            <div className="tc-sr-up">
              <span className="tc-eyebrow">FAQ</span>
              <h2 className="tc-sec-h">Preguntas<br /><i>frecuentes</i>.</h2>
              <p className="tc-sec-sub">Todo lo que necesitás saber antes de reservar.</p>
              <button className="tc-btn tc-btn-ghost" onClick={() => setShowContact(true)} style={{ marginTop: 4 }}>Escribinos →</button>
            </div>
            <div className="tc-faq-list">
              {[
                { q: '¿Tengo que pagar para usar TuCancha?', a: 'No. Usar la app es gratis. Solo pagás el valor de la cancha que reservás, igual que si llamaras al complejo directamente — sin recargos ocultos.' },
                { q: '¿Puedo cancelar una reserva si no puedo ir?', a: 'Sí. Cada complejo define su política de cancelación, pero la mayoría permite cancelar sin costo hasta horas antes del turno. Lo ves claramente antes de pagar.' },
                { q: '¿Qué pasa si llueve el día de mi partido?', a: 'Si el complejo suspende por lluvia, se gestiona el reintegro o podés cambiar de fecha según la política del club. Si es cancha cubierta, siempre se juega.' },
                { q: '¿Con cuánta anticipación puedo reservar?', a: 'Podés reservar con hasta 30 días de anticipación. Recomendamos asegurar el lugar temprano, especialmente en horarios pico (18:00 a 22:00).' },
                { q: '¿Puedo gestionar más de una cancha?', a: 'Sí. La plataforma es totalmente flexible. Configurás múltiples canchas, horarios diferenciados por día y precios por deporte desde el panel de administración.' },
              ].map((item, idx) => (
                <div
                  key={idx}
                  ref={el => { faqRefs.current[idx] = el; }}
                  className={`tc-faq-item${openFaqIndex === idx ? ' tc-open' : ''}`}
                  onClick={e => { e.stopPropagation(); setOpenFaqIndex(openFaqIndex === idx ? null : idx); }}
                >
                  <div className="tc-faq-q">
                    {item.q}
                    <svg className="tc-faq-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 5v14M5 12h14" /></svg>
                  </div>
                  <div className="tc-faq-a">{item.a}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CLOSING CTA ── */}
      <section ref={closingSectionRef} className="tc-closing">
        <div className="tc-closing-media" aria-hidden="true">
          <div className="tc-closing-media-img" />
        </div>
        <div className="tc-closing-inner">
          <div className="tc-big-closing tc-sr-up">
            Ponete los botines.<br /><i>Nosotros nos encargamos del resto.</i>
          </div>
          <div className="tc-closing-ctas tc-sr tc-sr-d2">
            <button className="tc-btn tc-btn-primary" onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setTimeout(() => document.getElementById('cityInput')?.focus(), 600); }}>
              Buscar cancha →
            </button>
            <button className="tc-btn tc-btn-ghost" onClick={() => setShowContact(true)}>Contactar</button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="tc-foot">
        <div className="tc-foot-inner">
          <div className="tc-foot-cols">
            <div className="tc-foot-brand">
              <span className="tc-foot-brand-name">TuCancha</span>
              <p>La plataforma para reservar canchas en Argentina. Hecha por jugadores, para jugadores.</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { href: 'https://wa.me/5493513436163', label: 'WhatsApp', icon: <Phone size={15} /> },
                  { href: 'mailto:soporte.tucancha@gmail.com', label: 'Email', icon: <Mail size={15} /> },
                  { href: 'https://www.instagram.com/tucancha.app_/', label: 'Instagram', icon: <Instagram size={15} /> },
                ].map(s => (
                  <a key={s.label} href={s.href} target="_blank" rel="noopener" aria-label={s.label}
                    style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', transition: 'color .15s, border-color .15s' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#22c55e'; e.currentTarget.style.borderColor = 'rgba(34,197,94,.3)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = '#555'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.08)'; }}>
                    {s.icon}
                  </a>
                ))}
              </div>
            </div>
            <div className="tc-foot-col">
              <h6>Jugadores</h6>
              <ul>
                <li><Link href="/bookings">Mis reservas</Link></li>
                <li><Link href="/login">Crear cuenta</Link></li>
              </ul>
            </div>
            <div className="tc-foot-col">
              <h6>Complejos</h6>
              <ul>
                <li><button onClick={() => setShowContact(true)}>Sumá tu complejo</button></li>
                <li><button onClick={() => setShowContact(true)}>Contactar ventas</button></li>
              </ul>
            </div>
            <div className="tc-foot-col">
              <h6>Soporte</h6>
              <ul>
                <li><a href="mailto:soporte.tucancha@gmail.com">soporte.tucancha@gmail.com</a></li>
                <li><a href="https://wa.me/5493513436163" target="_blank" rel="noopener">WhatsApp</a></li>
              </ul>
            </div>
          </div>
          <div className="tc-foot-base">
            <span>© {new Date().getFullYear()} TuCancha · Hecho en Argentina · Con pasión por el juego</span>
          </div>
        </div>
      </footer>

      {/* ── CONTACT SIDEBAR ── */}
      <div className="tc-contact-overlay" style={{ opacity: showContact ? 1 : 0, pointerEvents: showContact ? 'auto' : 'none' }} onClick={() => setShowContact(false)} />
      <div
        ref={sidebarRef}
        className={`tc-contact-panel${showContact ? ' tc-open' : ''}`}
        style={{
          transform: showContact ? 'translateX(0)' : 'translateX(100%)',
          visibility: showContact ? 'visible' : 'hidden',
          pointerEvents: showContact ? 'auto' : 'none',
        }}
        aria-hidden={!showContact}
      >
        <div style={{ padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#22c55e', margin: 0 }}>Contacto</h2>
          <button onClick={() => setShowContact(false)} style={{ background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.2)', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#f87171' }}><X size={16} /></button>
        </div>
        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 13, color: '#777', lineHeight: 1.6, margin: 0 }}>¿Tenés dudas o querés dar de alta tu club? Escribinos.</p>
          {([
            { type: 'whatsapp' as const, label: 'WhatsApp', value: '+54 351 343 6163', icon: <Phone size={16} /> },
            { type: 'email' as const, label: 'Email', value: 'soporte.tucancha@gmail.com', icon: <Mail size={16} /> },
          ]).map(c => (
            <button key={c.type} type="button" onClick={e => openContactMenu(e, c.type)}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'border-color .15s', width: '100%' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(34,197,94,.3)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,.08)')}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(34,197,94,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#22c55e', flexShrink: 0 }}>{c.icon}</div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: '#555' }}>{c.label}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#f2f2f2' }}>{c.value}</div>
              </div>
            </button>
          ))}
          <div style={{ marginTop: 8, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.07)' }}>
            <button type="button" onClick={e => openContactMenu(e, 'instagram')} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', color: '#e8e8e8', fontSize: 13, fontWeight: 600 }}>
              <Instagram size={15} /> @tucancha.app_
            </button>
          </div>
          {contactMenu && (
            <div ref={menuRef} role="dialog" style={{ position: 'absolute', top: contactMenu.top, left: contactMenu.left, zIndex: 90, background: '#1a1a1a', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, padding: 6, minWidth: 150, boxShadow: '0 8px 24px rgba(0,0,0,.4)' }}>
              <button onClick={() => handleOpenHref(contactMenu.href)} style={{ display: 'block', width: '100%', padding: '9px 13px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: '#f2f2f2', fontWeight: 500, textAlign: 'left', borderRadius: 8 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>Abrir</button>
              <button onClick={() => handleCopy(contactMenu.copyText)} style={{ display: 'block', width: '100%', padding: '9px 13px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: '#f2f2f2', fontWeight: 500, textAlign: 'left', borderRadius: 8 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>{copied ? '¡Copiado!' : 'Copiar'}</button>
            </div>
          )}
        </div>
      </div>

      <AppModal
        show={showLogoutModal}
        title="Cerrar sesión"
        message="¿Seguro que querés cerrar sesión?"
        isWarning
        confirmText="Salir"
        cancelText="Cancelar"
        onConfirm={() => { setShowLogoutModal(false); logout(); setUser(null); }}
        onClose={() => setShowLogoutModal(false)}
        onCancel={() => setShowLogoutModal(false)}
      />

      </div>{/* end tc-root */}
    </>
  );
}

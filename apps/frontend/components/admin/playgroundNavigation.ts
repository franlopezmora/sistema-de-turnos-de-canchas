import {
  BarChart3,
  CalendarDays,
  CreditCard,
  FileText,
  MessageSquare,
  Receipt,
  Settings,
  ShoppingBag,
  Trophy,
  Users,
} from 'lucide-react';

export type PlaygroundSidebarItem = {
  label: string;
  icon: typeof CalendarDays;
  href?: string;
};

export const PLAYGROUND_SIDEBAR_ITEMS: PlaygroundSidebarItem[] = [
  { label: 'Calendario', icon: CalendarDays, href: '/admin/agenda-playground2' },
  { label: 'Clientes', icon: Users, href: '/admin/clientes-playground2' },
  { label: 'Pagos', icon: CreditCard, href: '/admin/pagos-playground' },
  { label: 'Reservas', icon: Receipt },
  { label: 'Partidos', icon: Trophy },
  { label: 'Tienda', icon: ShoppingBag },
  { label: 'Mensajes', icon: MessageSquare },
  { label: 'Facturación', icon: FileText },
  { label: 'Informes', icon: BarChart3 },
  { label: 'Ajustes', icon: Settings },
];

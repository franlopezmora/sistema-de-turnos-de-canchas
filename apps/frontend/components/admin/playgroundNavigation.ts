import {
  BarChart3,
  CalendarDays,
  CreditCard,
  MessageSquare,
  Receipt,
  ScrollText,
  Settings,
  ShoppingBag,
  Users,
} from 'lucide-react';

export type PlaygroundSidebarItem = {
  label: string;
  icon: typeof CalendarDays;
  href: string;
  comingSoon?: boolean;
};

export const PLAYGROUND_SIDEBAR_ITEMS: PlaygroundSidebarItem[] = [
  { label: 'Calendario', icon: CalendarDays, href: '/admin/agenda' },
  { label: 'Clientes', icon: Users, href: '/admin/clientes' },
  { label: 'Caja', icon: CreditCard, href: '/admin/caja' },
  { label: 'Reservas', icon: Receipt, href: '/admin/reservas', comingSoon: true },
  { label: 'Tienda', icon: ShoppingBag, href: '/admin/tienda' },
  { label: 'Mensajes', icon: MessageSquare, href: '/admin/mensajes', comingSoon: true },
  { label: 'Facturacion', icon: ScrollText, href: '/admin/facturacion', comingSoon: true },
  { label: 'Informes', icon: BarChart3, href: '/admin/informes' },
  { label: 'Ajustes', icon: Settings, href: '/admin/ajustes' },
];

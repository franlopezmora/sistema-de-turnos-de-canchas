// ARCHIVO: services/BookingService.ts

// Si tienes el AuthService en otra carpeta, ajusta esta línea "../services/AuthService"
// Si no lo encuentras, puedes borrar el import y usar localStorage.getItem('token') directo.
import { getToken } from './AuthService';
import { fetchWithAuth } from '../utils/apiClient';

const GUEST_KEY = 'guestId';
function getOrCreateGuestId() {
  try {
    const existing = localStorage.getItem(GUEST_KEY);
    if (existing) return existing;
    const id = (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : `guest_${Math.random().toString(36).slice(2,10)}`;
    localStorage.setItem(GUEST_KEY, id);
    return id;
  } catch (e) {
    return `guest_${Math.random().toString(36).slice(2,10)}`;
  }
}

import { getApiUrl } from '../utils/apiUrl';
import { ClubService } from './ClubService';
import { ClubAdminService } from './ClubAdminService';
import { hasAdminAccess, normalizeSessionUser } from '../utils/session';
import { getOrCreateBookingAccount, getAccountSummary, getAccountById, registerPayment } from './AccountService';

const apiBase = () => `${getApiUrl()}/api`;

// --- 1. CREAR UNA RESERVA ---
export const createBooking = async (
  courtId: number,
  activityId: number,
  date: Date,
  slotTime?: string,
  userId?: number,
  // 👇 Aceptamos 'dni' también en el tipo para evitar errores de TS
  guestInfo?: { name?: string; email?: string; phone?: string; guestDni?: string; dni?: string },
  options?: { asGuest?: boolean; guestIdentifier?: string; isProfessor?: boolean; durationMinutes?: number; openAccount?: boolean }
) => {
  const token = getToken();
  const guestId = token ? undefined : getOrCreateGuestId();
  const guestIdentifier = options?.guestIdentifier ?? guestId;

  // 👇 Truco: Unificamos el valor del DNI venga como venga
  const dniValue = guestInfo?.guestDni || guestInfo?.dni;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetchWithAuth(`${apiBase()}/bookings`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      courtId,
      activityId,
      ...(slotTime ? {
        date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        slotTime
      } : { startDateTime: date.toISOString() }),
      ...(guestIdentifier ? { guestIdentifier } : {}),
      ...(guestInfo?.name ? { guestName: guestInfo.name } : {}),
      ...(guestInfo?.email ? { guestEmail: guestInfo.email } : {}),
      ...(guestInfo?.phone ? { guestPhone: guestInfo.phone } : {}),
      
      // 👇 ENVÍO ROBUSTO DEL DNI (Lo mandamos con ambos nombres por seguridad)
      ...(dniValue ? { guestDni: dniValue, dni: dniValue } : {}),

      ...(options?.asGuest ? { asGuest: true } : {}),
        ...(options?.isProfessor ? { isProfessor: true } : {}),
        ...(Number.isFinite(options?.durationMinutes) ? { durationMinutes: options?.durationMinutes } : {}),
      ...(options?.openAccount ? { openAccount: true } : {}),
      
      // El ID del usuario si corresponde
      ...(userId ? { userId } : {}) 
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || errorData.message || 'Error al reservar');
  }

  return response.json();
};

// --- 2. OBTENER MIS RESERVAS (HISTORIAL) ---
export const getMyBookings = async (userId: number) => {
    if (!getToken()) throw new Error("Debes iniciar sesión.");

    const res = await fetchWithAuth(`${apiBase()}/bookings/history/${userId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    });

    if (!res.ok) {
        throw new Error('Error al cargar el historial');
    }
    return res.json();
};

// --- 3. CANCELAR UNA RESERVA ---
export const cancelBooking = async (bookingId: number) => {
    if (!getToken()) throw new Error("Debes iniciar sesión.");

  // Si es un admin vinculado a un club, usar la ruta /clubs/:slug/admin/... para que
  // el backend reciba el clubId vía middleware y valide correctamente la pertenencia.
  try {
    const rawUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
    if (rawUser) {
      const parsed = normalizeSessionUser(JSON.parse(rawUser || '{}'));
      const adminClubId = Number(parsed?.activeClubId || parsed?.clubId || parsed?.club?.id);
      if (hasAdminAccess(parsed) && Number.isFinite(adminClubId) && adminClubId > 0) {
        // Obtener slug y llamar al servicio admin
        const club = await ClubService.getClubById(adminClubId);
        return await ClubAdminService.cancelBooking(club.slug, bookingId);
      }
    }
  } catch (e) {
    // si falla obtener el slug, caemos al endpoint genérico
  }

  const res = await fetchWithAuth(`${apiBase()}/bookings/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId })
  });

    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'No se pudo cancelar el turno');
    }
    return res.json();
};

export const confirmBooking = async (
  bookingId: number,
  paymentMethod?: 'CASH' | 'TRANSFER'
) => {
    if (!getToken()) throw new Error("Debes iniciar sesión como administrador.");

    const account = await getOrCreateBookingAccount(bookingId);
    const summary = await getAccountSummary(account.id);
    const remaining = Number(summary?.remaining || 0);

    if (remaining <= 0.009) {
      return { success: true, message: 'La cuenta ya está saldada' };
    }

    return registerPayment({
      accountId: account.id,
      amount: remaining,
      method: (paymentMethod ?? 'CASH') as 'CASH' | 'TRANSFER'
    });
};

export const splitBookingPayment = async (
  bookingId: number,
  payments: Array<{ method: 'CASH' | 'TRANSFER'; amount: number }>
) => {
  if (!getToken()) throw new Error('Debes iniciar sesión como administrador.');

  const account = await getOrCreateBookingAccount(bookingId);
  const summary = await getAccountSummary(account.id);
  const remaining = Number(summary?.remaining || 0);
  const totalRequested = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  if (Math.abs(totalRequested - remaining) > 0.009) {
    throw new Error('La suma de pagos debe coincidir con el saldo pendiente');
  }

  const results = [];
  for (const payment of payments) {
    results.push(await registerPayment({
      accountId: account.id,
      amount: Number(payment.amount),
      method: payment.method
    }));
  }

  return results;
};

export const registerBookingPartialPayment = async (
  bookingId: number,
  amount: number,
  method: 'CASH' | 'TRANSFER'
) => {
  if (!getToken()) throw new Error('Debes iniciar sesión como administrador.');
  const account = await getOrCreateBookingAccount(bookingId);
  return registerPayment({
    accountId: account.id,
    amount,
    method
  });
};

export const getBookingFinancialSummary = async (bookingId: number) => {
  if (!getToken()) throw new Error('Debes iniciar sesión como administrador.');
  const account = await getOrCreateBookingAccount(bookingId);
  const summary = await getAccountSummary(account.id);
  const accountDetail = await getAccountById(account.id);

  const accountItems = Array.isArray(accountDetail?.items) ? accountDetail.items : [];

  const courtTotal = accountItems
    .filter((item: any) => item?.type === 'BOOKING')
    .reduce((sum: number, item: any) => sum + Number(item?.total || 0), 0);

  const itemsTotal = accountItems
    .filter((item: any) => item?.type !== 'BOOKING')
    .reduce((sum: number, item: any) => sum + Number(item?.total || 0), 0);

  const totalPaid = Number(summary.paymentsTotal || 0);
  const itemsPaid = Math.min(itemsTotal, totalPaid);
  const paidAvailableForCourt = Math.max(0, totalPaid - itemsPaid);
  const courtPaid = Math.min(courtTotal, paidAvailableForCourt);
  const itemsDebt = Math.max(0, itemsTotal - itemsPaid);
  const courtDebt = Math.max(0, courtTotal - courtPaid);

  const accountPayments = Array.isArray(accountDetail?.payments) ? accountDetail.payments : [];

  return {
    bookingId,
    accountId: account.id,
    courtTotal,
    courtPaid,
    courtDebt,
    itemsTotal,
    itemsPaid,
    itemsDebt,
    total: Number(summary.itemsTotal || 0),
    totalPaid,
    remaining: Number(summary.remaining || 0),
    paymentStatus: Number(summary.remaining || 0) <= 0.009 ? 'PAID' : (totalPaid > 0 ? 'PARTIAL' : 'PENDING'),
    courtPayments: accountPayments.map((payment: any) => ({
      id: Number(payment?.id || 0),
      amount: Number(payment?.amount || 0),
      method: String(payment?.method || 'OTHER'),
      description: payment?.description ? String(payment.description) : undefined,
      date: payment?.createdAt ? new Date(payment.createdAt).toISOString() : new Date().toISOString()
    }))
  };
};

// --- 4. OBTENER SCHEDULE COMPLETO DEL DÍA (ADMIN) ---
export const getAdminSchedule = async (date: string) => {
    if (!getToken()) throw new Error("Debes iniciar sesión como administrador.");

    const res = await fetchWithAuth(`${apiBase()}/bookings/admin/schedule?date=${date}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    });

    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Error al cargar el schedule');
    }
    return res.json();
};

// --- 5. CREAR TURNO FIJO ---
export const createFixedBooking = async (
  userId: number | undefined,
  courtId: number,
  activityId: number,
  startDateTime: Date,
  guestName?: string,
  guestPhone?: string,
  guestDni?: string, // <--- Recibimos el dato (Argumento #7)
  isProfessor?: boolean
) => {
  const token = getToken();
  // Validamos token si es necesario, o dejamos que el backend decida
  if (!token) throw new Error("Debes iniciar sesión como administrador.");

  const res = await fetchWithAuth(`${apiBase()}/bookings/fixed`, {
    method: 'POST',
    headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
        courtId,
        activityId,
        startDateTime: startDateTime.toISOString(),
        
        // Si hay ID de usuario (cliente registrado)
        ...(userId ? { userId } : {}),
        
        // Si es invitado (cliente manual)
        ...(guestName ? { guestName } : {}),
        ...(guestPhone ? { guestPhone } : {}),
        
        // 👇👇👇 AQUÍ ESTABA EL PROBLEMA 👇👇👇
        // Ahora lo enviamos con ambos nombres por seguridad
        ...(guestDni ? { guestDni } : {}),
        ...(isProfessor ? { isProfessor: true } : {})
    })
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || error.message || 'Error al crear turno fijo');
  }
  return res.json();
};

// --- 6. CANCELAR TURNO FIJO (NUEVO - Corregido para usar fetch) ---
export const cancelFixedBooking = async (fixedBookingId: number) => {
  if (!getToken()) throw new Error("Debes iniciar sesión como administrador.");

  const res = await fetchWithAuth(`${apiBase()}/bookings/fixed/${fixedBookingId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Error al cancelar turno fijo');
  }
  return res.json();
};

export const searchClients = async (slug: string, query: string) => {
    if (!getToken()) throw new Error("Debes iniciar sesión.");

    const res = await fetchWithAuth(`${apiBase()}/clubs/${slug}/admin/clients-list?q=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    });

    if (!res.ok) {
        return [];
    }

    return res.json();
};


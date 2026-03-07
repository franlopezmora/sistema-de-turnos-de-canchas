import { fetchWithAuth } from '../utils/apiClient';
import { getApiUrl } from '../utils/apiUrl';
import { getPaymentIdempotencyKey } from '../utils/paymentIdempotency';

const apiBase = () => `${getApiUrl()}/api`;

export type PaymentStatus = 'PENDING' | 'PAID' | 'PARTIAL';

export class PaymentService {
  static async list(params?: {
    accountId?: string;
    method?: string;
    from?: string;
    to?: string;
    take?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.accountId) query.set('accountId', params.accountId);
    if (params?.method) query.set('method', params.method);
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    if (params?.take) query.set('take', String(params.take));

    const res = await fetchWithAuth(`${apiBase()}/payments?${query.toString()}`, { method: 'GET' });
    if (!res.ok) throw new Error('Error al cargar pagos');
    return res.json();
  }

  static async create(payload: {
    accountId: string;
    amount: number;
    method: 'CASH' | 'TRANSFER' | 'CARD' | 'MERCADO_PAGO' | 'OTHER';
  }) {
    const idempotencyKey = getPaymentIdempotencyKey(payload);
    const res = await fetchWithAuth(`${apiBase()}/accounts/${payload.accountId}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify({ amount: payload.amount, method: payload.method })
    });
    if (!res.ok) throw new Error('Error al crear pago');
    return res.json();
  }
}

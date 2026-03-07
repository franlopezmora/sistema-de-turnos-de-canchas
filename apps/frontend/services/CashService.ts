import { fetchWithAuth } from '../utils/apiClient';
import { getApiUrl } from '../utils/apiUrl';

const apiBase = () => `${getApiUrl()}/api`;

export class CashService {
  static async getSummary() {
    const res = await fetchWithAuth(`${apiBase()}/cash`, { method: 'GET' });
    if (!res.ok) throw new Error('Error al cargar caja');
    return res.json();
  }

  static async createMovement(data: {
    amount: number | string;
    description: string;
    type: 'INCOME' | 'EXPENSE';
    method: 'CASH' | 'TRANSFER';
  }) {
    const res = await fetchWithAuth(`${apiBase()}/cash`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: data.amount,
        concept: data.description,
        type: data.type === 'INCOME' ? 'PAYMENT_IN' : 'WITHDRAW',
        method: data.method
      })
    });
    if (!res.ok) throw new Error('Error al crear movimiento');
    return res.json();
  }

  static async getProducts() {
    const res = await fetchWithAuth(`${apiBase()}/cash/products`, { method: 'GET' });
    if (!res.ok) throw new Error('Error al cargar productos');
    return res.json();
  }

  static async createProductSale(payload: {
    productId: number;
    quantity: number;
    method: 'CASH' | 'TRANSFER';
    payments?: Array<{ method: 'CASH' | 'TRANSFER'; amount: number }>;
    userId?: number;
    guestName?: string;
    guestPhone?: string;
    guestDni?: string;
  }) {
    const res = await fetchWithAuth(`${apiBase()}/cash/product-sale`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Error al registrar venta');
    }
    return res.json();
  }
}

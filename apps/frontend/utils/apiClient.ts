/**
 * Cliente HTTP que añade el token de auth y, si el servidor responde 401 o 403
 * (token expirado o inválido), limpia la sesión (logout). `logout()` redirige
 * automáticamente a `/`.
 */
import { getToken, logout } from '../services/AuthService';

export async function fetchWithAuth(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(input, { ...init, headers });

  if (res.status === 401) {
    // 401: token inválido/expirado -> cerrar sesión
    logout();
    throw new Error('Sesión expirada. Volvé a iniciar sesión.');
  }

  if (res.status === 403) {
    // 403: usuario autenticado pero sin permisos -> no cerrar sesión
    throw new Error('No autorizado');
  }

  return res;
}

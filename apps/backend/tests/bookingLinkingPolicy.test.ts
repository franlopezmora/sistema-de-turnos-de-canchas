import test from 'node:test';
import assert from 'node:assert/strict';
import { BookingService } from '../src/services/BookingService';

type MemoryClient = {
  id: string;
  clubId: number;
  userId: number | null;
  name: string;
  phone: string | null;
  email: string | null;
  dni: string | null;
};

function buildTx(clients: MemoryClient[]) {
  const auditLogs: any[] = [];
  const tx: any = {
    client: {
      findFirst: async ({ where }: any) => {
        const clubId = Number(where?.clubId);
        const matchesUserId = (row: MemoryClient) => {
          if (!Object.prototype.hasOwnProperty.call(where || {}, 'userId')) return true;
          if (where.userId === null) return row.userId === null;
          return Number(row.userId) === Number(where.userId);
        };
        if (where?.userId != null && !where?.dni && !where?.phone && !where?.email) {
          return clients.find((row) => row.clubId === clubId && matchesUserId(row)) || null;
        }
        if (where?.dni != null) {
          return clients.find((row) => row.clubId === clubId && matchesUserId(row) && row.dni === String(where.dni)) || null;
        }
        if (where?.phone?.in) {
          const accepted = new Set((where.phone.in || []).map((value: any) => String(value)));
          return clients.find((row) => row.clubId === clubId && matchesUserId(row) && accepted.has(String(row.phone || ''))) || null;
        }
        if (where?.email != null) {
          return clients.find((row) => row.clubId === clubId && matchesUserId(row) && row.email === String(where.email)) || null;
        }
        return null;
      },
      findUnique: async ({ where }: any) => {
        return clients.find((row) => String(row.id) === String(where?.id)) || null;
      },
      update: async ({ where, data }: any) => {
        const idx = clients.findIndex((row) => String(row.id) === String(where?.id));
        if (idx < 0) throw new Error('Client not found');
        clients[idx] = { ...clients[idx], ...data };
        return clients[idx];
      },
      create: async ({ data }: any) => {
        const created: MemoryClient = {
          id: `c-${clients.length + 1}`,
          clubId: Number(data.clubId),
          userId: data.userId == null ? null : Number(data.userId),
          name: String(data.name || ''),
          phone: data.phone ?? null,
          email: data.email ?? null,
          dni: data.dni ?? null
        };
        clients.push(created);
        return created;
      }
    },
    auditLog: {
      create: async ({ data }: any) => {
        const created = { id: `audit-${auditLogs.length + 1}`, ...data, createdAt: new Date() };
        auditLogs.push(created);
        return created;
      }
    }
  };
  return { tx, clients, auditLogs };
}

function createService() {
  return new BookingService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
}

test('usuario logueado no auto-linkea por DNI y no bloquea la reserva', async () => {
  const { tx, clients, auditLogs } = buildTx([
    {
      id: 'c-dni',
      clubId: 10,
      userId: null,
      name: 'Nombre Cliente',
      phone: '+5493511234567',
      email: 'cliente@example.com',
      dni: '30111222'
    }
  ]);
  const service = createService();

  const resolved = await (service as any).resolveOrCreateClient(tx, {
    clubId: 10,
    userId: 7,
    name: 'Nombre Usuario',
    phone: '',
    email: '',
    dni: '30111222'
  });

  assert.notEqual(resolved.id, 'c-dni');
  assert.equal(resolved.userId, 7);
  assert.equal(resolved.dni, null);
  assert.equal(clients[0].userId, null);
  assert.equal(clients[0].name, 'Nombre Cliente');
  assert.equal(clients[0].email, 'cliente@example.com');
  assert.equal(auditLogs.some((row) => row.payload?.reason === 'CREATED_CLIENT'), true);
});

test('usuario logueado no auto-linkea por teléfono y no bloquea la reserva', async () => {
  const { tx, clients, auditLogs } = buildTx([
    {
      id: 'c-phone',
      clubId: 10,
      userId: null,
      name: 'Cliente Original',
      phone: '+5493511234567',
      email: 'old@example.com',
      dni: null
    }
  ]);
  const service = createService();

  const resolved = await (service as any).resolveOrCreateClient(tx, {
    clubId: 10,
    userId: 8,
    name: 'Nombre Nuevo',
    phone: '+54 9 351 123 4567',
    email: '',
    dni: ''
  });

  assert.notEqual(resolved.id, 'c-phone');
  assert.equal(resolved.userId, 8);
  assert.equal(resolved.phone, null);
  assert.equal(clients[0].userId, null);
  assert.equal(clients[0].name, 'Cliente Original');
  assert.equal(auditLogs.some((row) => row.payload?.reason === 'CREATED_CLIENT'), true);
});

test('usuario logueado auto-linkea por email único sin pisar datos del club', async () => {
  const { tx, clients, auditLogs } = buildTx([
    {
      id: 'c-email',
      clubId: 10,
      userId: null,
      name: 'Cliente Email',
      phone: '+5493510000000',
      email: 'ada@example.com',
      dni: null
    }
  ]);
  const service = createService();

  const resolved = await (service as any).resolveOrCreateClient(tx, {
    clubId: 10,
    userId: 9,
    name: 'Ada',
    phone: '',
    email: 'ada@example.com',
    dni: ''
  });

  assert.equal(resolved.id, 'c-email');
  assert.equal(clients[0].userId, 9);
  assert.equal(clients[0].phone, '+5493510000000');
  assert.equal(auditLogs.some((row) => row.payload?.reason === 'EXACT_EMAIL_MATCH'), true);
});

test('usuario logueado prioriza email aunque teléfono apunte a otro cliente', async () => {
  const { tx, clients } = buildTx([
    {
      id: 'c-phone',
      clubId: 10,
      userId: null,
      name: 'Cliente A',
      phone: '+5493511234567',
      email: null,
      dni: null
    },
    {
      id: 'c-email',
      clubId: 10,
      userId: null,
      name: 'Cliente B',
      phone: '+5493519999999',
      email: 'ada@example.com',
      dni: null
    }
  ]);
  const service = createService();

  const resolved = await (service as any).resolveOrCreateClient(tx, {
    clubId: 10,
    userId: 7,
    name: 'Ada',
    phone: '+5493511234567',
    email: 'ada@example.com',
    dni: ''
  });

  assert.equal(resolved.id, 'c-email');
  assert.equal(clients.find((client) => client.id === 'c-email')?.userId, 7);
  assert.equal(clients.find((client) => client.id === 'c-phone')?.userId, null);
});

test('usuario logueado nunca auto-linkea por nombre solo', async () => {
  const { tx, clients } = buildTx([
    {
      id: 'c-name',
      clubId: 10,
      userId: null,
      name: 'Ada Lovelace',
      phone: null,
      email: null,
      dni: null
    }
  ]);
  const service = createService();

  const resolved = await (service as any).resolveOrCreateClient(tx, {
    clubId: 10,
    userId: 7,
    name: 'Ada Lovelace',
    phone: '',
    email: '',
    dni: ''
  });

  assert.notEqual(resolved.id, 'c-name');
  assert.equal(resolved.userId, 7);
  assert.equal(clients.find((client) => client.id === 'c-name')?.userId, null);
});

test('alta rápida admin recomienda seleccionar si hay un match fuerte', async () => {
  const { tx } = buildTx([
    {
      id: 'c-phone',
      clubId: 10,
      userId: null,
      name: 'Cliente Original',
      phone: '+5493511234567',
      email: 'old@example.com',
      dni: '30111222'
    }
  ]);
  const service = createService();

  await assert.rejects(
    () =>
      (service as any).resolveOrCreateClient(tx, {
        clubId: 10,
        userId: null,
        name: 'Cliente con otro mail',
        phone: '+54 9 351 123 4567',
        email: 'nuevo@example.com',
        dni: ''
      }),
    /CLIENT_POSSIBLE_DUPLICATE/
  );
});

test('alta rápida admin crea cliente nuevo con nombre teléfono y email', async () => {
  const { tx, clients } = buildTx([]);
  const service = createService();

  const resolved = await (service as any).resolveOrCreateClient(tx, {
    clubId: 10,
    userId: null,
    name: 'Cliente Nuevo',
    phone: '+54 9 351 123 4567',
    email: 'nuevo@example.com',
    dni: ''
  });

  assert.equal(resolved.userId, null);
  assert.equal(resolved.name, 'Cliente Nuevo');
  assert.equal(resolved.email, 'nuevo@example.com');
  assert.equal(clients.length, 1);
});

test('alta rápida admin exige teléfono y email', async () => {
  const { tx } = buildTx([]);
  const service = createService();

  await assert.rejects(
    () =>
      (service as any).resolveOrCreateClient(tx, {
        clubId: 10,
        userId: null,
        name: 'Cliente Nuevo',
        phone: '',
        email: 'nuevo@example.com',
        dni: ''
      }),
    /teléfono es obligatorio/i
  );

  await assert.rejects(
    () =>
      (service as any).resolveOrCreateClient(tx, {
        clubId: 10,
        userId: null,
        name: 'Cliente Nuevo',
        phone: '+54 9 351 123 4567',
        email: '',
        dni: ''
      }),
    /email es obligatorio/i
  );
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { ClubService } from '../src/services/ClubService';
import { prisma } from '../src/prisma';

function createService() {
  return new ClubService({} as any, {} as any);
}

test('getClients devuelve solo clients deduplicados aunque exista un user equivalente', async () => {
  const service = createService();
  const originalClientFindMany = (prisma as any).client.findMany;

  (prisma as any).client.findMany = async () => ([
    {
      id: 'client-new',
      name: 'Admin Las Tejas',
      phone: '+5493571359791',
      email: 'admin@lastejas.com',
      dni: '',
      isProfessor: false,
      userId: null,
      createdAt: new Date('2026-05-19T21:02:15.856Z')
    },
    {
      id: 'client-old',
      name: 'Admin Las Tejas',
      phone: '+5493571359791',
      email: 'admin@lastejas.com',
      dni: '',
      isProfessor: false,
      userId: null,
      createdAt: new Date('2026-05-19T20:02:15.856Z')
    }
  ]);

  try {
    const results = await service.getClients(5, 'admin las tejas');
    assert.equal(results.length, 1);
    assert.equal(results[0]?.name, 'Admin Las Tejas');
  } finally {
    (prisma as any).client.findMany = originalClientFindMany;
  }
});

test('searchParticipants deduplica 2 clients iguales + 1 user igual y prefiere mostrar client', async () => {
  const service = createService();
  const originalClientFindMany = (prisma as any).client.findMany;
  const originalUserFindMany = (prisma as any).user.findMany;

  (prisma as any).client.findMany = async () => ([
    {
      id: 'client-new',
      name: 'Admin Las Tejas',
      phone: '+5493571359791',
      email: 'admin@lastejas.com',
      dni: '',
      isProfessor: false,
      userId: null,
      createdAt: new Date('2026-05-19T21:02:15.856Z')
    },
    {
      id: 'client-old',
      name: 'Admin Las Tejas',
      phone: '+5493571359791',
      email: 'admin@lastejas.com',
      dni: '',
      isProfessor: false,
      userId: null,
      createdAt: new Date('2026-05-19T20:02:15.856Z')
    }
  ]);
  (prisma as any).user.findMany = async () => ([
    {
      id: 1,
      firstName: 'Admin',
      lastName: 'Las Tejas',
      email: 'admin@lastejas.com',
      phoneNumber: '+54 9 357 135 9791'
    }
  ]);

  try {
    const results = await service.searchParticipants(5, 'admin las tejas');
    assert.equal(results.length, 1);
    assert.equal(results[0]?.sourceType, 'clubClient');
    assert.equal(results[0]?.name, 'Admin Las Tejas');
  } finally {
    (prisma as any).client.findMany = originalClientFindMany;
    (prisma as any).user.findMany = originalUserFindMany;
  }
});

test('searchParticipants puede mostrar systemUser cuando no existe client del club', async () => {
  const service = createService();
  const originalClientFindMany = (prisma as any).client.findMany;
  const originalUserFindMany = (prisma as any).user.findMany;

  (prisma as any).client.findMany = async () => [];
  (prisma as any).user.findMany = async () => ([
    {
      id: 7,
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@example.com',
      phoneNumber: '+54 9 351 222 3333'
    }
  ]);

  try {
    const results = await service.searchParticipants(5, 'ana');
    assert.equal(results.length, 1);
    assert.equal(results[0]?.sourceType, 'systemUser');
    assert.equal(results[0]?.userId, 7);
  } finally {
    (prisma as any).client.findMany = originalClientFindMany;
    (prisma as any).user.findMany = originalUserFindMany;
  }
});

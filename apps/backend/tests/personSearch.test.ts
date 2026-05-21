import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/prisma';
import { PersonService } from '../src/services/PersonService';

const createService = () => new PersonService();

test('PersonSearch devuelve una sola opción para un client del club aunque existan duplicados', async () => {
  const service = createService();
  const originalClientFindMany = (prisma as any).client.findMany;
  const originalUserFindMany = (prisma as any).user.findMany;

  (prisma as any).client.findMany = async () => ([
    {
      id: 'client-2',
      clubId: 5,
      userId: null,
      name: 'Admin Las Tejas',
      phone: '+5493571359791',
      email: 'admin@lastejas.com',
      dni: null,
      createdAt: new Date('2026-05-20T20:00:00.000Z')
    },
    {
      id: 'client-1',
      clubId: 5,
      userId: null,
      name: 'Admin Las Tejas',
      phone: '+5493571359791',
      email: 'admin@lastejas.com',
      dni: null,
      createdAt: new Date('2026-05-20T19:00:00.000Z')
    }
  ]);
  (prisma as any).user.findMany = async () => [];

  try {
    const results = await service.searchPeople(5, 'admin las tejas');
    assert.equal(results.length, 1);
    assert.equal(results[0]?.kind, 'clubClient');
    assert.equal(results[0]?.clientId, 'client-2');
  } finally {
    (prisma as any).client.findMany = originalClientFindMany;
    (prisma as any).user.findMany = originalUserFindMany;
  }
});

test('PersonSearch devuelve systemUser por email exacto aunque no esté relacionado al club', async () => {
  const service = createService();
  const originalClientFindMany = (prisma as any).client.findMany;
  const originalUserFindMany = (prisma as any).user.findMany;

  let userCall = 0;
  (prisma as any).client.findMany = async () => [];
  (prisma as any).user.findMany = async () => {
    userCall += 1;
    if (userCall === 1) return [];
    return [
      {
        id: 77,
        firstName: 'Ana',
        lastName: 'Pérez',
        email: 'ana@pique.test',
        phoneNumber: '+5493511231234',
        dni: null
      }
    ];
  };

  try {
    const results = await service.searchPeople(5, 'ana@pique.test');
    assert.equal(results.length, 1);
    assert.equal(results[0]?.kind, 'systemUser');
    assert.equal(results[0]?.userId, 77);
    assert.deepEqual(results[0]?.badges, ['Usuario Pique']);
  } finally {
    (prisma as any).client.findMany = originalClientFindMany;
    (prisma as any).user.findMany = originalUserFindMany;
  }
});

test('PersonSearch no muestra users globales por nombre ambiguo si no están relacionados con el club', async () => {
  const service = createService();
  const originalClientFindMany = (prisma as any).client.findMany;
  const originalUserFindMany = (prisma as any).user.findMany;

  let userCall = 0;
  (prisma as any).client.findMany = async () => [];
  (prisma as any).user.findMany = async () => {
    userCall += 1;
    if (userCall === 1) return [];
    return [];
  };

  try {
    const results = await service.searchPeople(5, 'juan');
    assert.equal(results.length, 1);
    assert.equal(results[0]?.kind, 'newClientSuggestion');
    assert.equal(results[0]?.displayName, 'juan');
  } finally {
    (prisma as any).client.findMany = originalClientFindMany;
    (prisma as any).user.findMany = originalUserFindMany;
  }
});

test('PersonSearch devuelve una sola fila linked cuando client y user están relacionados', async () => {
  const service = createService();
  const originalClientFindMany = (prisma as any).client.findMany;
  const originalUserFindMany = (prisma as any).user.findMany;

  let userCall = 0;
  (prisma as any).client.findMany = async () => ([
    {
      id: 'client-linked',
      clubId: 5,
      userId: 9,
      name: 'Lucía Díaz',
      phone: '+5493515554444',
      email: 'lucia@pique.test',
      dni: null,
      createdAt: new Date('2026-05-20T19:00:00.000Z')
    }
  ]);
  (prisma as any).user.findMany = async () => {
    userCall += 1;
    if (userCall === 1) {
      return [
        {
          id: 9,
          firstName: 'Lucía',
          lastName: 'Díaz',
          email: 'lucia@pique.test',
          phoneNumber: '+5493515554444',
          dni: null
        }
      ];
    }
    return [];
  };

  try {
    const results = await service.searchPeople(5, 'lucía');
    assert.equal(results.length, 1);
    assert.equal(results[0]?.kind, 'linked');
    assert.equal(results[0]?.clientId, 'client-linked');
    assert.equal(results[0]?.userId, 9);
    assert.ok(results[0]?.badges.includes('Cliente del club'));
    assert.ok(results[0]?.badges.includes('Usuario Pique'));
  } finally {
    (prisma as any).client.findMany = originalClientFindMany;
    (prisma as any).user.findMany = originalUserFindMany;
  }
});

test('PersonSearch ofrece crear nuevo cliente cuando no hay coincidencias', async () => {
  const service = createService();
  const originalClientFindMany = (prisma as any).client.findMany;
  const originalUserFindMany = (prisma as any).user.findMany;

  (prisma as any).client.findMany = async () => [];
  (prisma as any).user.findMany = async () => [];

  try {
    const results = await service.searchPeople(5, 'Persona Nueva');
    assert.equal(results.length, 1);
    assert.equal(results[0]?.kind, 'newClientSuggestion');
    assert.equal(results[0]?.displayName, 'Persona Nueva');
  } finally {
    (prisma as any).client.findMany = originalClientFindMany;
    (prisma as any).user.findMany = originalUserFindMany;
  }
});

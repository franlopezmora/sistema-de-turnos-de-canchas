import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { ErrorCodes, conflict, forbidden, notFound, sendAppError } from '../src/errors';

class MockResponse {
  statusCode = 200;
  body: unknown = null;

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  json(body: unknown) {
    this.body = body;
    return this;
  }
}

const response = () => new MockResponse();

describe('Booking AppError — contratos críticos', () => {
  test('CLIENT_POSSIBLE_DUPLICATE → 409 con meta.candidates', () => {
    const res = response();
    const candidates = [{ id: 'c_1', name: 'Ana' }];

    sendAppError(
      res,
      conflict('Ya existe un cliente parecido.', ErrorCodes.CLIENT_POSSIBLE_DUPLICATE, {
        candidateClientIds: ['c_1'],
        candidates,
      })
    );

    assert.equal(res.statusCode, 409);
    assert.deepEqual(res.body, {
      error: 'Ya existe un cliente parecido.',
      code: ErrorCodes.CLIENT_POSSIBLE_DUPLICATE,
      meta: {
        candidateClientIds: ['c_1'],
        candidates,
      },
    });
  });

  test('BOOKING_OVERLAP → 409 con meta.overlaps', () => {
    const res = response();
    const overlaps = [{ bookingId: 12, courtName: 'Cancha 1' }];

    sendAppError(
      res,
      conflict('El horario se superpone con reservas existentes.', ErrorCodes.BOOKING_OVERLAP, { overlaps })
    );

    assert.equal(res.statusCode, 409);
    assert.equal((res.body as any).code, ErrorCodes.BOOKING_OVERLAP);
    assert.deepEqual((res.body as any).meta.overlaps, overlaps);
  });

  test('COURT_NOT_FOUND → 404', () => {
    const res = response();
    sendAppError(res, notFound('Cancha no encontrada', ErrorCodes.COURT_NOT_FOUND));
    assert.equal(res.statusCode, 404);
    assert.equal((res.body as any).code, ErrorCodes.COURT_NOT_FOUND);
  });

  test('CLIENT_OUT_OF_CLUB → 403', () => {
    const res = response();
    sendAppError(res, forbidden('El cliente no pertenece a este club.', ErrorCodes.CLIENT_OUT_OF_CLUB));
    assert.equal(res.statusCode, 403);
    assert.equal((res.body as any).code, ErrorCodes.CLIENT_OUT_OF_CLUB);
  });

  test('BOOKING_TITULAR_CHANGE_BLOCKED → 409', () => {
    const res = response();
    sendAppError(
      res,
      conflict(
        'No se puede cambiar el titular porque la reserva ya tiene pagos o movimientos registrados.',
        ErrorCodes.BOOKING_TITULAR_CHANGE_BLOCKED
      )
    );
    assert.equal(res.statusCode, 409);
    assert.equal((res.body as any).code, ErrorCodes.BOOKING_TITULAR_CHANGE_BLOCKED);
  });

  test('BOOKING_NOT_FOUND → 404', () => {
    const res = response();
    sendAppError(res, notFound('Reserva no encontrada', ErrorCodes.BOOKING_NOT_FOUND));
    assert.equal(res.statusCode, 404);
    assert.equal((res.body as any).code, ErrorCodes.BOOKING_NOT_FOUND);
  });

  test('BOOKING_INVALID_STATUS → 409', () => {
    const res = response();
    sendAppError(res, conflict('Solo se puede confirmar una reserva pendiente', ErrorCodes.BOOKING_INVALID_STATUS));
    assert.equal(res.statusCode, 409);
    assert.equal((res.body as any).code, ErrorCodes.BOOKING_INVALID_STATUS);
  });
});

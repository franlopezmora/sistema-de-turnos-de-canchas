import { prisma } from '../prisma';
import { DOMAIN_EVENTS } from './EventService';
import { NotificationService } from './NotificationService';

export class EventProcessor {
  private readonly notificationService = new NotificationService();

  async processPending(batchSize = 50) {
    const events = await prisma.event.findMany({
      where: { processed: false },
      orderBy: { createdAt: 'asc' },
      take: batchSize
    });

    for (const event of events) {
      try {
        await this.processEvent(event);
        await prisma.event.update({
          where: { id: event.id },
          data: { processed: true }
        });
      } catch (error) {
        console.error('[EventProcessor] Error procesando evento', {
          id: event.id,
          type: event.type,
          error
        });
      }
    }

    return { processed: events.length };
  }

  private async processEvent(event: { id: string; clubId: number; type: string; payload: any }) {
    const payload = (event.payload || {}) as Record<string, any>;

    if (event.type === DOMAIN_EVENTS.BOOKING_CREATED) {
      if (payload.userId) {
        await this.notificationService.createNotification(
          Number(payload.userId),
          event.clubId,
          'Reserva creada',
          `Tu reserva #${payload.bookingId ?? ''} fue registrada.`
        );
      }
      return;
    }

    if (event.type === DOMAIN_EVENTS.BOOKING_CANCELLED) {
      if (payload.userId) {
        await this.notificationService.createNotification(
          Number(payload.userId),
          event.clubId,
          'Reserva cancelada',
          `Tu reserva #${payload.bookingId ?? ''} fue cancelada.`
        );
      }
      return;
    }

    if (event.type === DOMAIN_EVENTS.PAYMENT_RECEIVED) {
      if (payload.userId) {
        await this.notificationService.createNotification(
          Number(payload.userId),
          event.clubId,
          'Pago registrado',
          `Se registró un pago por $${payload.amount ?? 0}.`
        );
      }
      return;
    }

    if (event.type === DOMAIN_EVENTS.PRODUCT_SOLD) {
      if (payload.userId) {
        await this.notificationService.createNotification(
          Number(payload.userId),
          event.clubId,
          'Compra registrada',
          `Se registró la venta de ${payload.quantity ?? 0} unidad(es).`
        );
      }
      return;
    }
  }
}

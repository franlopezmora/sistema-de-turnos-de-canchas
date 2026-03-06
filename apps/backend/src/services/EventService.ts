import { prisma } from '../prisma';

export const DOMAIN_EVENTS = {
  BOOKING_CREATED: 'BOOKING_CREATED',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  PRODUCT_SOLD: 'PRODUCT_SOLD'
} as const;

export type DomainEventType = (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];

export class EventService {
  async createEvent(clubId: number, type: DomainEventType | string, payload: Record<string, any>) {
    return prisma.event.create({
      data: {
        clubId,
        type,
        payload,
        processed: false
      }
    });
  }

  async bookingCreated(clubId: number, payload: Record<string, any>) {
    return this.createEvent(clubId, DOMAIN_EVENTS.BOOKING_CREATED, payload);
  }

  async bookingCancelled(clubId: number, payload: Record<string, any>) {
    return this.createEvent(clubId, DOMAIN_EVENTS.BOOKING_CANCELLED, payload);
  }

  async paymentReceived(clubId: number, payload: Record<string, any>) {
    return this.createEvent(clubId, DOMAIN_EVENTS.PAYMENT_RECEIVED, payload);
  }

  async productSold(clubId: number, payload: Record<string, any>) {
    return this.createEvent(clubId, DOMAIN_EVENTS.PRODUCT_SOLD, payload);
  }
}

import { Request, Response } from 'express';
import { z } from 'zod';
import { CashService } from '../services/CashService';
import { CashShiftService } from '../services/CashShiftService';
import { sanitizeString } from '../utils/sanitize';

export class CashController {
  constructor(private readonly cashService: CashService) {}

  getSummary = async (req: Request, res: Response) => {
    try {
      const clubId = Number((req as any).clubId);
      const rawDate = typeof req.query.date === 'string' ? req.query.date : undefined;
      const summary = rawDate
        ? await this.cashService.getSummaryByDate(clubId, rawDate)
        : await this.cashService.getDailySummary(clubId);
      return res.json(summary);
    } catch (error) {
      return res.status(500).json({ error: 'Error al obtener caja' });
    }
  };

  createMovement = async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        amount: z.preprocess((v) => Number(v), z.number().positive()),
        concept: z.string().trim().min(1),
        type: z.enum(['PAYMENT_IN', 'REFUND', 'WITHDRAW', 'DEPOSIT']),
        method: z.enum(['CASH', 'TRANSFER', 'CARD', 'MP'])
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });

      const clubId = Number((req as any).clubId);
      const actorUserId = Number((req as any)?.user?.userId || 0) || undefined;

      const shiftService = new CashShiftService();
      const currentShift = await shiftService.current(clubId);
      if (!currentShift) {
        return res.status(400).json({ error: 'No hay turno de caja abierto' });
      }

      const movement = await this.cashService.addMovement({
        ...parsed.data,
        concept: sanitizeString(parsed.data.concept, 500),
        clubId,
        cashShiftId: currentShift.id,
        createdByUserId: actorUserId
      }, actorUserId);

      return res.status(201).json(movement);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'Error al crear movimiento' });
    }
  };

  getProducts = async (req: Request, res: Response) => {
    try {
      const clubId = Number((req as any).clubId);
      const products = await this.cashService.getProducts(clubId);
      return res.json(products);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'No se pudieron obtener los productos' });
    }
  };

  createProductSale = async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        productId: z.preprocess((v) => Number(v), z.number().int().positive()),
        quantity: z.preprocess((v) => Number(v), z.number().int().positive()),
        method: z.enum(['CASH', 'TRANSFER']),
        payments: z.array(z.object({
          method: z.enum(['CASH', 'TRANSFER']),
          amount: z.preprocess((v) => Number(v), z.number().positive())
        })).optional(),
        guestName: z.string().trim().optional(),
        userId: z.preprocess((v) => (v == null || v === '' ? undefined : Number(v)), z.number().int().positive().optional())
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });

      const clubId = Number((req as any).clubId);
      const actorUserId = Number((req as any)?.user?.userId || 0) || undefined;

      const sale = await this.cashService.createProductSale({
        clubId,
        productId: parsed.data.productId,
        quantity: parsed.data.quantity,
        method: parsed.data.method,
        payments: parsed.data.payments,
        guestName: parsed.data.guestName ? sanitizeString(parsed.data.guestName, 200) : undefined
      }, actorUserId);

      return res.status(201).json(sale);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'No se pudo registrar la venta' });
    }
  };
}

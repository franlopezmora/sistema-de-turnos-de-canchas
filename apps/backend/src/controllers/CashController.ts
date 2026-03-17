import { Request, Response } from 'express';
import { z } from 'zod';
import { CashService } from '../services/CashService';
import { CashShiftService } from '../services/CashShiftService';
import { sanitizeString } from '../utils/sanitize';

const optionalPositiveIntSchema = z.preprocess((v) => {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}, z.number().int().positive().optional());

const optionalPositiveNumberSchema = z.preprocess((v) => {
  if (v == null || v === '') return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}, z.number().positive().optional());

const saleItemSchema = z.object({
  itemKey: z.string().trim().min(1).max(120).optional(),
  productId: optionalPositiveIntSchema,
  quantity: z.preprocess((v) => Number(v), z.number().int().positive()),
  customName: z.string().trim().min(2).max(200).optional(),
  unitPrice: optionalPositiveNumberSchema
}).superRefine((value, ctx) => {
  if (value.productId) return;
  if (!value.customName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['customName'],
      message: 'Debe indicar un nombre para el item manual'
    });
  }
  if (value.unitPrice == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['unitPrice'],
      message: 'Debe indicar un precio unitario para el item manual'
    });
  }
});

const salePaymentAllocationSchema = z.object({
  itemKey: z.string().trim().min(1).max(120).optional(),
  productId: optionalPositiveIntSchema,
  amount: z.preprocess((v) => Number(v), z.number().positive())
}).superRefine((value, ctx) => {
  if (value.itemKey || value.productId) return;
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: ['itemKey'],
    message: 'La asignación debe indicar itemKey o productId'
  });
});

const sanitizeSaleItems = (items?: Array<z.infer<typeof saleItemSchema>>) =>
  Array.isArray(items)
    ? items.map((item) => ({
        itemKey: item.itemKey ? sanitizeString(item.itemKey, 120) : undefined,
        productId: item.productId,
        quantity: Number(item.quantity),
        customName: item.customName ? sanitizeString(item.customName, 200) : undefined,
        unitPrice: item.unitPrice == null ? undefined : Number(item.unitPrice)
      }))
    : undefined;

const sanitizeSalePaymentAllocations = (payments?: Array<{
  method: 'CASH' | 'TRANSFER' | 'CARD';
  channel?: 'BANK_ACCOUNT' | 'VIRTUAL_WALLET';
  amount: number;
  allocations?: Array<z.infer<typeof salePaymentAllocationSchema>>;
}>) =>
  Array.isArray(payments)
    ? payments.map((payment) => ({
        method: payment.method,
        channel: payment.channel,
        amount: Number(payment.amount),
        allocations: Array.isArray(payment.allocations)
          ? payment.allocations.map((allocation) => ({
              itemKey: allocation.itemKey ? sanitizeString(allocation.itemKey, 120) : undefined,
              productId: allocation.productId,
              amount: Number(allocation.amount)
            }))
          : undefined
      }))
    : undefined;

export class CashController {
  constructor(private readonly cashService: CashService) {}

  getSummary = async (req: Request, res: Response) => {
    try {
      const clubId = Number((req as any).clubId);
      const rawStartDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
      const rawEndDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;
      const rawDate = typeof req.query.date === 'string' ? req.query.date : undefined;

      let summary;
      if (rawStartDate || rawEndDate) {
        if (!rawStartDate || !rawEndDate) {
          return res.status(400).json({ error: 'Debe enviar startDate y endDate juntos' });
        }
        summary = await this.cashService.getSummaryByDateRange(clubId, rawStartDate, rawEndDate);
      } else if (rawDate) {
        summary = await this.cashService.getSummaryByDate(clubId, rawDate);
      } else {
        summary = await this.cashService.getDailySummary(clubId);
      }

      return res.json(summary);
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Error al obtener caja' });
    }
  };

  createMovement = async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        amount: z.preprocess((v) => Number(v), z.number().positive()),
        concept: z.string().trim().min(1),
        type: z.enum(['PAYMENT_IN', 'REFUND', 'WITHDRAW', 'DEPOSIT']),
        method: z.enum(['CASH', 'TRANSFER', 'CARD'])
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
      const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

      const schema = z.object({
        productId: optionalPositiveIntSchema,
        quantity: z.preprocess((v) => {
          if (v == null || v === '') return undefined;
          return Number(v);
        }, z.number().int().positive().optional()),
        items: z.array(saleItemSchema).optional(),
        method: z.enum(['CASH', 'TRANSFER', 'CARD']),
        channel: z.enum(['BANK_ACCOUNT', 'VIRTUAL_WALLET']).optional(),
        payments: z.array(z.object({
          method: z.enum(['CASH', 'TRANSFER', 'CARD']),
          channel: z.enum(['BANK_ACCOUNT', 'VIRTUAL_WALLET']).optional(),
          amount: z.preprocess((v) => Number(v), z.number().positive()),
          allocations: z.array(salePaymentAllocationSchema).optional()
        })).optional(),
        guestName: z.string().trim().optional(),
        guestPhone: z.string().trim().optional(),
        guestDni: z.string().trim().optional(),
        guestEmail: z.string().trim().email().optional(),
        guestIsProfessor: z.boolean().optional(),
        clientId: z.string().trim().optional(),
        createClientIfMissing: z.boolean().optional(),
        userId: z.preprocess((v) => {
          if (v == null || v === '') return undefined;
          const n = Number(v);
          return Number.isNaN(n) || n < 1 ? undefined : n;
        }, z.number().int().positive().optional())
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });

      const clubId = Number((req as any).clubId);
      const actorUserId = Number((req as any)?.user?.userId || 0) || undefined;

      const sale = await this.cashService.createProductSale({
        clubId,
        productId: parsed.data.productId,
        quantity: parsed.data.quantity,
        items: sanitizeSaleItems(parsed.data.items),
        method: parsed.data.method,
        channel: parsed.data.channel,
        payments: sanitizeSalePaymentAllocations(parsed.data.payments),
        guestName: parsed.data.guestName ? sanitizeString(parsed.data.guestName, 200) : undefined,
        guestPhone: parsed.data.guestPhone ? sanitizeString(parsed.data.guestPhone, 30) : undefined,
        guestDni: parsed.data.guestDni ? sanitizeString(parsed.data.guestDni, 20) : undefined,
        guestEmail: parsed.data.guestEmail ? sanitizeString(parsed.data.guestEmail, 120).toLowerCase() : undefined,
        guestIsProfessor: Boolean(parsed.data.guestIsProfessor),
        clientId: parsed.data.clientId ? sanitizeString(parsed.data.clientId, 64) : undefined,
        createClientIfMissing: Boolean(parsed.data.createClientIfMissing),
        userId: parsed.data.userId,
        idempotencyKey
      } as any, actorUserId);

      return res.status(201).json(sale);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'No se pudo registrar la venta' });
    }
  };

  quoteProductSale = async (req: Request, res: Response) => {
    try {
      const schema = z.object({
        productId: optionalPositiveIntSchema,
        quantity: z.preprocess((v) => {
          if (v == null || v === '') return undefined;
          return Number(v);
        }, z.number().int().positive().optional()),
        items: z.array(saleItemSchema).optional(),
        guestName: z.string().trim().optional(),
        guestPhone: z.string().trim().optional(),
        guestDni: z.string().trim().optional(),
        guestEmail: z.string().trim().email().optional(),
        guestIsProfessor: z.boolean().optional(),
        clientId: z.string().trim().optional(),
        createClientIfMissing: z.boolean().optional(),
        userId: z.preprocess((v) => {
          if (v == null || v === '') return undefined;
          const n = Number(v);
          return Number.isNaN(n) || n < 1 ? undefined : n;
        }, z.number().int().positive().optional())
      });

      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });

      const clubId = Number((req as any).clubId);
      const quote = await this.cashService.quoteProductSale({
        clubId,
        productId: parsed.data.productId,
        quantity: parsed.data.quantity,
        items: sanitizeSaleItems(parsed.data.items),
        guestName: parsed.data.guestName ? sanitizeString(parsed.data.guestName, 200) : undefined,
        guestPhone: parsed.data.guestPhone ? sanitizeString(parsed.data.guestPhone, 30) : undefined,
        guestDni: parsed.data.guestDni ? sanitizeString(parsed.data.guestDni, 20) : undefined,
        guestEmail: parsed.data.guestEmail ? sanitizeString(parsed.data.guestEmail, 120).toLowerCase() : undefined,
        guestIsProfessor: Boolean(parsed.data.guestIsProfessor),
        clientId: parsed.data.clientId ? sanitizeString(parsed.data.clientId, 64) : undefined,
        createClientIfMissing: Boolean(parsed.data.createClientIfMissing),
        userId: parsed.data.userId
      } as any);

      return res.json(quote);
    } catch (error: any) {
      return res.status(400).json({ error: error.message || 'No se pudo cotizar la venta' });
    }
  };
}

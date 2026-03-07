type PaymentFingerprintInput = {
  accountId: string;
  amount: number;
  method: string;
  source?: string;
  cashShiftId?: string;
};

const TTL_MS = 15_000;
const fingerprintCache = new Map<string, { key: string; expiresAt: number }>();

const buildFingerprint = (input: PaymentFingerprintInput) => {
  return JSON.stringify({
    accountId: input.accountId,
    amount: Number(input.amount || 0).toFixed(2),
    method: input.method,
    source: input.source || 'POS',
    cashShiftId: input.cashShiftId || null
  });
};

const generateRandomKey = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `payment_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

export const getPaymentIdempotencyKey = (input: PaymentFingerprintInput) => {
  const now = Date.now();

  fingerprintCache.forEach((entry, fingerprint) => {
    if (entry.expiresAt <= now) {
      fingerprintCache.delete(fingerprint);
    }
  });

  const fingerprint = buildFingerprint(input);
  const cached = fingerprintCache.get(fingerprint);
  if (cached && cached.expiresAt > now) {
    return cached.key;
  }

  const key = generateRandomKey();
  fingerprintCache.set(fingerprint, {
    key,
    expiresAt: now + TTL_MS
  });
  return key;
};

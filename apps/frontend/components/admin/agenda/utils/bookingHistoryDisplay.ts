import type { RecurringCreatedItem, RecurringOverlapItem } from '../types/agendaTypes';

export function formatSeriesDateLabel(value: unknown) {
  const parsed = new Date(String(value || ''));
  if (!Number.isFinite(parsed.getTime())) return '';
  return parsed.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatSeriesTimeLabel(value: unknown) {
  const parsed = new Date(String(value || ''));
  if (!Number.isFinite(parsed.getTime())) return '';
  return parsed.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function mapSeriesImpactItem(item: any, fallbackCourtName: string): RecurringOverlapItem {
  const requestedAt = item?.requestedStartDateTime || item?.startDateTime || item?.requestedAt;
  const conflictingAt = item?.conflictingStartDateTime || item?.conflictStartDateTime || item?.overlapStartDateTime;
  return {
    courtName: String(item?.courtName || item?.requestedCourtName || fallbackCourtName || 'Cancha').trim(),
    requestedDateLabel: formatSeriesDateLabel(requestedAt),
    requestedTimeLabel: formatSeriesTimeLabel(requestedAt),
    conflictingDateLabel: formatSeriesDateLabel(conflictingAt) || undefined,
    conflictingTimeLabel: formatSeriesTimeLabel(conflictingAt) || undefined,
    activityName: String(item?.activityName || '').trim() || undefined,
    clientName: String(item?.clientName || '').trim() || undefined,
  };
}

export function mapSeriesAppliedItem(item: any, fallbackCourtName: string): RecurringCreatedItem {
  const requestedAt = item?.requestedStartDateTime || item?.startDateTime || item?.requestedAt;
  const parsed = new Date(String(requestedAt || ''));
  return {
    bookingId: Number.isFinite(Number(item?.bookingId || item?.id))
      ? Number(item?.bookingId || item?.id)
      : undefined,
    courtName: String(item?.courtName || item?.requestedCourtName || fallbackCourtName || 'Cancha').trim(),
    requestedDateLabel: formatSeriesDateLabel(requestedAt),
    requestedTimeLabel: formatSeriesTimeLabel(requestedAt),
    activityName: String(item?.activityName || '').trim() || undefined,
    sortStartMs: Number.isFinite(parsed.getTime()) ? parsed.getTime() : undefined,
  };
}

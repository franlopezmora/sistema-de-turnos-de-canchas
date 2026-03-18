import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { assertValidScheduleMode, normalizeSchedule } from '../utils/ActivityScheduleHelper';

type UpdateScheduleInput = {
  scheduleMode: 'FIXED' | 'RANGE';
  scheduleOpenTime?: string | null;
  scheduleCloseTime?: string | null;
  scheduleIntervalMinutes?: number | null;
  scheduleWindows?: Array<{ start: string; end: string }> | null;
  scheduleDurations?: Array<number | string>;
  scheduleFixedSlots?: Array<{ start: string; duration: number | string }>;
};

export class ActivityTypeAdminService {
  async listByClub(clubId: number) {
    return prisma.activityType.findMany({
      where: { clubId },
      orderBy: { name: 'asc' }
    });
  }

  async updateSchedule(clubId: number, activityTypeId: number, input: UpdateScheduleInput) {
    const activity = await prisma.activityType.findUnique({ where: { id: activityTypeId } });
    if (!activity) {
      throw new Error('Actividad no encontrada');
    }
    if (Number(activity.clubId) !== clubId) {
      throw new Error('La actividad no pertenece a este club');
    }

    const fallbackDuration = Number(activity.defaultDurationMinutes) > 0 ? Number(activity.defaultDurationMinutes) : 60;

    const normalized = normalizeSchedule(
      {
        scheduleMode: input.scheduleMode,
        scheduleOpenTime: input.scheduleOpenTime ?? null,
        scheduleCloseTime: input.scheduleCloseTime ?? null,
        scheduleIntervalMinutes: input.scheduleIntervalMinutes ?? null,
        scheduleWindows: input.scheduleWindows ?? null,
        scheduleDurations: input.scheduleDurations,
        scheduleFixedSlots: input.scheduleFixedSlots
      },
      fallbackDuration
    );

    assertValidScheduleMode(normalized);

    return prisma.activityType.update({
      where: { id: activity.id },
      data: {
        scheduleMode: normalized.mode,
        scheduleOpenTime: normalized.openTime,
        scheduleCloseTime: normalized.closeTime,
        scheduleIntervalMinutes: normalized.intervalMinutes,
        scheduleWindows: normalized.rangeWindows as unknown as Prisma.InputJsonValue,
        scheduleDurations: normalized.durations as unknown as Prisma.InputJsonValue,
        scheduleFixedSlots: normalized.fixedSlots as unknown as Prisma.InputJsonValue
      }
    });
  }
}

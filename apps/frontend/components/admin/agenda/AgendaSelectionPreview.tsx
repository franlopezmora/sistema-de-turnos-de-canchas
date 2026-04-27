import { Repeat } from 'lucide-react';

type BookingState = 'pending' | 'confirmed' | 'completed' | 'blocked';
type PaymentState = 'paid' | 'unpaid';

type DraftRange = {
  start: number;
  end: number;
};

type BlockContentVisibility = {
  showDurationOnly: boolean;
  showBadge: boolean;
  showTitle: boolean;
  showTimeRange: boolean;
};

type AgendaSelectionPreviewProps = {
  range: DraftRange;
  slotHeight: number;
  slotMinutes: number;
  visibility: BlockContentVisibility;
  slotToTime: (slot: number) => string;
  isEditingMovedBookingPreview: boolean;
  isConflict: boolean;
  title: string;
  state: BookingState;
  paymentState: PaymentState;
  isRecurring?: boolean;
  bookingBadgeColor: (state: BookingState) => string;
  bookingStatusLabel: (state: BookingState) => string;
  bookingPaymentBadgeColor: (state: PaymentState) => string;
  bookingPaymentLabel: (state: PaymentState) => string;
};

export default function AgendaSelectionPreview({
  range,
  slotHeight,
  slotMinutes,
  visibility,
  slotToTime,
  isEditingMovedBookingPreview,
  isConflict,
  title,
  state,
  paymentState,
  isRecurring = false,
  bookingBadgeColor,
  bookingStatusLabel,
  bookingPaymentBadgeColor,
  bookingPaymentLabel,
}: AgendaSelectionPreviewProps) {
  const top = range.start * slotHeight + 2;
  const height = (range.end - range.start) * slotHeight - 4;
  const durationMinutes = (range.end - range.start) * slotMinutes;

  return (
    <div
      className={`pointer-events-none absolute left-1 right-1 rounded-lg text-[10px] shadow-sm overflow-hidden ${
        visibility.showDurationOnly ? 'px-2 flex items-center' : 'px-2 py-1.5 leading-tight'
      } ${
        isEditingMovedBookingPreview
          ? isConflict
            ? 'border border-[#d13d57] bg-[#ffe8ee] text-[#8b1f3a]'
            : 'border border-[#2f4fd8] bg-[#2f4fd81a] text-[#1d2a66]'
          : 'border border-[#2f4fd8] bg-[#2f4fd81a]'
      }`}
      style={{ top, height }}
    >
      {isEditingMovedBookingPreview ? (
        visibility.showDurationOnly ? (
          <p className="w-full truncate text-[11px] font-semibold leading-none">{title}</p>
        ) : (
          <>
            {visibility.showBadge && (
              <div className="mb-0.5 flex flex-wrap gap-1">
                {isRecurring && <Repeat size={12} className="text-current" />}
                <div className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold ${bookingBadgeColor(state)}`}>
                  {bookingStatusLabel(state)}
                </div>
                <div className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-bold ${bookingPaymentBadgeColor(paymentState)}`}>
                  {bookingPaymentLabel(paymentState)}
                </div>
              </div>
            )}
            {visibility.showTitle && <p className="font-semibold truncate">{title}</p>}
            {isConflict && visibility.showTimeRange && <p className="font-semibold text-[#b42346]">Superposición</p>}
            {visibility.showTimeRange && (
              <p className="opacity-70">
                {slotToTime(range.start)} - {slotToTime(range.end)}
              </p>
            )}
          </>
        )
      ) : (
        <>
          <p className="text-[10px] font-bold leading-none text-[#1d2a66]">{durationMinutes} min</p>
          {!visibility.showDurationOnly && visibility.showTimeRange && (
            <p className="text-[10px] text-[#1d2a66]/80">
              {slotToTime(range.start)} - {slotToTime(range.end)}
            </p>
          )}
        </>
      )}
    </div>
  );
}

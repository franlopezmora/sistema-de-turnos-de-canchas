import type { RefObject } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';

type AgendaToolbarProps = {
  availableSports: string[];
  sportFilter: string;
  selectedDate: Date;
  quickDateInputRef: RefObject<HTMLInputElement | null>;
  isQuickDatePickerOpen: boolean;
  onSportFilterChange: (sport: string) => void;
  onQuickDatePickerOpenChange: (open: boolean) => void;
  onDateChange: (date: Date) => void;
  onMoveDate: (days: number) => void;
  onCreateBooking: () => void;
};

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function AgendaToolbar({
  availableSports,
  sportFilter,
  selectedDate,
  quickDateInputRef,
  isQuickDatePickerOpen,
  onSportFilterChange,
  onQuickDatePickerOpenChange,
  onDateChange,
  onMoveDate,
  onCreateBooking,
}: AgendaToolbarProps) {
  const openNativeDatePicker = () => {
    const input = quickDateInputRef.current;
    if (!input) return;

    if (isQuickDatePickerOpen) {
      input.blur();
      onQuickDatePickerOpenChange(false);
      return;
    }

    const dateInput = input as HTMLInputElement & { showPicker?: () => void };
    onQuickDatePickerOpenChange(true);
    if (typeof dateInput.showPicker === 'function') {
      dateInput.showPicker();
      return;
    }
    input.focus();
    input.click();
  };

  return (
    <div className="rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center">
      <div className="min-w-0 flex-1 overflow-x-auto">
        <div className="flex w-max items-center gap-2 pr-1">
          {availableSports.map((sport) => (
            <button
              key={sport}
              type="button"
              onClick={() => onSportFilterChange(sport)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                sportFilter === sport
                  ? 'bg-[#1d2248] text-white shadow-sm'
                  : 'bg-[#f5f6f8] text-[#6b7280] hover:bg-[#edf0f4]'
              }`}
            >
              {sport}
            </button>
          ))}
        </div>
      </div>

      <div className="shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onMoveDate(-1)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-[#e5e7eb] text-[#727b8d] hover:bg-[#f7f8fb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cfd9ff]"
            aria-label="Dia anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="relative h-9 w-[170px]">
            <button
              type="button"
              onClick={openNativeDatePicker}
              className="inline-flex h-9 w-full items-center gap-2 rounded-lg border border-[#e5e7eb] bg-white px-3 text-sm font-medium text-[#232a3a] hover:bg-[#f8f9fc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cfd9ff]"
              aria-label="Seleccionar fecha"
            >
              <CalendarDays size={14} className="text-[#7a8398]" />
              <span className="truncate tabular-nums">
                {selectedDate.toLocaleDateString('es-AR', {
                  weekday: 'short',
                  day: '2-digit',
                  month: 'short',
                })}
              </span>
            </button>
            <input
              ref={quickDateInputRef}
              type="date"
              value={formatLocalDate(selectedDate)}
              onFocus={() => onQuickDatePickerOpenChange(true)}
              onBlur={() => onQuickDatePickerOpenChange(false)}
              onChange={(event) => {
                const next = new Date(`${event.target.value}T12:00:00`);
                if (!Number.isNaN(next.getTime())) {
                  onDateChange(next);
                }
                onQuickDatePickerOpenChange(false);
              }}
              className="absolute inset-0 opacity-0 pointer-events-none"
              aria-label="Fecha de agenda"
            />
          </div>
          <button
            type="button"
            onClick={() => onMoveDate(1)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-[#e5e7eb] text-[#727b8d] hover:bg-[#f7f8fb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cfd9ff]"
            aria-label="Dia siguiente"
          >
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            onClick={onCreateBooking}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#2f4fd8] px-3 text-sm font-semibold text-white hover:bg-[#2746c1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cfd9ff]"
          >
            <Plus size={14} />
            Crear reserva
          </button>
        </div>
      </div>
    </div>
  );
}

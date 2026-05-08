type BookingHoverParticipant = {
  id: string;
  name: string;
  modeLabel: string;
  status: 'UNPAID' | 'PARTIAL' | 'PAID';
  payable: boolean;
  payer: boolean;
  payerAmount: number;
  debtAmount: number;
};

type BookingHoverCardProps = {
  x: number;
  y: number;
  participants: BookingHoverParticipant[];
};

function participantBadgeClass(participant: BookingHoverParticipant) {
  if (participant.payable === false && participant.payer && participant.modeLabel === 'Pago único') {
    return 'bg-p-positive-bg text-p-accent';
  }
  if (participant.payable === false) return 'bg-p-surface-2 text-p-text-muted';
  if (participant.status === 'PAID') return 'bg-p-positive-bg text-p-positive';
  if (participant.status === 'PARTIAL') return 'bg-p-warning-bg text-p-warning';
  return 'bg-p-surface-3 text-p-text-secondary';
}

function participantBadgeLabel(participant: BookingHoverParticipant) {
  if (participant.payable === false && participant.payer && participant.modeLabel === 'Pago único') {
    return 'Pagador';
  }
  if (participant.payable === false) return 'Sin cargo';
  if (participant.status === 'PAID') return 'Saldado';
  if (participant.status === 'PARTIAL') return 'Parcial';
  return 'Pendiente';
}

export default function BookingHoverCard({ x, y, participants }: BookingHoverCardProps) {
  return (
    <div
      className="pointer-events-none fixed z-40 hidden w-[280px] rounded-xl border border-p-border bg-p-surface shadow-xl text-p-text lg:block"
      style={{ left: x, top: y }}
    >
      <div className="px-3 py-2 border-b border-p-border text-[12px] font-bold">
        Reserva
      </div>
      <div className="px-2 py-1.5">
        {participants.map((participant) => (
          <div key={participant.id} className="grid grid-cols-[16px_1fr_auto] items-start gap-2 px-1 py-1.5">
            <div className="h-4 w-4 rounded-full bg-p-surface-2 text-[9px] font-bold text-p-text-secondary grid place-items-center">
              {participant.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold">{participant.name}</p>
              {participant.payable !== false && (
                <p className="text-[10px] text-p-text-muted">
                  {participant.status === 'PAID'
                    ? 'Saldado'
                    : `${Number(participant.debtAmount || 0).toLocaleString("es-AR", {minimumFractionDigits: 0, maximumFractionDigits: 0})} pendiente`}
                </p>
              )}
              {participant.payable === false && participant.payer && participant.modeLabel === 'Pago único' && (
                <p className="text-[10px] text-p-text-secondary">
                  Pago {Number(participant.payerAmount || 0).toLocaleString("es-AR", {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                </p>
              )}
            </div>
            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold mt-0.5 ${participantBadgeClass(participant)}`}>
              {participantBadgeLabel(participant)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

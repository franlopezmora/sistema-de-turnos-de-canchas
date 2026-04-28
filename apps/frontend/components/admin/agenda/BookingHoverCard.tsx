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
    return 'bg-[#e8eeff] text-[#3155df]';
  }
  if (participant.payable === false) return 'bg-[#f3f5f9] text-[#7c8598]';
  if (participant.status === 'PAID') return 'bg-[#e8f8ed] text-[#1c7a44]';
  if (participant.status === 'PARTIAL') return 'bg-[#fff4e5] text-[#9a5a00]';
  return 'bg-[#eef1f7] text-[#5c667f]';
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
      className="pointer-events-none fixed z-40 hidden w-[280px] rounded-xl border border-[#e3e8f2] bg-white shadow-xl text-[#1f2738] lg:block"
      style={{ left: x, top: y }}
    >
      <div className="px-3 py-2 border-b border-[#eef1f5] text-[12px] font-bold">
        Reserva
      </div>
      <div className="px-2 py-1.5">
        {participants.map((participant) => (
          <div key={participant.id} className="grid grid-cols-[16px_1fr_auto] items-start gap-2 px-1 py-1.5">
            <div className="h-4 w-4 rounded-full bg-[#e8edf7] text-[9px] font-bold text-[#41507a] grid place-items-center">
              {participant.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold">{participant.name}</p>
              {participant.payable !== false && (
                <p className="text-[10px] text-[#7f8798]">
                  {participant.status === 'PAID'
                    ? 'Saldado'
                    : `${Number(participant.debtAmount || 0).toLocaleString("es-AR", {minimumFractionDigits: 0, maximumFractionDigits: 0})} pendiente`}
                </p>
              )}
              {participant.payable === false && participant.payer && participant.modeLabel === 'Pago único' && (
                <p className="text-[10px] text-[#5c6785]">
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

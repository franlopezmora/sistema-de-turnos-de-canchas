import ServicesPage from '../ServicesPage';

interface AdminTabServicesProps {
  clubSlug?: string;
}

export default function AdminTabServices({ clubSlug }: AdminTabServicesProps) {
  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="flex h-full min-h-0 w-full flex-col gap-4 p-4 pb-20 lg:p-6">
        {!clubSlug ? (
          <div className="flex items-center justify-center rounded-xl border border-[#dce2ee] bg-white py-10 shadow-[0_8px_26px_rgba(34,42,68,0.05)]">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#dce2ee] border-t-[#3053e2]" />
            <span className="ml-3 text-[12px] font-semibold text-[#6f7890]">
              Cargando club...
            </span>
          </div>
        ) : (
          <ServicesPage slug={clubSlug} />
        )}
      </div>
    </div>
  );
}

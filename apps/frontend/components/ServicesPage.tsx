'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, Plus, Edit, Trash2, Tag, DollarSign } from 'lucide-react';
import { ClubAdminService, type ClubCatalogService } from '../services/ClubAdminService';
import { extractErrorMessage, reportUiError } from '../utils/uiError';
import AppModal from './AppModal';
import { AdminDataTable, AdminPanel, AdminRightSidebar } from './admin/ui';
import type { AdminDataTableColumn } from './admin/ui';

type ServicesPageProps = {
  slug: string;
};

// ---------------------------------------------------------------------------
// Table columns
// ---------------------------------------------------------------------------

const SERVICE_COLUMNS = (
  onEdit: (s: ClubCatalogService) => void,
  onDelete: (s: ClubCatalogService) => void
): AdminDataTableColumn<ClubCatalogService>[] => [
  {
    key: 'code',
    label: 'Código',
    render: (s) => (
      <span className="font-semibold uppercase tracking-wide text-[#3053e2]">{s.code}</span>
    ),
  },
  {
    key: 'name',
    label: 'Servicio',
    render: (s) => <span className="font-semibold text-[#2a3245]">{s.name}</span>,
  },
  {
    key: 'price',
    label: 'Precio',
    render: (s) => (
      <span className="font-semibold text-[#27314a]">
        ${Number(s.price || 0).toLocaleString()}
      </span>
    ),
  },
  {
    key: 'isActive',
    label: 'Estado',
    render: (s) => (
      <span
        className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
          s.isActive
            ? 'border-[#ccebd7] bg-[#f0fbf4] text-[#167647]'
            : 'border-[#ffd6d6] bg-[#fff5f5] text-[#b42318]'
        }`}
      >
        {s.isActive ? 'Activo' : 'Inactivo'}
      </span>
    ),
  },
  {
    key: '_actions',
    label: '',
    align: 'right',
    render: (s) => (
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => onEdit(s)}
          className="grid h-9 w-9 place-items-center rounded-lg border border-[#dce2ee] bg-white text-[#697386] shadow-sm transition-all hover:border-[#3053e2] hover:bg-[#f1f4ff] hover:text-[#3053e2]"
          title="Editar"
        >
          <Edit size={15} strokeWidth={2.5} />
        </button>
        {s.isActive && (
          <button
            type="button"
            onClick={() => onDelete(s)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-[#ffd6d6] bg-[#fff5f5] text-[#b42318] shadow-sm transition-all hover:bg-[#b42318] hover:text-white"
            title="Dar de baja"
          >
            <Trash2 size={15} strokeWidth={2.5} />
          </button>
        )}
      </div>
    ),
  },
];

type ServiceFormState = {
  code: string;
  name: string;
  description: string;
  price: string;
};

const EMPTY_FORM: ServiceFormState = { code: '', name: '', description: '', price: '' };

const inputClass =
  'h-10 w-full rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] text-[#2a3245] placeholder:text-[#8b93a5] outline-none transition-all focus:border-[#3053e2]';
const labelClass = 'mb-1.5 block text-[12px] font-medium text-[#4e5870]';

export default function ServicesPage({ slug }: ServicesPageProps) {
  const [services, setServices] = useState<ClubCatalogService[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<ClubCatalogService | null>(null);
  const [form, setForm] = useState<ServiceFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ClubCatalogService | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    isWarning?: boolean;
  }>({ show: false, title: 'Informacion', message: '' });

  const loadServices = useCallback(async () => {
    try {
      setLoading(true);
      const rows = await ClubAdminService.getServices(slug, true);
      setServices(rows);
    } catch (error) {
      const message = extractErrorMessage(error, 'No se pudieron cargar los servicios.');
      reportUiError({ area: 'ServicesPage', action: 'loadServices' }, error);
      setFeedbackModal({ show: true, title: 'Error', message, isWarning: true });
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (slug) void loadServices();
  }, [slug, loadServices]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEdit = (row: ClubCatalogService) => {
    setEditing(row);
    setForm({
      code: row.code || '',
      name: row.name || '',
      description: row.description || '',
      price: String(row.price || ''),
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setForm(EMPTY_FORM);
    setEditing(null);
    setFormError('');
  };


  const submitForm = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError('');
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price),
      };
      if (editing) {
        await ClubAdminService.updateService(slug, editing.id, payload);
      } else {
        await ClubAdminService.createService(slug, payload);
      }
      closeModal();
      await loadServices();
    } catch (error) {
      const message = extractErrorMessage(error, 'No se pudo guardar el servicio.');
      reportUiError({ area: 'ServicesPage', action: 'submitForm' }, error);
      setFormError(message);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await ClubAdminService.deleteService(slug, deleteTarget.id);
      setDeleteTarget(null);
      await loadServices();
    } catch (error) {
      const message = extractErrorMessage(error, 'No se pudo eliminar el servicio.');
      reportUiError({ area: 'ServicesPage', action: 'confirmDelete' }, error);
      setFeedbackModal({ show: true, title: 'Error', message, isWarning: true });
    } finally {
      setDeleting(false);
    }
  };

  const filtered = services.filter((row) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;
    return (
      String(row.code || '').toLowerCase().includes(term) ||
      String(row.name || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full flex-1 sm:max-w-md">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#98a1b3]"
            size={16}
            strokeWidth={2.5}
          />
          <input
            type="text"
            placeholder="Buscar por codigo o nombre..."
            className="h-10 w-full rounded-xl border border-[#dce2ee] bg-white pl-10 pr-4 text-[13px] text-[#2a3245] placeholder:text-[#8b93a5] outline-none transition-all focus:border-[#3053e2]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={openNew}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#3053e2] px-4 text-[12px] font-semibold text-white transition-all hover:bg-[#2748cc] sm:w-auto"
        >
          <Plus size={16} strokeWidth={2.5} />
          Nuevo servicio
        </button>
      </div>

      <AdminPanel
        title="Catalogo cobrable"
        description="Servicios que pueden venderse sin depender de stock fisico."
        bodyClassName="p-0"
      >
        <AdminDataTable
          columns={SERVICE_COLUMNS(openEdit, setDeleteTarget)}
          data={filtered}
          rowKey={(s) => s.id}
          loading={loading}
          empty={{ title: 'No hay servicios registrados', description: 'Creá el primero con el botón de arriba.' }}
        />
      </AdminPanel>

      <AdminRightSidebar
        open={isModalOpen}
        title={editing ? 'Editar servicio' : 'Nuevo servicio'}
        description="Catalogo de servicios del club"
        onClose={closeModal}
        widthClassName="w-full max-w-[500px]"
      >
        <form onSubmit={submitForm} className="space-y-5">
          <div id="services-drawer-general" className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] p-3">
            <p className="text-[12px] font-semibold text-[#2a3245]">Datos generales</p>
            <p className="mt-0.5 text-[11px] text-[#6f7890]">Identificación y nombre del servicio.</p>
            <div className="mt-3">
              <label className={labelClass}>Codigo del servicio</label>
              <div className="relative">
                <input
                  required
                  value={form.code}
                  onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  className={`${inputClass} pl-10`}
                  placeholder="Ej: CLASE_PARTICULAR"
                />
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98a1b3]" size={15} strokeWidth={2.5} />
              </div>
            </div>

            <div className="mt-3">
              <label className={labelClass}>Nombre</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className={inputClass}
                placeholder="Ej: Clase particular"
              />
            </div>
          </div>

          <div id="services-drawer-pricing" className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] p-3">
            <p className="text-[12px] font-semibold text-[#2a3245]">Precio</p>
            <p className="mt-0.5 text-[11px] text-[#6f7890]">Definí el valor final de cobro.</p>
            <div className="mt-3">
              <label className={labelClass}>Precio</label>
              <div className="relative">
                <input
                  required
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
                  className={`${inputClass} pl-10`}
                  placeholder="0.00"
                  onWheel={(event) => event.currentTarget.blur()}
                />
                <DollarSign
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98a1b3]"
                  size={15}
                  strokeWidth={2.5}
                />
              </div>
            </div>
          </div>

          <div id="services-drawer-detail" className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] p-3">
            <p className="text-[12px] font-semibold text-[#2a3245]">Detalle descriptivo</p>
            <p className="mt-0.5 text-[11px] text-[#6f7890]">Información adicional para el equipo.</p>
            <div className="mt-3">
              <label className={labelClass}>Descripcion</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                className="min-h-[80px] w-full resize-none rounded-xl border border-[#dce2ee] bg-white px-3 py-2.5 text-[13px] text-[#2a3245] placeholder:text-[#8b93a5] outline-none transition-all focus:border-[#3053e2]"
                placeholder="Detalle opcional del servicio"
              />
            </div>
          </div>

          {formError && (
            <p className="rounded-lg border border-[#ffd6d6] bg-[#fff5f5] px-3 py-2 text-[12px] font-semibold text-[#b42318]">
              {formError}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={closeModal}
              className="h-9 flex-1 rounded-lg border border-[#dce2ee] bg-white text-[12px] font-semibold text-[#4e5870] transition-all hover:bg-[#f8faff]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="h-9 flex-1 rounded-lg bg-[#3053e2] text-[12px] font-semibold text-white transition-all hover:bg-[#2748cc]"
            >
              {editing ? 'Guardar cambios' : 'Crear servicio'}
            </button>
          </div>
        </form>
      </AdminRightSidebar>

      <AppModal
        show={Boolean(deleteTarget)}
        title="Dar de baja servicio"
        message={`Vas a dar de baja el servicio "${deleteTarget?.name || ''}".`}
        cancelText="Cancelar"
        confirmText={deleting ? 'Eliminando...' : 'Si, dar de baja'}
        isWarning
        onClose={() => {
          if (deleting) return;
          setDeleteTarget(null);
        }}
        onCancel={() => {
          if (deleting) return;
          setDeleteTarget(null);
        }}
        onConfirm={() => void confirmDelete()}
      />

      <AppModal
        show={feedbackModal.show}
        title={feedbackModal.title}
        message={feedbackModal.message}
        isWarning={feedbackModal.isWarning}
        confirmText="Entendido"
        cancelText=""
        onClose={() => setFeedbackModal((prev) => ({ ...prev, show: false }))}
      />

    </div>
  );
}

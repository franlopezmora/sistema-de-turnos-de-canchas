'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Plus, Edit, Trash2, Wrench, Tag, DollarSign } from 'lucide-react';
import { ClubAdminService, type ClubCatalogService } from '../services/ClubAdminService';
import { extractErrorMessage, reportUiError } from '../utils/uiError';
import AppModal from './AppModal';
import { AdminPanel, AdminRightSidebar } from './admin/ui';

type ServicesPageProps = {
  slug: string;
};

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
  const [drawerSection, setDrawerSection] = useState<'GENERAL' | 'PRICING' | 'DETAIL'>('GENERAL');

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

  useEffect(() => {
    if (!isModalOpen) return;
    setDrawerSection('GENERAL');
  }, [isModalOpen, editing?.id]);

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

  const serviceSummary = useMemo(() => {
    const active = services.filter((s) => s.isActive);
    const inactive = services.filter((s) => !s.isActive);
    const averagePrice = active.length
      ? active.reduce((sum, s) => sum + Number(s.price || 0), 0) / active.length
      : 0;
    return { total: services.length, active: active.length, inactive: inactive.length, averagePrice };
  }, [services]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-[#dce2ee] bg-white p-4 shadow-[0_8px_26px_rgba(34,42,68,0.05)]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6f7890]">Servicios</p>
          <p className="mt-1 text-[24px] font-bold text-[#3155df]">{serviceSummary.total}</p>
        </div>
        <div className="rounded-xl border border-[#dce2ee] bg-white p-4 shadow-[0_8px_26px_rgba(34,42,68,0.05)]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6f7890]">Activos</p>
          <p className="mt-1 text-[24px] font-bold text-[#2f5e46]">{serviceSummary.active}</p>
        </div>
        <div className="rounded-xl border border-[#dce2ee] bg-white p-4 shadow-[0_8px_26px_rgba(34,42,68,0.05)]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6f7890]">Inactivos</p>
          <p className="mt-1 text-[24px] font-bold text-[#9a5a00]">{serviceSummary.inactive}</p>
        </div>
        <div className="rounded-xl border border-[#dce2ee] bg-white p-4 shadow-[0_8px_26px_rgba(34,42,68,0.05)]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6f7890]">Promedio</p>
          <p className="mt-1 text-[24px] font-bold text-[#27314a]">
            ${Math.round(serviceSummary.averagePrice).toLocaleString()}
          </p>
        </div>
      </div>

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
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#3053e2] px-4 text-[12px] font-semibold text-white transition-all hover:bg-[#2748cc] sm:w-auto"
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
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#edf0f6] bg-[#f8f9fc] text-[11px] font-semibold uppercase tracking-wide text-[#6f7890]">
                <th className="px-5 py-3">Codigo</th>
                <th className="px-5 py-3">Servicio</th>
                <th className="px-5 py-3">Precio</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0f6] text-[12px]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-14 text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#d9dfeb] border-t-[#3053e2]" />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-14 text-center text-sm font-semibold text-[#98a1b3]">
                    No hay servicios registrados
                  </td>
                </tr>
              ) : (
                filtered.map((service) => (
                  <tr key={service.id} className="transition-colors hover:bg-[#f8f9fc]">
                    <td className="px-5 py-4 font-semibold uppercase text-[#3053e2]">{service.code}</td>
                    <td className="px-5 py-4 font-semibold text-[#2a3245]">{service.name}</td>
                    <td className="px-5 py-4 text-[13px] font-semibold text-[#27314a]">
                      ${Number(service.price || 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                          service.isActive
                            ? 'border-[#ccebd7] bg-[#f0fbf4] text-[#167647]'
                            : 'border-[#ffd6d6] bg-[#fff5f5] text-[#b42318]'
                        }`}
                      >
                        {service.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(service)}
                          className="grid h-9 w-9 place-items-center rounded-lg border border-[#dce2ee] bg-white text-[#697386] shadow-sm transition-all hover:border-[#3053e2] hover:bg-[#f1f4ff] hover:text-[#3053e2]"
                          title="Editar"
                        >
                          <Edit size={15} strokeWidth={2.5} />
                        </button>
                        {service.isActive && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(service)}
                            className="grid h-9 w-9 place-items-center rounded-lg border border-[#ffd6d6] bg-[#fff5f5] text-[#b42318] shadow-sm transition-all hover:bg-[#b42318] hover:text-white"
                            title="Dar de baja"
                          >
                            <Trash2 size={15} strokeWidth={2.5} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminPanel>

      <AdminRightSidebar
        open={isModalOpen}
        title={editing ? 'Editar servicio' : 'Nuevo servicio'}
        description="Catalogo de servicios del club"
        onClose={closeModal}
        widthClassName="w-full max-w-[500px]"
        tabs={[
          { id: 'GENERAL', label: 'General' },
          { id: 'PRICING', label: 'Precio' },
          { id: 'DETAIL', label: 'Detalle' },
        ]}
        activeTabId={drawerSection}
        onTabChange={(tabId) => {
          const next = tabId as 'GENERAL' | 'PRICING' | 'DETAIL';
          setDrawerSection(next);
          if (typeof window !== 'undefined') {
            const target = window.document.getElementById(`services-drawer-${next.toLowerCase()}`);
            target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }}
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
              className="h-10 flex-1 rounded-lg border border-[#dce2ee] bg-white text-[13px] font-semibold text-[#4e5870] transition-all hover:bg-[#f8faff]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="h-10 flex-1 rounded-lg bg-[#3053e2] text-[13px] font-semibold text-white transition-all hover:bg-[#2748cc]"
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

      {editing && (
        <div className="sr-only">
          <Wrench aria-hidden />
        </div>
      )}
    </div>
  );
}

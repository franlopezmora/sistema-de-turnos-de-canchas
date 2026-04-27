'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ClubAdminService } from '../services/ClubAdminService';
import { Search, Plus, Edit, Trash2, X, Package, Tag, DollarSign, Box } from 'lucide-react';
import { extractErrorMessage, reportUiError } from '../utils/uiError';
import AppModal from './AppModal';
import { AdminPanel, AdminRightSidebar } from './admin/ui';

interface ProductsPageProps {
  slug?: string;
}

const inputClass =
  'h-10 w-full rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] text-[#2a3245] placeholder:text-[#8b93a5] outline-none transition-all focus:border-[#3053e2]';
const labelClass = 'mb-1.5 block text-[12px] font-medium text-[#4e5870]';

export default function ProductsPage({ slug = '' }: ProductsPageProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState('');
  const [feedbackModal, setFeedbackModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    isWarning?: boolean;
  }>({ show: false, title: 'Informacion', message: '' });
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    stock: '',
    category: '',
    isCombo: false,
    components: [{ componentProductId: '', quantity: '1' }],
  });
  const [drawerSection, setDrawerSection] = useState<'GENERAL' | 'PRICING' | 'COMPOSITION'>('GENERAL');

  const loadProducts = useCallback(async () => {
    try {
      const data = await ClubAdminService.getProducts(slug);
      setProducts(data);
    } catch (error) {
      reportUiError({ area: 'ProductsPage', action: 'loadProducts' }, error);
      setFeedbackModal({ show: true, title: 'Error', message: 'No se pudieron cargar los productos.', isWarning: true });
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (slug) loadProducts();
  }, [slug, loadProducts]);

  const emptyForm = () => ({
    name: '',
    price: '',
    stock: '',
    category: '',
    isCombo: false,
    components: [{ componentProductId: '', quantity: '1' }],
  });

  const openNew = () => {
    setEditingProduct(null);
    setFormData(emptyForm());
    setFormError('');
    setIsModalOpen(true);
  };

  const openEdit = (product: any) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      price: String(product.price),
      stock: String(product.baseStock ?? product.stock ?? 0),
      category: product.category || '',
      isCombo: Boolean(product.isCombo),
      components:
        Array.isArray(product.components) && product.components.length > 0
          ? product.components.map((c: any) => ({
              componentProductId: String(c.componentProductId),
              quantity: String(c.quantity),
            }))
          : [{ componentProductId: '', quantity: '1' }],
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setFormData(emptyForm());
    setFormError('');
  };

  useEffect(() => {
    if (!isModalOpen) return;
    setDrawerSection('GENERAL');
  }, [isModalOpen, editingProduct?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const components = formData.components
      .map((c) => ({
        componentProductId: Number(c.componentProductId),
        quantity: Number(c.quantity),
      }))
      .filter(
        (c) =>
          Number.isFinite(c.componentProductId) &&
          c.componentProductId > 0 &&
          Number.isFinite(c.quantity) &&
          c.quantity > 0
      );

    if (formData.isCombo) {
      if (components.length === 0) {
        setFormError('Un combo debe tener al menos un componente.');
        return;
      }
      const ids = components.map((c) => c.componentProductId);
      if (new Set(ids).size !== ids.length) {
        setFormError('No podés repetir el mismo producto en un combo.');
        return;
      }
      if (editingProduct && ids.includes(Number(editingProduct.id))) {
        setFormError('Un producto no puede ser componente de sí mismo.');
        return;
      }
    }

    try {
      const payload = {
        name: formData.name,
        price: Number(formData.price),
        stock: formData.isCombo ? 0 : Number(formData.stock),
        category: formData.category,
        isCombo: formData.isCombo,
        components: formData.isCombo ? components : [],
      };
      if (editingProduct) {
        await ClubAdminService.updateProduct(slug, editingProduct.id, payload);
      } else {
        await ClubAdminService.createProduct(slug, payload);
      }
      closeModal();
      loadProducts();
    } catch (error) {
      const message = extractErrorMessage(error, 'No se pudo guardar el producto.');
      reportUiError({ area: 'ProductsPage', action: 'saveProduct' }, error);
      setFormError(message);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await ClubAdminService.deleteProduct(slug, deleteTarget.id);
      loadProducts();
      setDeleteTarget(null);
    } catch (error) {
      const message = extractErrorMessage(error, 'No se pudo dar de baja el producto.');
      reportUiError({ area: 'ProductsPage', action: 'deleteProduct' }, error);
      setFeedbackModal({ show: true, title: 'Error', message, isWarning: true });
    } finally {
      setDeleting(false);
    }
  };

  const addComponentRow = () => {
    setFormData((prev) => ({
      ...prev,
      components: [...prev.components, { componentProductId: '', quantity: '1' }],
    }));
  };

  const removeComponentRow = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      components: prev.components.filter((_, i) => i !== index),
    }));
  };

  const updateComponentRow = (index: number, field: 'componentProductId' | 'quantity', value: string) => {
    setFormData((prev) => ({
      ...prev,
      components: prev.components.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    }));
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const comboComponentOptions = products.filter(
    (p) => !editingProduct || p.id !== editingProduct.id
  );

  const productSummary = useMemo(() => {
    const simple = products.filter((p) => !p.isCombo);
    const combos = products.filter((p) => p.isCombo);
    const lowStock = simple.filter((p) => Number(p.stock || 0) < 5);
    const stockValue = simple.reduce((sum, p) => sum + Number(p.stock || 0) * Number(p.price || 0), 0);
    return { total: products.length, combos: combos.length, lowStock: lowStock.length, stockValue };
  }, [products]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-[#dce2ee] bg-white p-4 shadow-[0_8px_26px_rgba(34,42,68,0.05)]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6f7890]">Items</p>
          <p className="mt-1 text-[24px] font-bold text-[#3155df]">{productSummary.total}</p>
        </div>
        <div className="rounded-xl border border-[#dce2ee] bg-white p-4 shadow-[0_8px_26px_rgba(34,42,68,0.05)]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6f7890]">Combos</p>
          <p className="mt-1 text-[24px] font-bold text-[#2f5e46]">{productSummary.combos}</p>
        </div>
        <div className="rounded-xl border border-[#dce2ee] bg-white p-4 shadow-[0_8px_26px_rgba(34,42,68,0.05)]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6f7890]">Bajo stock</p>
          <p className="mt-1 text-[24px] font-bold text-[#9a5a00]">{productSummary.lowStock}</p>
        </div>
        <div className="rounded-xl border border-[#dce2ee] bg-white p-4 shadow-[0_8px_26px_rgba(34,42,68,0.05)]">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6f7890]">Valor stock</p>
          <p className="mt-1 text-[24px] font-bold text-[#27314a]">${productSummary.stockValue.toLocaleString()}</p>
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
            placeholder="Buscar por nombre de producto..."
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
          Nuevo producto
        </button>
      </div>

      <AdminPanel
        title="Inventario"
        description="Lista operativa de productos, combos, precios y stock disponible."
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#edf0f6] bg-[#f8f9fc] text-[11px] font-semibold uppercase tracking-wide text-[#6f7890]">
                <th className="px-5 py-3">Producto</th>
                <th className="px-5 py-3">Tipo</th>
                <th className="px-5 py-3">Categoria</th>
                <th className="px-5 py-3">Stock</th>
                <th className="px-5 py-3">Precio</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf0f6] text-[12px]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-14 text-center">
                    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#d9dfeb] border-t-[#3053e2]" />
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-14 text-center text-sm font-semibold text-[#98a1b3]">
                    No hay productos registrados
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="transition-colors hover:bg-[#f8f9fc]">
                    <td className="px-5 py-4 font-semibold text-[#2a3245]">{product.name}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                          product.isCombo
                            ? 'border-[#c7d2ff] bg-[#eef1ff] text-[#3053e2]'
                            : 'border-[#dce2ee] bg-[#f5f7fb] text-[#697386]'
                        }`}
                      >
                        {product.isCombo ? 'Combo' : 'Simple'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full border border-[#dce2ee] bg-[#f5f7fb] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#697386]">
                        {product.category || 'General'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-lg border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                          product.stock < 5
                            ? 'border-[#ffd6d6] bg-[#fff5f5] text-[#b42318]'
                            : 'border-[#ccebd7] bg-[#f0fbf4] text-[#167647]'
                        }`}
                      >
                        {product.stock} u.
                      </span>
                    </td>
                    <td className="px-5 py-4 text-[13px] font-semibold text-[#27314a]">
                      ${product.price?.toLocaleString?.() ?? product.price}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(product)}
                          className="grid h-9 w-9 place-items-center rounded-lg border border-[#dce2ee] bg-white text-[#697386] shadow-sm transition-all hover:border-[#3053e2] hover:bg-[#f1f4ff] hover:text-[#3053e2]"
                          title="Editar"
                        >
                          <Edit size={15} strokeWidth={2.5} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(product)}
                          className="grid h-9 w-9 place-items-center rounded-lg border border-[#ffd6d6] bg-[#fff5f5] text-[#b42318] shadow-sm transition-all hover:bg-[#b42318] hover:text-white"
                          title="Dar de baja"
                        >
                          <Trash2 size={15} strokeWidth={2.5} />
                        </button>
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
        title={editingProduct ? 'Editar producto' : 'Nuevo producto'}
        description="Inventario del club"
        onClose={closeModal}
        widthClassName="w-full max-w-[560px]"
        tabs={[
          { id: 'GENERAL', label: 'General' },
          { id: 'PRICING', label: 'Precio y stock' },
          { id: 'COMPOSITION', label: 'Composicion' },
        ]}
        activeTabId={drawerSection}
        onTabChange={(tabId) => {
          const next = tabId as 'GENERAL' | 'PRICING' | 'COMPOSITION';
          setDrawerSection(next);
          if (typeof window !== 'undefined') {
            const target = window.document.getElementById(`products-drawer-${next.toLowerCase()}`);
            target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div id="products-drawer-general" className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] p-3">
            <p className="text-[12px] font-semibold text-[#2a3245]">Datos generales</p>
            <p className="mt-0.5 text-[11px] text-[#6f7890]">Nombre comercial y tipo del producto.</p>
            <div className="mt-3">
              <label className={labelClass}>Nombre del producto</label>
              <div className="relative">
                <input
                  required
                  placeholder="Ej: Gatorade Blue"
                  className={`${inputClass} pl-10`}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98a1b3]" size={15} strokeWidth={2.5} />
              </div>
            </div>

            <div className="mt-3">
              <label className={labelClass}>Tipo de producto</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, isCombo: false }))}
                  className={`h-10 rounded-xl border text-[12px] font-semibold transition-all ${
                    !formData.isCombo
                      ? 'border-[#3053e2] bg-[#f1f4ff] text-[#3053e2]'
                      : 'border-[#d9dfeb] bg-white text-[#697386] hover:bg-[#f8faff]'
                  }`}
                >
                  Producto simple
                </button>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, isCombo: true }))}
                  className={`h-10 rounded-xl border text-[12px] font-semibold transition-all ${
                    formData.isCombo
                      ? 'border-[#3053e2] bg-[#f1f4ff] text-[#3053e2]'
                      : 'border-[#d9dfeb] bg-white text-[#697386] hover:bg-[#f8faff]'
                  }`}
                >
                  Combo
                </button>
              </div>
            </div>
          </div>

          <div id="products-drawer-pricing" className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] p-3">
            <p className="text-[12px] font-semibold text-[#2a3245]">Precio y stock</p>
            <p className="mt-0.5 text-[11px] text-[#6f7890]">Definí valores de venta y disponibilidad.</p>
            <div className="mt-3">
              <label className={labelClass}>Precio ($)</label>
              <div className="relative">
                <input
                  required
                  type="number"
                  min="0"
                  placeholder="0"
                  className={`${inputClass} pl-10`}
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  onWheel={(event) => event.currentTarget.blur()}
                />
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98a1b3]" size={15} strokeWidth={2.5} />
              </div>
            </div>

            {!formData.isCombo && (
              <div className="mt-3">
                <label className={labelClass}>Stock inicial</label>
                <div className="relative">
                  <input
                    required
                    type="number"
                    min="0"
                    placeholder="0"
                    className={`${inputClass} pl-10`}
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    onWheel={(event) => event.currentTarget.blur()}
                  />
                  <Box className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98a1b3]" size={15} strokeWidth={2.5} />
                </div>
              </div>
            )}

            <div className="mt-3">
              <label className={labelClass}>Categoria (opcional)</label>
              <div className="relative">
                <input
                  className={`${inputClass} pl-10`}
                  placeholder="Ej: Bebidas, Grips, Alquiler..."
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                />
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98a1b3]" size={15} strokeWidth={2.5} />
              </div>
            </div>
          </div>

          {formData.isCombo && (
            <div id="products-drawer-composition" className="rounded-xl border border-[#dce2ee] bg-[#f8f9fd] p-3">
              <p className="text-[12px] font-semibold text-[#2a3245]">Composición del combo</p>
              <p className="mt-0.5 text-[11px] text-[#6f7890]">Seleccioná los productos que forman el combo.</p>
              <label className={labelClass}>Componentes del combo</label>
              <div className="space-y-2">
                {formData.components.map((component, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-center">
                    <select
                      className="col-span-7 h-10 rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] text-[#2a3245] outline-none transition-all focus:border-[#3053e2]"
                      value={component.componentProductId}
                      onChange={(e) => updateComponentRow(index, 'componentProductId', e.target.value)}
                    >
                      <option value="">Seleccionar producto</option>
                      {comboComponentOptions.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      className="col-span-3 h-10 rounded-xl border border-[#dce2ee] bg-white px-3 text-[13px] text-[#2a3245] outline-none transition-all focus:border-[#3053e2]"
                      value={component.quantity}
                      onChange={(e) => updateComponentRow(index, 'quantity', e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => removeComponentRow(index)}
                      className="col-span-2 grid h-10 place-items-center rounded-lg border border-[#ffd6d6] bg-[#fff5f5] text-[#b42318] transition-all hover:bg-[#b42318] hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addComponentRow}
                className="mt-2 h-9 w-full rounded-lg border border-[#dce2ee] bg-white text-[12px] font-semibold text-[#3053e2] transition-colors hover:bg-[#f1f4ff]"
              >
                + Agregar componente
              </button>
            </div>
          )}

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
              {editingProduct ? 'Guardar cambios' : 'Confirmar ingreso'}
            </button>
          </div>
        </form>
      </AdminRightSidebar>

      <AppModal
        show={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onCancel={() => setDeleteTarget(null)}
        title="Dar de baja producto"
        message={
          deleteTarget ? (
            <span>
              <strong>{deleteTarget.name}</strong> no se va a borrar definitivamente. Lo vamos a dar de baja para que no aparezca en el stock ni en los consumos.
            </span>
          ) : null
        }
        cancelText="Cancelar"
        confirmText={deleting ? 'Dando de baja...' : 'Dar de baja'}
        isWarning
        onConfirm={confirmDelete}
        confirmDisabled={deleting}
      />

      <AppModal
        show={feedbackModal.show}
        onClose={() => setFeedbackModal((prev) => ({ ...prev, show: false }))}
        title={feedbackModal.title}
        message={feedbackModal.message}
        cancelText=""
        confirmText="Aceptar"
        isWarning={feedbackModal.isWarning}
      />
    </div>
  );
}

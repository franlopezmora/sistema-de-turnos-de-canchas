import type { GetServerSideProps } from 'next';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Users } from 'lucide-react';
import AdminRouteShell from '../../components/admin/AdminRouteShell';
import {
  AdminDataTable,
  AdminDrawer,
  AdminDrawerSection,
  type AdminDataTableColumn,
  AdminFeedbackBanner,
  AdminFilterToolbar,
  AdminInlineError,
  MetricCard,
  AdminPanel,
} from '../../components/admin/ui';
import {
  ClubAdminService,
  type AdminAcademyStudentListItem,
  type AdminAcademyStudentOverview,
} from '../../services/ClubAdminService';
import { getActiveClubSlug, normalizeSessionUser } from '../../utils/session';
import { extractErrorMessage, reportUiError } from '../../utils/uiError';

const drawerSectionCardClass = 'rounded-2xl border border-p-border bg-p-surface-2 p-4';

const formatDateTime = (value: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDateRange = (startsAt: string, endsAt: string) => {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '-';
  const day = start.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const startTime = start.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  const endTime = end.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${startTime} - ${endTime}`;
};

const paymentStatusLabel = (status: string) => {
  switch (status) {
    case 'UNPAID':
      return 'Impago';
    case 'PARTIAL':
      return 'Pago parcial';
    case 'PAID':
      return 'Pagado';
    case 'COVERED_BY_CREDIT':
      return 'Cubierto por crédito';
    case 'REFUNDED':
      return 'Reintegrado';
    default:
      return status;
  }
};

const attendanceStatusLabel = (status: string) => {
  switch (status) {
    case 'PENDING':
      return 'Pendiente';
    case 'ATTENDED':
      return 'Asistió';
    case 'ABSENT':
      return 'Ausente';
    case 'NO_SHOW':
      return 'No show';
    case 'CANCELLED_ON_TIME':
      return 'Canceló a tiempo';
    case 'CANCELLED_LATE':
      return 'Canceló tarde';
    default:
      return status;
  }
};

const enrollmentStatusLabel = (status: string) => {
  switch (status) {
    case 'ENROLLED':
      return 'Inscripto';
    case 'WAITLISTED':
      return 'En espera';
    case 'CANCELLED':
      return 'Cancelado';
    default:
      return status;
  }
};

const classPassStatusLabel = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return 'Activo';
    case 'EXPIRED':
      return 'Vencido';
    case 'DEPLETED':
      return 'Sin saldo';
    case 'CANCELLED':
      return 'Cancelado';
    default:
      return status;
  }
};

const classTypeLabel = (value: string | null) => {
  if (!value) return 'Sin formato';
  return value === 'GROUP' ? 'Grupal' : 'Individual';
};

const relationshipTypeLabel = (value: string) => {
  switch (value) {
    case 'PARENT':
      return 'Madre / padre';
    case 'GUARDIAN':
      return 'Tutor';
    case 'CHILD':
      return 'Hijo/a';
    case 'PAYER':
      return 'Responsable de pago';
    case 'FAMILY_MEMBER':
      return 'Familiar';
    case 'EMERGENCY_CONTACT':
      return 'Contacto de emergencia';
    case 'OTHER':
      return 'Otro vínculo';
    default:
      return value;
  }
};

const creditUsageReasonLabel = (value: string) => {
  switch (value) {
    case 'ATTENDANCE':
      return 'Asistencia';
    case 'LATE_CANCEL':
      return 'Cancelación tardía';
    case 'NO_SHOW':
      return 'No show';
    case 'MANUAL_ADJUSTMENT':
      return 'Ajuste manual';
    case 'REFUND_REVERSAL':
      return 'Reversión';
    default:
      return value;
  }
};

const personSecondaryLine = (row: { email?: string | null; phone?: string | null }) =>
  String(row.phone || '').trim() || String(row.email || '').trim() || 'Sin contacto cargado';

export default function AdminAcademyStudentsPage() {
  return (
    <AdminRouteShell title="Academia | Pique Admin" activeItem="Academia" fromPath="/admin/academia">
      {(user) => <AdminAcademyStudentsPageContent user={user} />}
    </AdminRouteShell>
  );
}

export function AdminAcademyStudentsPageContent({ user, embedded = false }: { user: any; embedded?: boolean }) {
  const normalizedUser = useMemo(() => normalizeSessionUser(user || null), [user]);
  const clubSlug = useMemo(() => getActiveClubSlug(normalizedUser), [normalizedUser]);

  const [students, setStudents] = useState<AdminAcademyStudentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [overview, setOverview] = useState<AdminAcademyStudentOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState('');
  const studentsRequestRef = useRef(0);
  const overviewRequestRef = useRef(0);

  const loadStudents = useCallback(
    async (query?: string) => {
      if (!clubSlug) {
        setStudents([]);
        setLoading(false);
        return;
      }
      const requestId = studentsRequestRef.current + 1;
      studentsRequestRef.current = requestId;
      try {
        setLoading(true);
        const rows = await ClubAdminService.getAcademyStudents(clubSlug, { q: query?.trim() || undefined });
        if (studentsRequestRef.current !== requestId) return;
        setStudents(rows);
        setFeedback(null);
      } catch (error) {
        if (studentsRequestRef.current !== requestId) return;
        reportUiError({ area: 'AdminAcademyStudentsPage', action: 'loadStudents' }, error);
        setStudents([]);
        setFeedback({
          tone: 'error',
          message: extractErrorMessage(error, 'No se pudieron cargar los alumnos de Academia.'),
        });
      } finally {
        if (studentsRequestRef.current !== requestId) return;
        setLoading(false);
      }
    },
    [clubSlug]
  );

  const loadOverview = useCallback(
    async (clientId: string) => {
      if (!clubSlug) return;
      const requestId = overviewRequestRef.current + 1;
      overviewRequestRef.current = requestId;
      try {
        setOverviewLoading(true);
        setOverviewError('');
        const row = await ClubAdminService.getAcademyStudentOverview(clubSlug, clientId);
        if (overviewRequestRef.current !== requestId) return;
        setOverview(row);
      } catch (error) {
        if (overviewRequestRef.current !== requestId) return;
        reportUiError({ area: 'AdminAcademyStudentsPage', action: 'loadOverview' }, error);
        setOverview(null);
        setOverviewError(
          extractErrorMessage(error, 'No se pudo cargar el resumen académico del alumno.')
        );
      } finally {
        if (overviewRequestRef.current !== requestId) return;
        setOverviewLoading(false);
      }
    },
    [clubSlug]
  );

  useEffect(() => {
    const query = searchTerm.trim();
    const timer = window.setTimeout(() => {
      void loadStudents(query);
    }, query ? 220 : 0);

    return () => window.clearTimeout(timer);
  }, [loadStudents, searchTerm]);

  useEffect(() => {
    if (!selectedStudentId) {
      overviewRequestRef.current += 1;
      setOverview(null);
      setOverviewError('');
      setOverviewLoading(false);
      return;
    }
    void loadOverview(selectedStudentId);
  }, [loadOverview, selectedStudentId]);

  useEffect(() => {
    if (!selectedStudentId) return;
    if (!students.some((row) => row.client.id === selectedStudentId)) {
      setSelectedStudentId(null);
      setOverview(null);
    }
  }, [selectedStudentId, students]);

  const summary = useMemo(() => {
    return students.reduce(
      (acc, row) => {
        acc.totalStudents += 1;
        acc.totalRemainingCredits += row.summary.totalRemainingCredits;
        acc.totalActivePasses += row.summary.activePassesCount;
        if (row.summary.upcomingEnrollmentsCount > 0) acc.studentsWithUpcoming += 1;
        return acc;
      },
      {
        totalStudents: 0,
        totalRemainingCredits: 0,
        totalActivePasses: 0,
        studentsWithUpcoming: 0,
      }
    );
  }, [students]);

  const selectedStudentListRow = useMemo(
    () => students.find((row) => row.client.id === selectedStudentId) || null,
    [selectedStudentId, students]
  );

  const columns = useMemo<AdminDataTableColumn<AdminAcademyStudentListItem>[]>(
    () => [
      {
        key: 'student',
        label: 'Alumno',
        render: (row) => (
          <div className="min-w-0">
            <p className="truncate font-semibold text-p-text">{row.client.name}</p>
            <p className="mt-0.5 text-[12px] text-p-text-muted">{personSecondaryLine(row.client)}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {row.client.linkedUser ? (
                <span className="inline-flex rounded-full border border-p-border bg-p-surface-2 px-2 py-0.5 text-[11px] font-semibold text-p-text-secondary">
                  Usuario Pique
                </span>
              ) : null}
              {row.summary.incomingRelationshipsCount > 0 ? (
                <span className="inline-flex rounded-full border border-p-border bg-p-surface-2 px-2 py-0.5 text-[11px] font-semibold text-p-text-secondary">
                  {row.summary.incomingRelationshipsCount} responsable{row.summary.incomingRelationshipsCount === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
          </div>
        ),
      },
      {
        key: 'classes',
        label: 'Clases',
        width: 'w-[170px]',
        render: (row) => (
          <div className="text-[12px] text-p-text-secondary">
            <p className="font-medium text-p-text">{row.summary.upcomingEnrollmentsCount} próximas</p>
            <p className="mt-0.5 text-p-text-muted">{row.summary.pastEnrollmentsCount} pasadas</p>
          </div>
        ),
      },
      {
        key: 'credits',
        label: 'Créditos',
        width: 'w-[150px]',
        render: (row) => (
          <div className="text-[12px] text-p-text-secondary">
            <p className="font-medium text-p-text">{row.summary.totalRemainingCredits} disponibles</p>
            <p className="mt-0.5 text-p-text-muted">{row.summary.activePassesCount} pack{row.summary.activePassesCount === 1 ? '' : 's'} activo{row.summary.activePassesCount === 1 ? '' : 's'}</p>
          </div>
        ),
      },
      {
        key: 'activity',
        label: 'Actividad',
        render: (row) => (
          <div className="text-[12px] text-p-text-secondary">
            <p>Próxima: {formatDateTime(row.nextClassAt)}</p>
            <p className="mt-0.5 text-p-text-muted">Última: {formatDateTime(row.lastClassAt)}</p>
          </div>
        ),
      },
      {
        key: 'actions',
        label: '',
        align: 'right',
        isActions: true,
        width: 'w-[150px]',
        render: (row) => (
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setSelectedStudentId(row.client.id)}
              className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-p-border bg-p-surface px-2.5 text-[11px] font-semibold text-p-text-muted transition hover:border-p-border-strong hover:text-p-text"
            >
              <Users size={13} />
              Ver alumno
            </button>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div
      className={`flex h-full min-h-0 flex-col gap-4 overflow-y-auto ${
        embedded ? 'px-0 pb-6' : 'p-4 pb-4 lg:p-6 lg:pb-6'
      }`}
    >
      {feedback ? (
        <AdminFeedbackBanner tone={feedback.tone} title={feedback.tone === 'error' ? 'Error' : 'Listo'}>
          {feedback.message}
        </AdminFeedbackBanner>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <MetricCard label="Alumnos activos" value={summary.totalStudents} format="number" />
        <MetricCard label="Con próximas clases" value={summary.studentsWithUpcoming} format="number" valueColor="var(--accent-fg)" />
        <MetricCard label="Créditos disponibles" value={summary.totalRemainingCredits} format="number" />
      </div>

      <AdminPanel
        title="Alumnos de Academia"
        description="Consultá rápido clases, asistencia, responsables, packs y consumos sin salir del módulo."
        bodyClassName="p-0"
        actions={
          <AdminFilterToolbar className="border-0 bg-transparent p-0 gap-2 sm:flex-nowrap sm:justify-end">
            <div className="relative w-full sm:w-[320px] sm:flex-none">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-p-text-muted" size={14} strokeWidth={2.5} />
              <input
                type="text"
                placeholder="Buscar por nombre, teléfono o email..."
                className="h-8 w-full rounded-xl border border-p-border bg-p-surface pl-9 pr-3 text-[12px] text-p-text placeholder:text-p-text-muted outline-none transition focus:border-p-accent"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </AdminFilterToolbar>
        }
      >
        <AdminDataTable
          columns={columns}
          data={students}
          rowKey={(row) => row.client.id}
          loading={loading}
          onRowClick={(row) => setSelectedStudentId(row.client.id)}
          rowClassName={(row) =>
            row.client.id === selectedStudentId ? 'bg-p-surface-2/80 ring-1 ring-inset ring-p-border-strong' : ''
          }
          empty={{
            title: searchTerm.trim() ? 'No encontramos alumnos con ese criterio' : 'Todavía no hay alumnos con actividad académica',
            description: searchTerm.trim()
              ? 'Probá con otro nombre, teléfono o email.'
              : 'Aparecerán acá cuando el club tenga inscripciones, packs o vínculos académicos cargados.',
          }}
        />
      </AdminPanel>

      <AdminDrawer
        open={Boolean(selectedStudentId)}
        onClose={() => {
          setSelectedStudentId(null);
          setOverview(null);
          setOverviewError('');
        }}
        title={overview?.client.name || selectedStudentListRow?.client.name || 'Alumno'}
        subtitle="Resumen rápido de clases, asistencia, packs, consumos y vínculos relevantes de Academia."
        size="lg"
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setSelectedStudentId(null);
                setOverview(null);
                setOverviewError('');
              }}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-p-border px-3 text-sm font-semibold text-p-text-muted transition hover:border-p-border-strong hover:text-p-text"
            >
              Cerrar
            </button>
          </div>
        }
      >
        {overviewLoading ? (
          <div className="rounded-2xl border border-p-border bg-p-surface-2 p-4 text-sm text-p-text-secondary">
            Cargando resumen académico del alumno...
          </div>
        ) : null}

        {!overviewLoading && overviewError ? <AdminInlineError>{overviewError}</AdminInlineError> : null}

        {!overviewLoading && overview ? (
          <div className="space-y-4">
            <AdminDrawerSection title="Resumen" className={drawerSectionCardClass}>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <SummaryBlock label="Contacto" value={personSecondaryLine(overview.client)} />
                <SummaryBlock
                  label="Usuario vinculado"
                  value={
                    overview.client.linkedUser
                      ? [overview.client.linkedUser.firstName, overview.client.linkedUser.lastName]
                          .filter(Boolean)
                          .join(' ')
                          .trim() || overview.client.linkedUser.email
                      : 'Sin usuario vinculado'
                  }
                />
                <SummaryBlock label="Créditos disponibles" value={`${overview.summary.totalRemainingCredits}`} />
                <SummaryBlock label="Packs activos" value={`${overview.summary.activePassesCount}`} />
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <MiniInfoCard
                  title="Responsables de pago"
                  emptyLabel="Sin responsable cargado"
                  items={overview.billingResponsibles.map((row) => row.name)}
                />
                <MiniInfoCard
                  title="Vínculos activos"
                  emptyLabel="Sin vínculos cargados"
                  items={[
                    ...overview.incomingRelationships.map((row) => `${relationshipTypeLabel(row.relationshipType)}: ${row.fromClient?.name || 'Cliente'}`),
                    ...overview.outgoingRelationships.map((row) => `${relationshipTypeLabel(row.relationshipType)}: ${row.toClient?.name || 'Cliente'}`),
                  ]}
                />
              </div>
            </AdminDrawerSection>

            <AdminDrawerSection title="Próximas clases" className={drawerSectionCardClass}>
              {overview.upcomingEnrollments.length ? (
                <div className="space-y-3">
                  {overview.upcomingEnrollments.map((enrollment) => (
                    <EnrollmentTimelineRow key={enrollment.id} enrollment={enrollment} />
                  ))}
                </div>
              ) : (
                <EmptySectionCopy text="Este alumno no tiene clases próximas." />
              )}
            </AdminDrawerSection>

            <AdminDrawerSection title="Historial de clases" className={drawerSectionCardClass}>
              {overview.pastEnrollments.length ? (
                <div className="space-y-3">
                  {overview.pastEnrollments.slice(0, 12).map((enrollment) => (
                    <EnrollmentTimelineRow key={enrollment.id} enrollment={enrollment} />
                  ))}
                </div>
              ) : (
                <EmptySectionCopy text="Todavía no hay clases pasadas para este alumno." />
              )}
            </AdminDrawerSection>

            <AdminDrawerSection title="Tarjetitas / packs" className={drawerSectionCardClass}>
              <div className="space-y-4">
                {overview.beneficiaryPasses.length ? (
                  <div className="space-y-3">
                    <SectionSubheading>Como beneficiario</SectionSubheading>
                    {overview.beneficiaryPasses.map((classPass) => (
                      <ClassPassCard key={classPass.id} classPass={classPass} clientId={overview.client.id} />
                    ))}
                  </div>
                ) : null}

                {overview.ownedPasses.length ? (
                  <div className="space-y-3">
                    <SectionSubheading>Como titular</SectionSubheading>
                    {overview.ownedPasses.map((classPass) => (
                      <ClassPassCard key={classPass.id} classPass={classPass} clientId={overview.client.id} />
                    ))}
                  </div>
                ) : null}

                {!overview.beneficiaryPasses.length && !overview.ownedPasses.length ? (
                  <EmptySectionCopy text="No hay packs cargados para este alumno." />
                ) : null}
              </div>
            </AdminDrawerSection>

            <AdminDrawerSection title="Consumos de crédito" className={drawerSectionCardClass}>
              {overview.creditUsages.length ? (
                <div className="space-y-3">
                  {overview.creditUsages.slice(0, 12).map((usage) => (
                    <div key={usage.id} className="rounded-xl border border-p-border bg-p-surface p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-p-text">
                            {usage.classPass?.packageName || 'Pack sin referencia'}
                          </p>
                          <p className="mt-0.5 text-[12px] text-p-text-secondary">
                            {creditUsageReasonLabel(usage.reason)} · {usage.creditsUsed} crédito{usage.creditsUsed === 1 ? '' : 's'}
                          </p>
                        </div>
                        <span className="text-[11px] text-p-text-muted">{formatDateTime(usage.usedAt)}</span>
                      </div>
                      <div className="mt-2 grid gap-2 text-[12px] text-p-text-secondary md:grid-cols-2">
                        <p>
                          Clase:{' '}
                          {usage.classEnrollment?.classSession
                            ? formatDateRange(
                                usage.classEnrollment.classSession.startsAt,
                                usage.classEnrollment.classSession.endsAt
                              )
                            : 'Sin clase referenciada'}
                        </p>
                        <p>
                          Registró:{' '}
                          {usage.createdByUser
                            ? [usage.createdByUser.firstName, usage.createdByUser.lastName].filter(Boolean).join(' ').trim() ||
                              usage.createdByUser.email
                            : 'Sin referencia'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptySectionCopy text="Todavía no hay consumos registrados para este alumno." />
              )}
            </AdminDrawerSection>

            <AdminDrawerSection title="Relaciones y responsables" className={drawerSectionCardClass}>
              <div className="grid gap-4 lg:grid-cols-2">
                <RelationshipCard
                  title="Personas que pueden ayudar a gestionarlo"
                  rows={overview.incomingRelationships}
                  side="incoming"
                />
                <RelationshipCard
                  title="Personas a cargo desde este cliente"
                  rows={overview.outgoingRelationships}
                  side="outgoing"
                />
              </div>
            </AdminDrawerSection>
          </div>
        ) : null}
      </AdminDrawer>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: '/admin/academia?tab=alumnos', permanent: false },
});

function SummaryBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-p-border bg-p-surface p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-p-text-muted">{label}</p>
      <p className="mt-2 text-sm font-medium text-p-text">{value}</p>
    </div>
  );
}

function MiniInfoCard({ title, items, emptyLabel }: { title: string; items: string[]; emptyLabel: string }) {
  const filtered = items.filter(Boolean);
  return (
    <div className="rounded-xl border border-p-border bg-p-surface p-3">
      <p className="text-[12px] font-semibold text-p-text">{title}</p>
      {filtered.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {filtered.map((item) => (
            <span
              key={item}
              className="inline-flex rounded-full border border-p-border bg-p-surface-2 px-2 py-1 text-[11px] font-medium text-p-text-secondary"
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[12px] text-p-text-muted">{emptyLabel}</p>
      )}
    </div>
  );
}

function SectionSubheading({ children }: { children: ReactNode }) {
  return <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-p-text-muted">{children}</p>;
}

function EmptySectionCopy({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-p-border bg-p-surface p-3 text-[12px] text-p-text-muted">{text}</p>;
}

function EnrollmentTimelineRow({
  enrollment,
}: {
  enrollment: AdminAcademyStudentOverview['upcomingEnrollments'][number];
}) {
  return (
    <div className="rounded-xl border border-p-border bg-p-surface p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-p-text">
            {enrollment.classSession.teacher?.displayName || 'Clase sin profesor'}
          </p>
          <p className="mt-0.5 text-[12px] text-p-text-secondary">
            {formatDateRange(enrollment.classSession.startsAt, enrollment.classSession.endsAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <span className="inline-flex rounded-full border border-p-border bg-p-surface-2 px-2 py-0.5 text-[11px] font-semibold text-p-text-secondary">
            {attendanceStatusLabel(enrollment.attendanceStatus)}
          </span>
          <span className="inline-flex rounded-full border border-p-border bg-p-surface-2 px-2 py-0.5 text-[11px] font-semibold text-p-text-secondary">
            {paymentStatusLabel(enrollment.paymentStatus)}
          </span>
          <span className="inline-flex rounded-full border border-p-border bg-p-surface-2 px-2 py-0.5 text-[11px] font-semibold text-p-text-secondary">
            {enrollmentStatusLabel(enrollment.enrollmentStatus)}
          </span>
        </div>
      </div>
      <div className="mt-2 grid gap-2 text-[12px] text-p-text-secondary md:grid-cols-3">
        <p>Actividad: {enrollment.classSession.activityType?.name || 'Sin actividad específica'}</p>
        <p>Cancha: {enrollment.classSession.court?.name || 'Sin cancha asignada'}</p>
        <p>Responsable: {enrollment.billingResponsibleClient?.name || 'Sin responsable cargado'}</p>
      </div>
    </div>
  );
}

function ClassPassCard({
  classPass,
  clientId,
}: {
  classPass: AdminAcademyStudentOverview['beneficiaryPasses'][number];
  clientId: string;
}) {
  const restrictions = [
    classPass.activityType?.name ? `Actividad: ${classPass.activityType.name}` : null,
    classPass.classType ? `Formato: ${classTypeLabel(classPass.classType)}` : null,
    classPass.teacher?.displayName ? `Profesor: ${classPass.teacher.displayName}` : null,
    classPass.expiresAt ? `Vence: ${formatDateTime(classPass.expiresAt)}` : null,
    classPass.transferable ? 'Transferible dentro del club' : null,
  ].filter(Boolean) as string[];

  const ownerLabel =
    classPass.ownerClient && classPass.ownerClient.id !== clientId ? classPass.ownerClient.name : null;

  return (
    <div className="rounded-xl border border-p-border bg-p-surface p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-p-text">{classPass.packageName}</p>
          <p className="mt-0.5 text-[12px] text-p-text-secondary">
            {classPass.remainingCredits}/{classPass.totalCredits} créditos disponibles
          </p>
        </div>
        <span className="inline-flex rounded-full border border-p-border bg-p-surface-2 px-2 py-0.5 text-[11px] font-semibold text-p-text-secondary">
          {classPassStatusLabel(classPass.status)}
        </span>
      </div>

      <div className="mt-2 grid gap-2 text-[12px] text-p-text-secondary md:grid-cols-2">
        <p>Usados: {classPass.usedCredits}</p>
        <p>Titular: {ownerLabel || 'El mismo alumno'}</p>
      </div>

      {restrictions.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {restrictions.map((item) => (
            <span
              key={item}
              className="inline-flex rounded-full border border-p-border bg-p-surface-2 px-2 py-1 text-[11px] font-medium text-p-text-secondary"
            >
              {item}
            </span>
          ))}
        </div>
      ) : null}

      {classPass.recentUsages.length ? (
        <div className="mt-3 rounded-xl border border-p-border bg-p-surface-2 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-p-text-muted">Últimos consumos</p>
          <div className="mt-2 space-y-1.5">
            {classPass.recentUsages.map((usage) => (
              <p key={usage.id} className="text-[12px] text-p-text-secondary">
                {formatDateTime(usage.usedAt)} · {creditUsageReasonLabel(usage.reason)} · {usage.creditsUsed} crédito{usage.creditsUsed === 1 ? '' : 's'}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RelationshipCard({
  title,
  rows,
  side,
}: {
  title: string;
  rows: AdminAcademyStudentOverview['incomingRelationships'];
  side: 'incoming' | 'outgoing';
}) {
  return (
    <div className="rounded-xl border border-p-border bg-p-surface p-3">
      <p className="text-[12px] font-semibold text-p-text">{title}</p>
      {rows.length ? (
        <div className="mt-3 space-y-2">
          {rows.map((row) => {
            const counterpart = side === 'incoming' ? row.fromClient?.name : row.toClient?.name;
            return (
              <div key={row.id} className="rounded-lg border border-p-border bg-p-surface-2 px-3 py-2">
                <p className="text-[12px] font-medium text-p-text">
                  {counterpart || 'Cliente sin referencia'} · {relationshipTypeLabel(row.relationshipType)}
                </p>
                <p className="mt-1 text-[11px] text-p-text-muted">
                  {[row.canPayFor ? 'Puede pagar' : null, row.canManageEnrollments ? 'Puede gestionar inscripciones' : null, row.canViewSchedule ? 'Puede ver agenda' : null]
                    .filter(Boolean)
                    .join(' · ') || 'Sin permisos adicionales cargados'}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-2 text-[12px] text-p-text-muted">No hay vínculos cargados en esta dirección.</p>
      )}
    </div>
  );
}

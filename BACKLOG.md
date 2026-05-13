# Backlog Maestro — Pique
**Última actualización:** 2026-05-13  
**Estado del repo auditado en:** `apps/backend` + `apps/frontend`  
**Auditoría:** grep real sobre el repo, no estimaciones.

---

## Resumen ejecutivo

El sistema está en producción y funciona. La infraestructura de error tipada (`AppError`) está completa en la capa financiera (Caja, Cuentas, Pagos, Devoluciones). Reservas usa parcialmente el nuevo sistema pero aún tiene un mapper de strings como puente. Auth, Cancha y algunas rutas de configuración todavía usan respuestas inline sin AppError. El frontend tiene deuda acumulada (páginas duplicadas ya redirigidas, `cuentas.tsx` pendiente de migración, agenda pendiente de Phase 3 de componentización). El feature de venta de mostrador está en fase P2 (anulación, servicios, reportes pendientes). No existe cobertura de tests unitarios por servicio — todos los tests son de integración por escenario.

---

## Estado de migración AppError (grep real al 2026-05-13)

### ✅ Completamente migrados
| Archivo | Método |
|---------|--------|
| `CashShiftService.ts` | Todos los throws → factories |
| `CashShiftController.ts` | Todos los catch → sendAppError |
| `AccountService.ts` | Todos los throws → factories |
| `AccountController.ts` | Todos los catch → sendAppError |
| `PaymentService.ts` | Todos los throws → factories |
| `PaymentController.ts` | Todos los catch → sendAppError |
| `RefundService.ts` | Todos los throws → factories |
| `CashService.ts` | throws de negocio → factories; 2 invariantes de integridad dejados como `throw new Error` intencional |
| `CashController.ts` | sendAppError + manejo especial CLIENT_POSSIBLE_DUPLICATE vía instanceof |
| `CashRegisterController.ts` | sendAppError |
| `DiscountService.ts` | 100% factories |
| `PricingService.ts` | 100% factories |

### ⚠️ Parcialmente migrados
| Archivo | Situación |
|---------|-----------|
| `BookingController.ts` | Usa `sendAppError` en todos los catch. Tiene `createBookingAppError()` como mapper puente con string matching para BOOKING_SLOT_UNAVAILABLE. Funciona pero es frágil. |
| `BookingService.ts` | Mayoría AppError factories. 4 `throw new Error` de invariantes de integridad (intencionales → caen a UNEXPECTED_ERROR). |
| `BookingDomainService.ts` | 1 `throw new Error` de invariante de integridad (intencional). |
| `ClubController.ts` | Catch blocks → sendAppError ✅. Validaciones inline usan `res.status(400).json({ error: ... })` ❌ (muchas, ~15). |
| `CourtController.ts` | `sendAppError` importado ✅. Catch blocks con `res.status(400).json(...)` en vez de sendAppError ❌ (4 catch blocks). |
| `CourtPriceRuleController.ts` | sendAppError en catch ✅. Validaciones inline con `res.status(400).json` ❌. |
| `DiscountController.ts` | sendAppError en catch ✅. Validaciones inline con `res.status(400).json` ❌. |
| `NotificationController.ts` | sendAppError en catch ✅. Inline 404 sin AppError ❌. |

### ❌ No migrados
| Archivo | Situación |
|---------|-----------|
| `AuthController.ts` | 25 llamadas inline a `res.status()` sin sendAppError. |
| `ClientRoutes.ts` | Handler inline con `getErrorMessage()` local. No usa AppError. |
| `ProductController.ts` | Inline 404/500 con `res.status().json({ error: '...' })`. |
| `WhatsappDeliveryService.ts` | 1 `throw new Error` para errores HTTP (podría ser AppError). |

### 🔒 Intencionalmente sin migrar (invariantes de integridad)
Los siguientes `throw new Error` son **correctos** tal como están — representan estados imposibles que deben caer a UNEXPECTED_ERROR 500:
- `BookingService.ts` L3049, L3483, L3945, L5499 — reserva CONFIRMED/COMPLETED sin Account
- `BookingDomainService.ts` L94 — ídem
- `CashService.ts` L119, L140 — PaymentAllocation faltante (inconsistencia financiera)
- `ClientDebtService.ts` L63 — reservas CONFIRMED sin Account
- `OutboxWorker.ts` L90, L105, L117 — tipo de outbox no soportado
- `AuthTokenService.ts` L8 — JWT_SECRET faltante (startup)
- `AuthEmailService.ts` L6 — env var faltante (startup)

---

## Backlog por categoría

### A — Errores / AppError (migración pendiente)

| ID | Título | Descripción | Estado | Riesgo | Prioridad | Archivos | Criterio de done |
|----|--------|-------------|--------|--------|-----------|----------|-----------------|
| A-1 | Eliminar `createBookingAppError` string matching | El mapper en BookingController convierte errores vía `message.includes('pasado')` y `normalizedMessage.includes('...')`. Frágil si cambia el texto. Reemplazar por: BookingService siempre lanza AppError, mapper se vuelve trivial `if (error instanceof AppError) return error`. | pending | MEDIO — BookingService ya usa factories en el 90% de los paths | ALTA | `controllers/BookingController.ts` L38-97, `services/BookingService.ts` | createBookingAppError = `if AppError return it; else return badRequest(fallback)`. Sin string matching. |
| A-2 | Migrar AuthController a AppError | 25 inline `res.status().json()`. Reemplazar validaciones con `validationError()` factory y `sendAppError` en catch blocks. | pending | BAJO — Auth no expone información sensible extra | MEDIA | `controllers/AuthController.ts` | 0 llamadas inline a res.status. Todos los catch → sendAppError. |
| A-3 | Migrar CourtController catch blocks | 4 catch blocks usan `res.status(400).json(...)` en vez de `sendAppError`. | pending | BAJO | MEDIA | `controllers/CourtController.ts` | Catch blocks → sendAppError. |
| A-4 | Migrar ClientRoutes a AppError | Handler inline con `getErrorMessage()`. No usa AppError ni sendAppError. | pending | BAJO | MEDIA | `routes/ClientRoutes.ts` | sendAppError reemplaza handler inline. |
| A-5 | Migrar ProductController a AppError | Inline 404/500 sin AppError. | pending | BAJO | BAJA | `controllers/ProductController.ts` | sendAppError + notFound factory. |
| A-6 | Validaciones inline en ClubController | ~15 `res.status(400).json()` para validaciones de configuración de club. Migrar a `validationError()` o `badRequest()`. | pending | BAJO | BAJA | `controllers/ClubController.ts` | validationError/badRequest reemplaza inline. |
| A-7 | WhatsappDeliveryService HTTP errors | 1 `throw new Error` para respuestas HTTP no-200 del wpp-service. Migrar a `badRequest` o error tipado. | pending | BAJO | BAJA | `services/WhatsappDeliveryService.ts` | AppError con código apropiado. |

---

### B — Reservas (BookingService / BookingController)

| ID | Título | Descripción | Estado | Riesgo | Prioridad | Archivos | Criterio de done |
|----|--------|-------------|--------|--------|-----------|----------|-----------------|
| B-1 | Eliminar string matching en BookingController (depende de A-1) | Ver A-1. Bloquea F-3 de la migración AppError completa. | pending | MEDIO | ALTA | `controllers/BookingController.ts` | Ver A-1. |
| B-2 | Tests de invariantes de integridad de BookingService | Las 4 líneas `throw new Error` de invariantes no tienen test. Agregar tests que verifiquen que el catch los convierte en UNEXPECTED_ERROR 500. | pending | BAJO | MEDIA | `tests/bookingAccountInvariants.test.ts` (ampliar) | Test para cada invariante. |
| B-3 | Phase 3: hook extraction en agenda-playground2 | Extraer `useAgendaSchedule`, `useAgendaDragAndDrop`, `useBookingDrawerController`. El componente tiene 12.800+ líneas, 139 useState, 47 useEffect. | pending | ALTO — riesgo de regresión UX | BAJA (no bloquea features) | `pages/admin/agenda-playground2.tsx` | 3 hooks extraídos, archivo <8000 líneas. |
| B-4 | Reservas recurrentes — auditoría de reglas de negocio | El módulo existe (`FixedBooking`, `recurring/`) pero no hay documentación de las reglas. Auditar y documentar edge cases. | pending | MEDIO | MEDIA | `services/BookingService.ts` L4400-5100 aprox | Documento de reglas. |

---

### C — Clientes

| ID | Título | Descripción | Estado | Riesgo | Prioridad | Archivos | Criterio de done |
|----|--------|-------------|--------|--------|-----------|----------|-----------------|
| C-1 | Migrar cuentas.tsx a AdminRouteShell + useActiveClub | 1015 líneas, auth-check manual, localStorage directo, 34 useState inline. Paso 1: solo el shell. | pending | MEDIO — página activa | ALTA | `pages/admin/cuentas.tsx` | Usa AdminRouteShell + useActiveClub. Sin localStorage directo. |
| C-2 | Mover cuentas.tsx como tab en Caja | Paso 2 post C-1. Crear redirect desde `/admin/cuentas` → `/admin/caja?tab=cuentas`. | pending | BAJO — requiere C-1 | MEDIA | `pages/admin/cuentas.tsx`, `pages/admin/pagos-playground.tsx` | Tab visible en Caja. Redirect activo. |
| C-3 | Extraer hooks de cuentas.tsx | `useAccounts`, `useClubProducts`, `useClubServices`. Paso 3 post C-2. | pending | BAJO | BAJA | `pages/admin/cuentas.tsx` | 3 hooks extraídos. Componente < 400 líneas. |
| C-4 | AdminTabBookings.tsx — confirmar si es dead code | Importa `useParams` de react-router-dom (incorrecto en Next.js). No aparece en ninguna página activa. Si no se usa: eliminar. | pending | BAJO | MEDIA | `components/admin/AdminTabBookings.tsx` | Archivo eliminado o corregido y conectado. |

---

### D — Caja / POS

| ID | Título | Descripción | Estado | Riesgo | Prioridad | Archivos | Criterio de done |
|----|--------|-------------|--------|--------|-----------|----------|-----------------|
| D-1 | P2-B: Anular venta mostrador (revertir stock) | En progreso. Backend: endpoint de anulación. Frontend: botón en cuenta de tipo POS. | in_progress | MEDIO | ALTA | `services/CashService.ts`, `controllers/CashController.ts`, `pages/admin/pagos-playground.tsx` | Stock revertido, cuenta cerrada/anulada, UI confirma. |
| D-2 | P2-C: Servicios en venta mostrador | Agregar ClubServiceCatalog items al drawer de venta POS. | pending | BAJO — requiere D-1 | ALTA | `services/CashService.ts`, componentes POS | Servicios aparecen en selector de productos POS. |
| D-3 | P2-D: Tab Reportes POS en Caja | Vista de ventas de mostrador del día/turno. Filtros por fecha y caja. | pending | BAJO | MEDIA | `pages/admin/pagos-playground.tsx` | Tab con tabla de ventas, total del turno. |
| D-4 | Descuentos sin ruta en backend | No existe `DiscountRoutes.ts`. DiscountController y DiscountService están implementados pero no hay router. Verificar si está registrado en ClubAdminRoutes o equivalente. | pending | ALTO si no está registrado | URGENTE | `routes/`, `src/index.ts` | Ruta registrada y funcional, o documento explicando dónde está. |
| D-5 | ProductRoutes — verificar registro | No hay `ProductRoutes.ts`. ProductController implementado. Verificar registro. | pending | ALTO si no está registrado | URGENTE | `routes/`, `src/index.ts` | Igual que D-4. |

---

### E — Inventario

| ID | Título | Descripción | Estado | Riesgo | Prioridad | Archivos | Criterio de done |
|----|--------|-------------|--------|--------|-----------|----------|-----------------|
| E-1 | Tab Inventario — estado actual | `AdminTabStatistics.tsx` existe pero no hay `AdminTabInventory`. La sección Inventario en Tienda probablemente muestra AdminComingSoonPanel. Auditar. | pending | BAJO | MEDIA | `pages/admin/tienda.tsx`, `components/admin/` | Estado documentado. Implementar si tiene prioridad. |
| E-2 | Movimientos de stock — historial | Modelo `ProductComponent` existe pero no hay endpoint/UI de historial de movimientos de stock. | pending | BAJO | BAJA | `services/ProductService.ts` | Endpoint + vista de historial. |

---

### F — Reportes / Informes

| ID | Título | Descripción | Estado | Riesgo | Prioridad | Archivos | Criterio de done |
|----|--------|-------------|--------|--------|-----------|----------|-----------------|
| F-1 | AdminTabStatistics — implementar contenido | Existe el componente pero probablemente tiene AdminComingSoonPanel o datos básicos. Auditar y definir KPIs. | pending | BAJO | MEDIA | `components/admin/AdminTabStatistics.tsx` | KPIs de negocio visibles: reservas, ingresos, ocupación. |
| F-2 | Proyecciones de lectura — estado y uso | Existen `AccountSummaryProjection`, `CashShiftSummaryProjection`, `DailyCashSummaryProjection` y `ProjectionService.ts`. Auditar si están actualizadas y si el frontend las usa. | pending | MEDIO — datos stale si no se actualizan | MEDIA | `services/ProjectionService.ts`, `services/MetricsService.ts` | Documento de estado + alertas si hay drift. |
| F-3 | Reportes de cierre de caja | UI de resumen al cerrar turno: efectivo esperado, movimientos, diferencia. | pending | BAJO | MEDIA | `services/CashShiftService.ts`, UI | Vista de cierre con todos los datos. |

---

### G — Staff / Roles

| ID | Título | Descripción | Estado | Riesgo | Prioridad | Archivos | Criterio de done |
|----|--------|-------------|--------|--------|-----------|----------|-----------------|
| G-1 | Gestión de staff desde panel admin | No existe UI para invitar/eliminar staff de un club. El modelo `Membership` existe con roles OWNER/ADMIN/STAFF. | pending | BAJO | MEDIA | `services/ClubService.ts`, nuevo componente | CRUD de memberships desde Ajustes. |
| G-2 | Auditoría de accesos por rol | `AuditLogController` + `AuditLogService` + `AuditLog` model existen. Auditar qué acciones se registran y si la UI de auditoría está completa. | pending | BAJO | BAJA | `controllers/AuditLogController.ts`, `components/admin/` | Vista de audit log funcional. |

---

### H — Seguridad / Auth

| ID | Título | Descripción | Estado | Riesgo | Prioridad | Archivos | Criterio de done |
|----|--------|-------------|--------|--------|-----------|----------|-----------------|
| H-1 | Migración auth a cookies (plan documentado) | `auth-session-redesign-plan.md` documenta migración de JWT → cookies. No implementado. CLAUDE.md lo menciona como pendiente. | pending | ALTO — cambio de contrato auth | BAJA (no urgente) | `controllers/AuthController.ts`, `utils/session.ts` | Cookies HttpOnly. Sin JWT en localStorage. |
| H-2 | AuthController — 25 inline res.status sin código tipado | Ver A-2. Además del AppError, las respuestas de error de auth no tienen error codes — el frontend no puede distinguir entre credenciales inválidas, cuenta bloqueada, etc. | pending | MEDIO | MEDIA | `controllers/AuthController.ts` | Cada respuesta de error auth tiene code tipado. |
| H-3 | Rate limiting en auth | No hay evidencia de rate limiting en endpoints de auth (login, magic-link). | pending | ALTO en prod | MEDIA | `routes/AuthRoutes.ts` | Rate limiting con express-rate-limit o equivalente. |

---

### I — Integraciones externas

| ID | Título | Descripción | Estado | Riesgo | Prioridad | Archivos | Criterio de done |
|----|--------|-------------|--------|--------|-----------|----------|-----------------|
| I-1 | wpp-service — estado y resiliencia | `WhatsappDeliveryService.ts` + `OutboxWorker.ts` + `wpp-service/`. Si el wpp-service está caído, ¿se reintenta el outbox? Auditar política de reintentos. | pending | MEDIO | MEDIA | `services/OutboxWorker.ts`, `services/WhatsappService.ts` | Política de reintentos documentada y testeada. |
| I-2 | Notificaciones — canales activos | `NotificationController` + `NotificationService` existen. Auditar qué tipos de notificaciones se envían, por qué canal (WhatsApp/email/push) y si hay backpressure. | pending | BAJO | BAJA | `services/NotificationService.ts` | Documento de canales activos. |

---

### J — Rebranding (TuCancha → Pique)

| ID | Título | Descripción | Estado | Riesgo | Prioridad | Archivos | Criterio de done |
|----|--------|-------------|--------|--------|-----------|----------|-----------------|
| J-1 | Auditar menciones de "TuCancha" en código | Grep de "TuCancha", "tucancha", "tu-cancha" en todo el repo. Categorizar: strings de UI, variables, comentarios, configs. | pending | BAJO | MEDIA | todo el repo | Lista completa de ocurrencias. Plan de reemplazo. |
| J-2 | Renombrar dominio en configs | URLs hardcodeadas, variables de entorno, README. No tocar hasta tener dominio definitivo. | pending | BAJO — depende de decisión de negocio | BAJA | `.env`, `README.md`, configs | Configs apuntan a dominio Pique. |
| J-3 | Actualizar nombre en UI | `<title>`, logos, textos de marketing. | pending | BAJO | BAJA | `apps/frontend/` | Sin menciones de TuCancha en UI visible. |

---

### K — Tests

| ID | Título | Descripción | Estado | Riesgo | Prioridad | Archivos | Criterio de done |
|----|--------|-------------|--------|--------|-----------|----------|-----------------|
| K-1 | Tests de AppError para BookingService (dominio) | Equivalente a `appError.financial.test.ts` pero para errores de reservas: BOOKING_OVERLAP, CLIENT_POSSIBLE_DUPLICATE, BOOKING_SLOT_UNAVAILABLE, ACTIVITY_OUT_OF_CLUB, CLUB_CONFIG_INVALID. | pending | BAJO | ALTA | `tests/appError.booking.test.ts` | Archivo existe con ≥15 tests. |
| K-2 | Tests de AppError para Auth | FORBIDDEN, AUTH_MISSING, AUTH_INVALID, AUTH_EXPIRED. | pending | BAJO | MEDIA | `tests/appError.auth.test.ts` | Archivo con ≥5 tests. |
| K-3 | Test de integración: Prisma binary en CI | Los tests DB-dependientes fallan en el sandbox Linux por binary mismatch (darwin-arm64 vs linux-arm64). Configurar CI con binary correcto. | pending | ALTO en CI | ALTA | `package.json`, `.github/workflows/` | Tests pasan en CI. |
| K-4 | Tests de BookingService — cobertura crítica | `bookingAccountInvariants.test.ts` existe. Auditar gaps: ¿se testea el flujo completo de confirmación con cuenta? ¿Superposición de reservas? | pending | MEDIO | MEDIA | `tests/` | Los 5 flujos críticos de reserva tienen test. |

---

### L — Documentación

| ID | Título | Descripción | Estado | Riesgo | Prioridad | Archivos | Criterio de done |
|----|--------|-------------|--------|--------|-----------|----------|-----------------|
| L-1 | Actualizar CLAUDE.md con estado post-F2 | CLAUDE.md refleja estado hasta antes de la migración financiera AppError. Actualizar sección "Admin Migration State" con el estado real de errores. | pending | BAJO | ALTA | `CLAUDE.md` | CLAUDE.md tiene sección AppError actualizada. |
| L-2 | Documentar contrato de error del backend | Cada endpoint documentado con sus posibles error codes. Útil para el frontend y para nuevos devs. | pending | BAJO | MEDIA | nuevo `docs/error-codes.md` | Documento completo de ErrorCodes por endpoint. |
| L-3 | Documentar Outbox y proyecciones | `OutboxWorker`, `ProjectionService`, `PendingBookingAutoCancelService` — procesos background sin documentación. | pending | BAJO | BAJA | `docs/background-jobs.md` | Documento de procesos background. |

---

### M — Limpieza técnica (frontend)

| ID | Título | Descripción | Estado | Riesgo | Prioridad | Archivos | Criterio de done |
|----|--------|-------------|--------|--------|-----------|----------|-----------------|
| M-1 | Eliminar páginas duplicadas — redireccionadas ✅ | Ya hecho. | done | — | — | — | — |
| M-2 | Eliminar AdminLayout.tsx + AdminSidebar.tsx + DashboardLayout.tsx + Sidebar.tsx | Solo usadas por metrics.tsx (dev tool). Migrar metrics.tsx a layout minimal y borrar. | pending | BAJO | MEDIA | `components/admin/AdminLayout.tsx`, etc. | 4 archivos eliminados. metrics.tsx usa AdminRouteShell. |
| M-3 | Eliminar playgrounds abandonados ✅ | Ya hecho. | done | — | — | — | — |
| M-4 | `utils/apiError.ts` en frontend — auditar | Existe `apps/frontend/utils/apiError.ts`. ¿Está sincronizado con los error codes del backend? ¿Se usa en algún lugar aún? | pending | BAJO | MEDIA | `utils/apiError.ts` | Auditado y limpio o eliminado. |
| M-5 | `bookingErrorMap.ts` — sincronizar con ErrorCodes | Frontend mapea strings de error a mensajes. Verificar que todos los ErrorCodes del backend tengan mapeo. | pending | BAJO | MEDIA | `utils/bookingErrorMap.ts` | Todos los ErrorCodes críticos tienen mapeo en frontend. |

---

### N — Limpieza técnica (backend)

| ID | Título | Descripción | Estado | Riesgo | Prioridad | Archivos | Criterio de done |
|----|--------|-------------|--------|--------|-----------|----------|-----------------|
| N-1 | `utils/apiError.ts` en backend — eliminar | Solo 0 archivos importan este módulo (ya limpiado en F-1/F-2). Verificar que realmente no hay ninguna importación y eliminar el archivo. | pending | BAJO | MEDIA | `utils/apiError.ts` | Archivo eliminado. 0 importaciones. |
| N-2 | Deduplicar `getErrorMessage` helpers | Existen en `controllers/BookingController.ts` L15, `routes/ClientRoutes.ts` L9, posiblemente otros. Centralizar en utils o eliminar. | pending | BAJO | BAJA | varios | 1 sola fuente de verdad. |
| N-3 | Eliminar `sendControllerAppError` redundante | `BookingController.ts` define `sendControllerAppError` (L33) que es un wrapper fino de `sendAppError`. No agrega valor. | pending | BAJO | BAJA | `controllers/BookingController.ts` L33 | Eliminado. Usos reemplazados por sendAppError directamente. |
| N-4 | Auditar DiscountRoutes / ProductRoutes faltantes | No existe `DiscountRoutes.ts` ni `ProductRoutes.ts`. Verificar si están registradas en `ClubAdminRoutes.ts` o directamente en `index.ts`. Crítico si no están registradas. | pending | **CRÍTICO si no están registradas** | **URGENTE** | `src/index.ts`, `routes/ClubAdminRoutes.ts` | Rutas confirmadas y funcionando. |
| N-5 | Revisar UserClientLinkAudit.ts — uso | Archivo de servicio existe pero no hay route ni controller evidente. Auditar si está siendo usado. | pending | BAJO | BAJA | `services/UserClientLinkAudit.ts` | Uso confirmado o archivo eliminado. |

---

### O — Infraestructura / Ops

| ID | Título | Descripción | Estado | Riesgo | Prioridad | Archivos | Criterio de done |
|----|--------|-------------|--------|--------|-----------|----------|-----------------|
| O-1 | Redis — estado en prod | `RedisService.ts` existe. ¿Se usa para caché, sessions, rate limiting? Auditar y documentar. | pending | MEDIO | MEDIA | `services/RedisService.ts` | Documento de uso de Redis. |
| O-2 | `PROCESS_ROLE` — separación de procesos | Backend puede correr como `api`, `worker`, o `scheduler`. Documentar qué proceso corre cada servicio background. | pending | BAJO | BAJA | `src/index.ts` | Documento de roles de proceso. |
| O-3 | Particionado de DB | Script `db:ensure-partitions` existe. ¿Qué tablas están particionadas? ¿Se ejecuta en prod regularmente? | pending | ALTO si falla en prod | MEDIA | `scripts/ensureFuturePartitions.ts` | Documentado + cron job confirmado. |
| O-4 | Smoke release script | `smoke:release` existe. Verificar que cubra los endpoints críticos. | pending | MEDIO | MEDIA | `scripts/smokeRelease.ts` | Script cubre: health, auth, booking, cash, payment. |

---

## Top 20 — Prioridad absoluta

| Rank | ID | Título | Por qué ahora |
|------|----|--------|---------------|
| 1 | N-4 | Auditar DiscountRoutes / ProductRoutes faltantes | Si no están registradas, funcionalidades de negocio están rotas silenciosamente |
| 2 | D-4 | Descuentos sin ruta | Ídem N-4 |
| 3 | D-5 | ProductRoutes verificar | Ídem N-4 |
| 4 | D-1 | P2-B: Anular venta mostrador | En progreso, bloquea P2-C y P2-D |
| 5 | A-1 | Eliminar string matching BookingController | Fragil, se rompe si cambia el texto en BookingService |
| 6 | K-3 | Tests en CI — Prisma binary | Tests no corren en CI → riesgo de regressions no detectadas |
| 7 | L-1 | Actualizar CLAUDE.md | Contexto desactualizado hace más lenta la iteración |
| 8 | K-1 | Tests AppError booking | Falta cobertura del dominio más crítico |
| 9 | C-1 | cuentas.tsx → AdminRouteShell | Deuda técnica activa en página de producción |
| 10 | D-2 | P2-C: Servicios en POS | Feature solicitado, depende de D-1 |
| 11 | H-3 | Rate limiting en auth | Riesgo de seguridad en prod |
| 12 | A-2 | AuthController → sendAppError | Frontend no puede distinguir tipos de error de auth |
| 13 | D-3 | P2-D: Tab Reportes POS | Completa el ciclo de caja |
| 14 | C-4 | AdminTabBookings — dead code | Limpieza de ambigüedad |
| 15 | M-2 | Eliminar AdminLayout + 3 archivos | Deuda de layout viejo |
| 16 | A-3 | CourtController catch blocks | Inconsistencia menor pero acumulada |
| 17 | A-4 | ClientRoutes → AppError | Consistencia del sistema de errores |
| 18 | F-2 | Proyecciones — auditar estado | Riesgo de datos stale en informes |
| 19 | O-3 | Particionado DB | Riesgo operacional si cron falla |
| 20 | C-2 | cuentas.tsx → tab en Caja | Reduce duplicación de rutas |

---

## Bloqueadores para piloto comercial

Los siguientes ítems deben estar resueltos antes de abrir el sistema a nuevos clubs de pago:

1. **N-4 / D-4 / D-5** — Rutas de Descuentos y Productos confirmadas y funcionando
2. **H-3** — Rate limiting en auth (no negociable en prod)
3. **K-3** — CI con tests pasando (Prisma binary)
4. **D-1** — Anulación de venta mostrador (operación activa ya en uso)

---

## Bloqueadores para venta abierta (self-signup de clubs)

Además de los bloqueadores de piloto:

1. **H-1** — Migración auth a cookies (JWT en localStorage no es aceptable en prod pública)
2. **G-1** — Gestión de staff desde panel (club no puede auto-administrarse sin esto)
3. **J-1/J-2/J-3** — Rebranding completo
4. **L-2** — Documentación de error codes (necesario para integraciones)

---

## Fases de ejecución sugeridas

| Fase | Nombre | IDs | Objetivo |
|------|--------|-----|----------|
| **A** | Auditoría crítica | N-4, D-4, D-5, C-4 | Confirmar que nada está roto silenciosamente |
| **B** | Feature POS completo | D-1, D-2, D-3 | Cerrar el ciclo de caja/mostrador |
| **C** | AppError completar | A-1, A-2, A-3, A-4, A-5, A-6 | Terminar migración iniciada en F-1/F-2/F-3 |
| **D** | Tests y CI | K-1, K-2, K-3, K-4 | Base de confianza para cambios futuros |
| **E** | Cuentas migración | C-1, C-2, C-3 | Deuda técnica activa en página de producción |
| **F** | Seguridad básica | H-3, H-2 | Listo para más usuarios |
| **G** | Limpieza técnica | M-2, M-4, M-5, N-1, N-2, N-3 | Repo limpio |
| **H** | Informes y reportes | F-1, F-2, F-3, D-3 | Visibilidad de negocio |
| **I** | Staff y roles | G-1, G-2 | Self-administration de clubs |
| **J** | Rebranding + docs | J-1, J-2, J-3, L-1, L-2, L-3 | Listo para venta abierta |

---

## Pendientes descubiertos por grep (no clasificados aún)

```
# throw new Error legítimos que podrían migrar a AppError en el futuro:
services/WhatsappDeliveryService.ts:41 — HTTP error al llamar wpp-service

# Validaciones inline que exponen mensajes sin código:
controllers/ClubController.ts:198-271 — ~15 res.status(400).json sin error code
controllers/CourtController.ts:115, 160, 192 — catch → res.status(400) sin sendAppError
routes/ClientRoutes.ts:33, 35 — getErrorMessage() inline

# Funciones de mapeo duplicadas:
controllers/BookingController.ts:15 — getErrorMessage local
routes/ClientRoutes.ts:9 — getErrorMessage local (misma firma, duplicado)

# Archivos sin tests unitarios (todos los servicios — 37 archivos):
AccountItemService, AccountService, AccountingService, ActivityTypeAdminService,
AuditLogService, AuthEmailService, AuthSessionService, AuthTokenService,
BookingDomainService, BookingService, CashRegisterService, CashService,
CashShiftService, ClientDebtService, ClientDuplicateIncidentService,
ClubFavoriteService, ClubReviewService, ClubService, ClubServiceCatalogService,
DiscountService, EventService, LocationService, MediaStorageService,
MetricsService, NotificationService, OutboxService, OutboxWorker,
PaymentService, PendingBookingAutoCancelService, PricingService, ProductService,
ProjectionService, RedisService, RefundService, UserClientLinkAudit,
WhatsappDeliveryService, WhatsappService

# Rutas no encontradas como archivos separados:
DiscountRoutes.ts — NO EXISTE (CRÍTICO: verificar registro en index.ts)
ProductRoutes.ts — NO EXISTE (CRÍTICO: verificar registro en index.ts)
```

---

*Backlog generado por auditoría automatizada del repo. No se modificó código. Revisar antes de ejecutar cualquier ítem.*

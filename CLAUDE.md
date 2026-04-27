# Sistema de Gestión de Turnos — Project Guide

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js (Pages Router) + TypeScript + Tailwind CSS |
| Backend | Express + TypeScript + Prisma ORM |
| DB | PostgreSQL (prod) / SQLite (dev) |
| Auth | JWT + Bcrypt |
| Monorepo | `apps/frontend` · `apps/backend` · `apps/wpp-service` |

---

## Project Structure

```
apps/
  frontend/
    pages/admin/          # Admin panel pages (one page = one feature)
    components/admin/     # Shared admin components
    utils/apiClient.ts    # Authenticated fetch wrapper (always use this)
    services/             # Frontend service layer (API calls)
  backend/
    src/
      modules/            # Feature modules (account/, booking/, cash/, payment/, …)
      services/           # Domain services
      controllers/        # Express route handlers
      repositories/       # DB access via Prisma
      routes/             # Express routers
```

---

## Admin Panel — Key Concepts

### Playground Pages vs Stable Pages
Pages with `-playground` suffix are in-progress rewrites. They coexist with the stable versions.
- Stable: `agenda.tsx`, `clientes.tsx`, `caja.tsx`
- Active rewrites: `agenda-playground2.tsx`, `clientes-playground2.tsx`, `pagos-playground.tsx`

When working on features, **always check which page is active** in `playgroundNavigation.ts`.

### Navigation
`apps/frontend/components/admin/playgroundNavigation.ts` — single source of truth for sidebar routes.
Current active routes: Calendario, Clientes, Caja, Tienda, Informes, Ajustes.

### Shell Components
- `AdminRouteShell` — wraps stable pages
- `AdminPlaygroundShell` — wraps playground pages (includes sidebar from `playgroundNavigation.ts`)
- `AgendaLikeRightSidebar` — slide-in right panel used for detail/actions within a page

---

## Payment Modal Pattern

All payment registration modals follow the same 3-step flow:
```
'form' → 'preconfirm' → 'result'
```

State controlled by: `*PaymentModalStep: null | 'form' | 'preconfirm' | 'result'`

### Quick Presets
```ts
type PaymentQuickPreset = 'FULL' | 'COURT_ONLY' | 'CUSTOM_ITEMS';
```
- `FULL` — Todo pendiente (total remaining)
- `COURT_ONLY` — Solo cancha (BOOKING items only)
- `CUSTOM_ITEMS` — Personalizado (per-item checkbox + custom amount input)

### Shared Modal Components
Located in `apps/frontend/components/admin/payments/`:
- `AdminPaymentFormModal` — form step shell (method, channel, concepts, amount)
- `AdminPaymentPreconfirmModal` — summary before submit
- Result step rendered inline

### Rules
- Amount must not exceed `maxAllowedAmount` (min of account remaining and concept-based total)
- Transfer method requires `channel` selection (BANK_ACCOUNT | VIRTUAL_WALLET)
- `appliedItems` — array of `{id, label, amount}` — built from `previewRows` at submit time, passed to result modal

---

## API Client

Always use `apiClient.ts` for authenticated requests. It handles:
- JWT injection
- 401 token refresh
- Club context header (`getActiveClubId()`, `getActiveClubSlug()`)
- Error parsing → throws with `.message`

Pattern:
```ts
import { apiClient } from '../utils/apiClient';
const data = await apiClient.get('/api/some-endpoint');
```

---

## Common Patterns

### Error handling in callbacks
```ts
try {
  setSubmitting(true);
  setError('');
  await someApiCall();
  showAdminToast('Acción completada.');
} catch (error) {
  reportUiError({ area: 'ComponentName', action: 'actionName' }, error);
  setError(extractErrorMessage(error, 'Mensaje de fallback.'));
} finally {
  setSubmitting(false);
}
```

### Toast notifications
```ts
showAdminToast('Mensaje breve.');  // auto-dismiss ~2.4s, max 4 queued
```

### Money formatting
```ts
formatMoney(amount)  // e.g. "$ 1.500,00"
```

### Derived state order in components
Declare `useCallback`/`useMemo` that depend on other derived values **after** those values are declared. TypeScript enforces TDZ for `const` even inside callbacks.

---

## TypeScript Check

```bash
npx tsc --noEmit -p apps/frontend/tsconfig.json
npx tsc --noEmit -p apps/backend/tsconfig.json
```

Known pre-existing errors (do not fix unless explicitly tasked):
- `index.tsx` / `index-playground.tsx` — `IoFootballOutline`/`IoTennisballOutline` JSX type error
- `tailwind.config.ts` — isolatedModules warning

---

## Dev Commands

```bash
# Frontend
cd apps/frontend && npm run dev        # http://localhost:3000

# Backend
cd apps/backend && npm run dev         # http://localhost:4000

# DB migration
cd apps/backend && npx prisma migrate dev --name <name>

# DB seed
cd apps/backend && npx prisma db seed
```

---

## Backend Domain Modules

| Module | Responsibility |
|--------|---------------|
| `account/` | Cuentas (open/close/items/payments) |
| `booking/` | Reservas de canchas |
| `cash/` | Caja (turnos, movimientos, cierre) |
| `payment/` | Pagos y devoluciones |
| `client/` | Gestión de clientes |
| `recurring/` | Reservas recurrentes |
| `integration/` | Integraciones externas |

---

## Conventions

- State setters: `set<FeatureName><StateDescription>` (e.g. `setAccountPaymentAmountDraft`)
- Pending items derived via `useMemo` from account detail — never stored in raw state
- Club-scoped: all API calls include active club context automatically via `apiClient`
- Playground pages are large single-file components by design — do not split unless explicitly asked

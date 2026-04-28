# Benchmarks Admin V2

Este directorio queda listo para guardar capturas de referencia visual del admin.

La idea es pegar PNGs concretos por patron, no fotos sueltas. Cada captura deberia ayudar a resolver una decision de UI para Calendario, Caja, Cuentas, Clientes, Reservas, Tienda, Informes, Ajustes, Modales, Sidebar o Mobile.

## Estructura sugerida

- `agenda/` - agenda, calendario, detalle de reserva, mobile.
- `caja/` - pagos, movimientos, dashboard financiero, detalle.
- `cuentas/` - cuentas abiertas, comandas, detalle de cuenta.
- `clientes/` - CRM simple, perfil, split view, historial.
- `reservas/` - tablas, filtros, detalle lateral.
- `tienda/` - productos, servicios, inventario, drawer de edicion.
- `informes/` - KPIs, metricas, dashboards.
- `ajustes/` - settings, secciones, formularios, seguridad.
- `modales/` - confirmaciones, resultados, flujos cortos y sheets.
- `sidebar/` - navegacion general y layout admin.
- `mobile/` - patrones mobile transversales.

## Regla de uso

1. Pega el PNG dentro de la carpeta que corresponda.
2. Usa un nombre descriptivo y estable.
3. Completa una nota corta en `notes.md` al lado.
4. Si una captura no ayuda a decidir una pantalla de TuCancha, no la guardes.

## Convencion de nombres

Usa nombres como estos:

- `agenda-google-calendar-day-desktop.png`
- `agenda-google-calendar-mobile-list.png`
- `caja-stripe-payments-dashboard.png`
- `caja-stripe-transaction-detail.png`
- `cuentas-pos-open-tabs.png`
- `clientes-stripe-customer-profile.png`
- `reservas-supabase-table-filters.png`
- `tienda-shopify-products-table.png`
- `informes-vercel-kpis.png`
- `ajustes-stripe-settings-sections.png`
- `modales-confirm-delete-sheet.png`
- `sidebar-linear-navigation.png`
- `mobile-calendar-schedule.png`

## Como usar las notas

En cada archivo `notes.md`, deja este formato:

```txt
Referencia: nombre de la captura

Patrones utiles:
- lista breve de 3 a 5 observaciones.

Aplicacion en TuCancha:
- como lo usariamos en el producto.

Qué no copiar:
- marca.
- colores exactos.
- contenido irrelevante.
```

## Checklist minimo

- 5 capturas de agenda.
- 5 capturas de caja/pagos.
- 4 capturas de cuentas/comandas.
- 5 capturas de clientes/CRM.
- 4 capturas de reservas/tablas.
- 3 capturas de tienda/productos.
- 4 capturas de informes/KPIs.
- 4 capturas de ajustes.
- 4 capturas de modales.
- 5 capturas mobile.

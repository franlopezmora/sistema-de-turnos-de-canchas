# Pilot Readiness

## 1. Decision Sobre Staging

- El staging persistente con host/dominio propio queda diferido por ahora.
- El staging temporal por tunel queda habilitado solo para validacion interna.
- No usar tuneles para clubes reales ni para operacion piloto.
- La validacion interna ya cubierta con tunel alcanza para esta etapa previa al primer piloto.

## 2. Riesgo Aceptado

Al no montar staging persistente en esta etapa:

- hay menos margen para probar deploys sin tocar produccion;
- hay menos estabilidad para repetir smokes largos sobre una URL fija;
- la validacion previa al piloto depende mas de disciplina operativa que de infraestructura separada.

Compensacion acordada:

- backups antes de invitar al club;
- smoke interno obligatorio en el entorno productivo controlado antes de abrir acceso;
- rollback claro y probado;
- piloto chico, controlado y con soporte manual cercano.

## 3. Checklist Pre-Produccion Controlada

| Check | Obligatorio | Estado |
|---|---:|---|
| DB nueva limpia | si | pendiente |
| `migrate deploy` | si | pendiente |
| backup configurado | si | pendiente |
| dominio real frontend/backend | si | pendiente |
| envs productivas completas | si | pendiente |
| login admin | si | pendiente |
| agenda/reservas | si | pendiente |
| POS/caja | si, si entra | pendiente |
| Mercado Pago | opcional | pendiente |
| WhatsApp | opcional / recomendado OFF si no esta maduro | pendiente |
| rollback | si | pendiente |

## 4. Smoke Obligatorio Antes De Invitar Club

- login admin;
- crear cliente;
- crear reserva;
- confirmar reserva;
- cancelar reserva;
- abrir caja;
- venta POS;
- pago POS;
- reporte basico;
- login jugador;
- Mis reservas;
- checkout summary;
- Mercado Pago solo si se activa para ese club.

## 5. Plan De Contingencia

| Problema | Accion |
|---|---|
| deploy falla | rollback al release anterior |
| DB falla | restaurar backup |
| MP falla | desactivar Mercado Pago y cobrar manualmente |
| WhatsApp falla | desactivar WhatsApp |
| POS falla | registrar manualmente la operacion y seguir operando |
| login falla | revisar cookies, CORS y envs |

## 6. Backlog Futuro

- staging persistente con dominio propio;
- CI/CD completo;
- backups automatizados y restore probado;
- monitoreo y logs centralizados;
- alertas;
- ambiente demo permanente;
- pagos por participante;
- refunds automaticos;
- Open Match;
- marketplace;
- billing SaaS;
- profesores y liquidaciones;
- proveedores y cuentas por pagar.

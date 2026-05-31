# Modulo de Facturacion Electronica ARCA

## Estado del documento

- Proyecto: `Pique`
- Dominio: facturacion electronica ARCA/AFIP para clubes deportivos
- Stack actual: `Node.js`, `Express`, `Prisma`, `PostgreSQL`, `Redis`
- Arquitectura base del repo: multi-tenant por `Club`, cuentas por `Account`, reserva por `Booking`, procesamiento async por `OutboxMessage`/worker
- Ultima revision funcional: `2026-05-31`

## 1. Objetivo

Implementar un modulo de facturacion electronica para ARCA que permita a cada club emitir comprobantes fiscales validos desde Pique sin bloquear el flujo operativo del punto de venta ni comprometer el aislamiento multi-tenant.

El modulo debe cubrir:

- Facturas electronicas para operaciones B2C y B2B.
- Notas de credito asociadas a comprobantes originales.
- Emision para alquiler de canchas, cantina y tickets mixtos.
- Generacion de QR reglamentario para ticket/PDF.
- Trazabilidad completa del ciclo de emision.
- Reintentos tecnicos sin duplicar comprobantes.

## 2. Alcance funcional

### Incluido en esta etapa

- Integracion con `WSAA` para autenticacion.
- Integracion con `WSFEv1` para solicitud de `CAE`.
- Emision de comprobantes clases `A`, `B`, `C` y eventual soporte para `M` si la condicion fiscal del emisor lo requiere.
- Soporte de conceptos:
  - `1 = Productos`
  - `2 = Servicios`
  - `3 = Productos y Servicios`
- Facturacion desde ventas originadas en:
  - `Booking`
  - `Account`
  - `AccountItem`
  - ventas manuales de mostrador
- Emision asincrona mediante outbox/worker.
- Cache de `Token` y `Sign` por tenant.
- Registro persistente de payloads, respuesta y errores.

### Fuera de alcance inicial

- `wsmtxca` con detalle de items a nivel fiscal.
- Factura de exportacion `E`.
- Factura de credito electronica MiPyME `FCE`.
- Libros IVA, percepciones, retenciones o liquidaciones contables avanzadas.
- Conciliacion bancaria automatica.

## 3. Contexto de negocio

Pique es un SaaS multi-tenant para clubes deportivos. Cada club:

- tiene su propia razon social, CUIT y condicion fiscal,
- administra uno o mas puntos de venta,
- emite comprobantes con certificados propios,
- puede vender servicios, productos o ambos en una misma cuenta.

Casos tipicos:

1. Reserva de cancha facturada como servicio.
2. Venta de bebidas o alquiler de paletas facturada como producto.
3. Cuenta unificada de cancha + cantina facturada como productos y servicios.
4. Cancelacion o reintegro parcial resuelto con nota de credito.

## 4. Requisitos regulatorios y operativos

### Requisitos regulatorios a respetar

- El modulo debe reutilizar el `Ticket de Acceso` del `WSAA` mientras siga vigente.
- El modulo debe garantizar correlatividad numerica por `CUIT emisor + punto de venta + tipo de comprobante`.
- Para concepto `2` o `3` deben enviarse los datos de servicio exigidos por ARCA cuando correspondan.
- La representacion grafica final del comprobante debe incorporar el QR reglamentario.
- El sistema debe distinguir entre rechazo tecnico, rechazo funcional y aprobacion con observaciones.

### Requisitos operativos internos

- El cajero no debe esperar a ARCA para cerrar una venta local.
- Debe existir una vista administrativa para detectar facturas pendientes, rechazadas y reintentables.
- El sistema no debe emitir duplicados aunque haya reintentos, timeouts o reinicios del worker.
- El vencimiento de certificados debe monitorearse de forma proactiva.

## 5. Arquitectura de alto nivel

## Flujo general

1. La operacion comercial se registra localmente en Pique.
2. Se genera una intencion de facturacion en base de datos.
3. Se publica un evento en `OutboxMessage`.
4. Un worker toma el evento y resuelve autenticacion WSAA.
5. El worker calcula el siguiente numero de comprobante de forma segura.
6. El worker arma el payload y llama a `WSFEv1`.
7. La respuesta se persiste en el modulo fiscal.
8. Si el comprobante fue aprobado, queda disponible para ticket/PDF y auditoria.

## Componentes

- `ConfiguracionFiscal` por club.
- `Factura` o `FiscalVoucher` como entidad principal del comprobante.
- `FacturaIntent` o estado interno de emision.
- `ArcaAuthCache` para token/sign vigentes.
- `ArcaService` para WSAA + WSFEv1.
- `ArcaWorker` para proceso asincrono.
- `ArcaQrService` para QR reglamentario.
- `ArcaAdminView` para monitoreo y reproceso.

## Integracion con componentes existentes del repo

- `Club`: tenant emisor.
- `Booking`: origen de facturacion de alquileres.
- `Account`: cuenta comercial consolidada.
- `AccountItem`: detalle operativo del consumo interno.
- `Payment`: cobros locales, independientes del estado de autorizacion fiscal.
- `OutboxService` y `OutboxWorker`: mecanismo recomendado para disparar la emision asincrona.
- `RedisService`: cache recomendado para `Token`/`Sign`, locks de correlatividad e idempotencia distribuida.

## 6. Modelo multi-tenant

La frontera de tenancy es `Club`.

Cada club debe tener:

- su `CUIT`,
- su condicion frente al IVA,
- sus certificados,
- su configuracion fiscal,
- su o sus puntos de venta habilitados,
- su cache de autenticacion aislado,
- su numeracion propia por tipo de comprobante.

Nunca se deben compartir entre clubes:

- certificados,
- claves privadas,
- tokens WSAA,
- numeracion interna,
- logs sensibles.

## 7. Autenticacion con WSAA

## Objetivo

Obtener y reutilizar `Token` y `Sign` para el servicio `wsfe`.

## Reglas

- El cache debe estar particionado por `clubId` y por `serviceName`.
- El ticket debe renovarse antes del vencimiento, con margen de seguridad.
- Se recomienda renovar si restan menos de `15` a `30` minutos de vigencia.
- Si Redis no esta disponible, se debe poder usar base de datos como fallback.

## Estrategia recomendada

- Cache primario en `Redis`.
- Persistencia opcional en tabla para auditoria y fallback.
- Lock por `clubId + wsfe` al refrescar el ticket para evitar tormenta de requests.

## Claves sugeridas en Redis

```text
arca:wsaa:club:{clubId}:service:wsfe
arca:wsaa:club:{clubId}:service:wsfe:refresh-lock
```

## Contenido sugerido del cache

```json
{
  "token": "....",
  "sign": "....",
  "generationTime": "2026-05-31T10:00:00.000Z",
  "expirationTime": "2026-05-31T22:00:00.000Z",
  "source": "redis"
}
```

## 8. Credenciales y seguridad

## Almacenamiento de secretos

Los certificados y claves privadas no deben depender de archivos locales del servidor.

Se recomienda almacenar:

- certificado en formato PEM,
- clave privada en formato PEM,
- passphrase si existiera,
- metadata de vigencia y version.

## Recomendaciones de seguridad

- Encriptar en reposo los campos sensibles.
- Desencriptar solo en memoria durante la llamada al WS.
- Nunca loguear el contenido completo de la clave privada.
- Enmascarar `Token`, `Sign`, `CAE` y payloads sensibles en logs de aplicacion.
- Limitar acceso administrativo a configuracion fiscal.
- Auditar cambios de certificados, CUIT, puntos de venta y condicion fiscal.

## Monitoreo de certificados

Agregar alertas:

- `90` dias antes del vencimiento,
- `30` dias antes,
- `7` dias antes,
- bloqueo preventivo o banner critico si esta vencido.

## 9. Tipos de comprobantes soportados

El tipo de comprobante final depende de:

- condicion fiscal del emisor,
- condicion fiscal del receptor,
- naturaleza de la operacion,
- punto de venta habilitado.

Version inicial recomendada:

- Factura `A`
- Factura `B`
- Factura `C`
- Nota de Credito `A`
- Nota de Credito `B`
- Nota de Credito `C`

Soporte opcional futuro:

- Factura `M`
- Nota de Debito
- CAEA

## 10. Conceptos ARCA

### Concepto 1 - Productos

Usar para:

- bebidas,
- snacks,
- paletas,
- pelotas,
- otros items de cantina o mostrador.

### Concepto 2 - Servicios

Usar para:

- alquiler de canchas,
- clases,
- servicios deportivos puros.

Campos obligatorios funcionales:

- `FchServDesde`
- `FchServHasta`
- `FchVtoPago`

### Concepto 3 - Productos y Servicios

Usar cuando una misma cuenta incluye:

- items de cancha o clases,
- y ademas productos.

## 11. Flujos de negocio soportados

### 11.1 Facturacion de booking

1. Se confirma o cobra una reserva.
2. Se identifica la `Account` asociada a la reserva.
3. Se construye el comprobante en base al monto fiscalizable.
4. Se emite como `servicio` o `mixto`.

### 11.2 Facturacion de cantina o mostrador

1. Se crea una `Account` de tipo `BAR` o `MANUAL`.
2. Se registran `AccountItem` de producto.
3. Se emite comprobante de `productos`.

### 11.3 Facturacion de cuenta consolidada

1. Una `Account` contiene items de `BOOKING`, `PRODUCT` y/o `SERVICE`.
2. El builder determina concepto `3`.
3. Se calculan subtotales, IVA y total fiscal.

### 11.4 Nota de credito

Usar para:

- devolucion por lluvia,
- cancelacion posterior,
- error de caja,
- ajuste parcial o total.

Debe:

- referenciar el comprobante original,
- respetar la clase del comprobante,
- guardar motivo interno y usuario responsable.

## 12. Ejecucion asincrona

## Motivo

No acoplar la experiencia del cajero a la disponibilidad de ARCA.

## Patron recomendado

Usar `OutboxMessage` existente en el sistema.

### Tipo sugerido de evento

```text
ARCA_INVOICE_REQUESTED
ARCA_CREDIT_NOTE_REQUESTED
```

### Payload sugerido del outbox

```json
{
  "clubId": 12,
  "fiscalVoucherId": "cuid",
  "originType": "ACCOUNT",
  "originId": "acc_123",
  "attempt": 1
}
```

## Reglas del worker

- Procesamiento idempotente.
- Reintentos con backoff para errores tecnicos.
- Sin reintentos automaticos ciegos ante rechazos funcionales.
- Lock distribuido por `clubId + ptoVta + cbteTipo`.
- Registro del resultado de cada intento.

## 13. Correlatividad e idempotencia

Este es uno de los puntos mas criticos del modulo.

## Riesgo

Si dos workers emiten al mismo tiempo para el mismo club, punto de venta y tipo de comprobante, ambos pueden intentar usar el mismo numero.

## Reglas obligatorias

- Lock por `clubId + puntoDeVenta + tipoComprobante`.
- Una sola emision en vuelo por esa combinacion.
- Antes de emitir, consultar `FECompUltimoAutorizado`.
- El numero local a solicitar debe ser `ultimo + 1`.

## Clave sugerida de lock

```text
arca:seq-lock:club:{clubId}:pto:{ptoVta}:cbte:{cbteTipo}
```

## Idempotencia funcional

Cada solicitud local debe tener una `idempotencyKey` estable, por ejemplo:

```text
club:{clubId}:origin:{originType}:{originId}:kind:{voucherKind}
```

Esto evita:

- crear dos comprobantes fiscales para la misma venta,
- reemitir por timeout del frontend,
- reprocesar dos veces el mismo outbox.

## 14. Estados del comprobante

Estados sugeridos para la entidad fiscal:

- `PENDING`
- `QUEUED`
- `PROCESSING`
- `APPROVED`
- `APPROVED_WITH_OBSERVATIONS`
- `REJECTED`
- `TECHNICAL_ERROR`
- `CANCELLED`

### Semantica

- `PENDING`: creado localmente, aun no encolado.
- `QUEUED`: listo para worker.
- `PROCESSING`: tomado por worker.
- `APPROVED`: ARCA devolvio CAE sin observaciones bloqueantes.
- `APPROVED_WITH_OBSERVATIONS`: aprobado pero con observaciones.
- `REJECTED`: error funcional o validacion ARCA.
- `TECHNICAL_ERROR`: timeout, caida de red, SOAP invalido, WS no disponible.
- `CANCELLED`: solicitud interna anulada antes de la emision.

## 15. Modelo de datos propuesto

Se recomienda agregar al menos estas entidades nuevas en Prisma.

## 15.1 ConfiguracionFiscal

Representa la configuracion fiscal por club.

```prisma
enum FiscalCondition {
  RESPONSABLE_INSCRIPTO
  MONOTRIBUTO
  EXENTO
  CONSUMIDOR_FINAL
  OTRO
}

model ConfiguracionFiscal {
  id                    String   @id @default(cuid())
  clubId                Int      @unique
  club                  Club     @relation(fields: [clubId], references: [id], onDelete: Cascade)

  razonSocial           String
  cuit                  String
  condicionIva          FiscalCondition
  ingresosBrutos        String?
  inicioActividadesAt   DateTime? @db.Timestamptz(3)

  puntoDeVenta          Int
  usaHomologacion       Boolean   @default(true)
  activo                Boolean   @default(true)

  certificadoPem        String
  clavePrivadaPem       String
  clavePrivadaPassphrase String?
  certificadoSerial     String?
  certificadoSubject    String?
  vencimientoCertificado DateTime? @db.Timestamptz(3)

  ultimoHealthcheckAt   DateTime? @db.Timestamptz(3)
  ultimoHealthcheckOk   Boolean?
  observaciones         String?

  createdAt             DateTime  @default(now()) @db.Timestamptz(3)
  updatedAt             DateTime  @updatedAt @db.Timestamptz(3)

  facturas              Factura[]

  @@index([activo])
  @@index([cuit])
}
```

## 15.2 Factura

Entidad principal del comprobante fiscal emitido o a emitir.

```prisma
enum FiscalVoucherKind {
  INVOICE
  CREDIT_NOTE
}

enum FiscalVoucherStatus {
  PENDING
  QUEUED
  PROCESSING
  APPROVED
  APPROVED_WITH_OBSERVATIONS
  REJECTED
  TECHNICAL_ERROR
  CANCELLED
}

enum FiscalOriginType {
  BOOKING
  ACCOUNT
  ACCOUNT_ITEM
  MANUAL
  REFUND
}

model Factura {
  id                    String   @id @default(cuid())
  clubId                Int
  club                  Club     @relation(fields: [clubId], references: [id], onDelete: Restrict)

  configuracionFiscalId String
  configuracionFiscal   ConfiguracionFiscal @relation(fields: [configuracionFiscalId], references: [id], onDelete: Restrict)

  kind                  FiscalVoucherKind
  status                FiscalVoucherStatus @default(PENDING)
  originType            FiscalOriginType
  originId              String
  idempotencyKey        String

  bookingId             Int?
  booking               Booking? @relation(fields: [bookingId], references: [id], onDelete: SetNull)

  accountId             String?
  account               Account? @relation(fields: [accountId], references: [id], onDelete: SetNull)

  comprobanteTipo       Int
  comprobanteDescripcion String?
  puntoDeVenta          Int
  numeroComprobante     Int?

  concepto              Int
  fechaEmision          DateTime @db.Timestamptz(3)
  fechaServicioDesde    DateTime? @db.Timestamptz(3)
  fechaServicioHasta    DateTime? @db.Timestamptz(3)
  fechaVencimientoPago  DateTime? @db.Timestamptz(3)

  receptorDocTipo       Int
  receptorDocNumero     String
  receptorNombre        String?
  receptorDomicilio     String?
  receptorCondicionIva  FiscalCondition?

  monedaCodigo          String   @default("PES")
  monedaCotizacion      Decimal  @default(1) @db.Decimal(12, 6)

  importeNeto           Decimal  @db.Decimal(12, 2)
  importeIva            Decimal  @db.Decimal(12, 2)
  importeExento         Decimal  @default(0) @db.Decimal(12, 2)
  importeTributos       Decimal  @default(0) @db.Decimal(12, 2)
  importeTotal          Decimal  @db.Decimal(12, 2)

  cae                   String?
  caeVencimiento        DateTime? @db.Timestamptz(3)
  resultadoArca         String?

  qrPayloadBase64       String?
  qrUrl                 String?

  requestPayload        Json?
  responsePayload       Json?
  observacionesArca     Json?
  erroresArca           Json?
  mensajeError          String?
  intentoActual         Int      @default(0)
  ultimoIntentoAt       DateTime? @db.Timestamptz(3)

  comprobanteAsociadoId String?
  comprobanteAsociado   Factura?  @relation("FacturaAsociada", fields: [comprobanteAsociadoId], references: [id], onDelete: SetNull)
  notasCreditoAsociadas Factura[] @relation("FacturaAsociada")

  createdAt             DateTime @default(now()) @db.Timestamptz(3)
  updatedAt             DateTime @updatedAt @db.Timestamptz(3)

  @@unique([clubId, idempotencyKey])
  @@index([clubId, status, createdAt])
  @@index([clubId, originType, originId])
  @@index([clubId, puntoDeVenta, comprobanteTipo, numeroComprobante])
  @@index([bookingId])
  @@index([accountId])
}
```

## 15.3 Tabla opcional de cache persistente WSAA

Si se desea fallback a base:

```prisma
model FiscalAuthTicket {
  id              String   @id @default(cuid())
  clubId          Int
  service         String
  token           String
  sign            String
  generationTime  DateTime @db.Timestamptz(3)
  expirationTime  DateTime @db.Timestamptz(3)
  createdAt       DateTime @default(now()) @db.Timestamptz(3)
  updatedAt       DateTime @updatedAt @db.Timestamptz(3)

  @@unique([clubId, service])
  @@index([expirationTime])
}
```

## 16. Servicios de aplicacion propuestos

### ArcaAuthService

Responsabilidades:

- obtener `Token` y `Sign`,
- consultar cache,
- refrescar ticket si expira,
- encapsular WSAA.

Metodos sugeridos:

- `getValidAuth(clubId)`
- `refreshAuth(clubId)`
- `invalidateAuth(clubId)`

### ArcaInvoiceBuilderService

Responsabilidades:

- traducir `Account`, `Booking` y datos del receptor al payload ARCA,
- resolver `concepto`,
- calcular importes fiscales,
- validar campos obligatorios antes del WS.

Metodos sugeridos:

- `buildInvoicePayload(facturaId)`
- `buildCreditNotePayload(facturaId)`
- `validateDraft(facturaId)`

### ArcaVoucherService

Responsabilidades:

- consultar ultimo comprobante autorizado,
- emitir contra `WSFEv1`,
- procesar respuesta,
- persistir CAE, errores y observaciones.

Metodos sugeridos:

- `getLastAuthorizedNumber(clubId, ptoVta, cbteTipo)`
- `authorizeVoucher(facturaId)`
- `handleAuthorizationResponse(facturaId, response)`

### ArcaQrService

Responsabilidades:

- construir JSON reglamentario,
- codificar Base64,
- armar URL final del QR.

### ArcaWorker

Responsabilidades:

- consumir outbox,
- aplicar locks,
- manejar reintentos,
- actualizar estados.

## 17. Flujo detallado de emision

### Paso 1. Registro local

Cuando una venta queda lista para ser facturada:

- se crea la `Account` si no existe,
- se crea el registro `Factura` en estado `PENDING`,
- se genera `idempotencyKey`,
- se encola evento de outbox,
- la UI puede continuar.

### Paso 2. Toma por worker

El worker:

- cambia estado a `PROCESSING`,
- incrementa contador de intentos,
- resuelve `ConfiguracionFiscal`,
- obtiene auth WSAA.

### Paso 3. Lock de secuencia

Antes de consultar/emitir:

- toma lock distribuido por `clubId + ptoVta + cbteTipo`,
- valida que no exista otro worker emitiendo esa combinacion.

### Paso 4. Determinacion de numero

- llama `FECompUltimoAutorizado`,
- calcula `proximo = ultimo + 1`,
- inserta el numero en el draft si aun no estaba asignado.

### Paso 5. Emision

- arma el payload,
- llama `FECAESolicitar`,
- registra request y response.

### Paso 6. Cierre

Si `aprobado`:

- guarda `CAE`,
- guarda vencimiento `CAE`,
- guarda numero definitivo,
- genera QR,
- marca `APPROVED` o `APPROVED_WITH_OBSERVATIONS`.

Si `rechazado`:

- persiste codigos,
- persiste mensaje,
- marca `REJECTED`.

Si `error tecnico`:

- persiste detalle tecnico,
- marca `TECHNICAL_ERROR`,
- programa retry segun politica.

## 18. Reglas de validacion previas al WS

Antes de invocar ARCA, validar localmente:

- `ConfiguracionFiscal` activa.
- Certificado vigente.
- Punto de venta informado.
- Tipo de comprobante permitido para la condicion fiscal del club.
- Receptor consistente con el tipo de comprobante.
- Importes mayores o iguales a cero y sumas consistentes.
- Fechas de servicio completas si concepto `2` o `3`.
- Existencia del comprobante asociado en notas de credito.
- Moneda y cotizacion validas.
- Idempotencia no consumida por otro comprobante.

## 19. Regla de consumidor final

El modulo debe contemplar reglas particulares para `Consumidor Final`.

Minimo funcional:

- soportar receptor generico consumidor final,
- permitir datos reducidos cuando la normativa lo permita,
- exigir identificacion del receptor cuando el monto obligue a ello,
- guardar en documento interno los datos efectivamente enviados.

La tabla de reglas monetarias y umbrales debe ser parametrizable para evitar hardcodear normativa sensible al tiempo.

## 20. QR reglamentario

El QR debe representarse como:

```text
https://www.arca.gob.ar/fe/qr/?p={JSON_BASE64}
```

### JSON base sugerido

```json
{
  "ver": 1,
  "fecha": "2026-05-31",
  "cuit": 30712345678,
  "ptoVta": 3,
  "tipoCmp": 6,
  "nroCmp": 1234,
  "importe": 25000.0,
  "moneda": "PES",
  "ctz": 1,
  "tipoDocRec": 99,
  "nroDocRec": 0,
  "tipoCodAut": "E",
  "codAut": 75123456789012
}
```

## 21. Manejo de errores

## Clasificacion

### Error tecnico

Ejemplos:

- timeout,
- DNS,
- SSL,
- respuesta SOAP invalida,
- Redis caido,
- problema de serializacion.

Accion:

- `TECHNICAL_ERROR`,
- retry automatico con backoff,
- alerta si supera umbral.

### Error funcional ARCA

Ejemplos:

- punto de venta invalido,
- receptor inconsistente,
- importe mal calculado,
- certificado no autorizado,
- concepto/fecha incompatibles.

Accion:

- `REJECTED`,
- no retry automatico ciego,
- exponer detalle en admin.

### Observacion

Ejemplos:

- respuesta aprobada con mensajes no bloqueantes.

Accion:

- persistir observaciones,
- marcar `APPROVED_WITH_OBSERVATIONS`.

## 22. Politica de reintentos

Recomendacion inicial:

- intento inmediato: `1`
- retry 1: `+1 min`
- retry 2: `+5 min`
- retry 3: `+15 min`
- retry 4: `+60 min`

Luego:

- pasar a cola manual,
- notificar al panel administrativo.

Nunca reintentar automaticamente:

- errores de validacion fiscal,
- certificado vencido,
- punto de venta no habilitado,
- configuracion fiscal faltante.

## 23. Observabilidad y auditoria

Registrar:

- `clubId`
- `facturaId`
- `originType`
- `originId`
- `ptoVta`
- `cbteTipo`
- `numeroComprobante`
- estado previo y nuevo
- `attempt`
- timestamp
- duracion de request
- codigos y mensajes ARCA

Metricas recomendadas:

- comprobantes emitidos por hora
- tasa de aprobacion
- tasa de rechazo
- latencia promedio ARCA
- tickets WSAA refrescados
- retries por club
- certificados proximos a vencer

## 24. Panel administrativo minimo

Vista recomendada para backoffice:

- filtro por club
- filtro por estado
- filtro por fecha
- filtro por tipo de comprobante
- busqueda por CAE o numero
- busqueda por `Booking` o `Account`

Acciones recomendadas:

- reintentar
- ver request/response
- descargar representacion
- emitir nota de credito
- invalidar cache WSAA
- probar configuracion fiscal

## 25. Ambientes

El modulo debe soportar:

- `homologacion`
- `produccion`

Cada `ConfiguracionFiscal` debe conocer:

- endpoint activo,
- certificado correspondiente,
- punto de venta habilitado,
- banderas de sandbox.

No mezclar:

- certificados de homologacion en produccion,
- numeracion productiva con homologacion,
- caches de auth entre ambientes.

## 26. Decision sobre libreria

Se puede evaluar `@afipsdk/afip.js`, pero la integracion no debe quedar acoplada a una libreria sin wrapper propio.

Decision recomendada:

- crear una abstraccion interna `ArcaGateway`,
- encapsular dentro de ella cualquier dependencia externa,
- evitar propagar tipos o supuestos de la libreria por todo el dominio.

Ventajas:

- facilita testing,
- facilita swap de libreria,
- reduce lock-in tecnico,
- permite inyectar certificados desde memoria.

## 27. Contratos internos recomendados

### DTO de solicitud interna

```ts
type CreateFiscalVoucherInput = {
  clubId: number;
  originType: 'BOOKING' | 'ACCOUNT' | 'ACCOUNT_ITEM' | 'MANUAL' | 'REFUND';
  originId: string;
  kind: 'INVOICE' | 'CREDIT_NOTE';
  receiver: {
    docType: number;
    docNumber: string;
    name?: string;
    address?: string;
    ivaCondition?: string;
  };
  requestedByUserId?: number;
};
```

### DTO de resultado interno

```ts
type FiscalVoucherResult = {
  facturaId: string;
  status: 'APPROVED' | 'APPROVED_WITH_OBSERVATIONS' | 'REJECTED' | 'TECHNICAL_ERROR';
  cae?: string;
  caeDueDate?: string;
  voucherNumber?: number;
  arcaResult?: string;
  errorCode?: string;
  errorMessage?: string;
};
```

## 28. Testing

### Unit tests

- resolver concepto segun items
- builder de importes
- builder de QR
- renovacion de token con margen de expiracion
- idempotencia de creacion
- mapeo de respuestas ARCA a estados internos

### Integration tests

- emision aprobada en homologacion
- rechazo por datos invalidos
- nota de credito asociada
- reintento por timeout
- lock concurrente para la misma secuencia

### E2E internos

- venta de booking -> encolado -> emision -> ticket final
- venta mixta -> concepto `3`
- cancelacion por lluvia -> nota de credito

## 29. Checklist de implementacion

### Fase 1 - base de datos

- crear `ConfiguracionFiscal`
- crear `Factura`
- crear enums fiscales
- agregar relaciones con `Club`, `Booking`, `Account`

### Fase 2 - autenticacion

- implementar `ArcaAuthService`
- implementar cache Redis
- implementar lock de refresh WSAA

### Fase 3 - emision

- implementar `ArcaInvoiceBuilderService`
- implementar `ArcaVoucherService`
- implementar `ArcaQrService`

### Fase 4 - asincronia

- agregar nuevos tipos a `OutboxMessage`
- implementar `ArcaWorker`
- configurar retries e idempotencia

### Fase 5 - observabilidad y backoffice

- logs estructurados
- metricas
- pantalla de monitoreo
- accion de reproceso manual

## 30. Riesgos principales

- certificados vencidos o mal cargados
- caidas intermitentes de ARCA
- concurrencia que rompa correlatividad
- acople excesivo a una libreria externa
- diferencias entre importes operativos y fiscales
- cambios normativos en umbrales o representacion

## 31. Decisiones de arquitectura recomendadas

1. Mantener la venta operativa desacoplada de la autorizacion fiscal.
2. Usar `OutboxMessage` del sistema antes que una cola paralela nueva.
3. Usar `Redis` para cache y locks, con fallback razonable.
4. Implementar wrapper interno de ARCA aunque se use una libreria de terceros.
5. Persistir request/response con sanitizacion para auditoria.
6. Tratar correlatividad e idempotencia como requisitos de primer nivel.

## 32. Proximas tareas de desarrollo

Orden sugerido:

1. Definir esquema Prisma final.
2. Crear migracion.
3. Implementar `ArcaAuthService`.
4. Implementar `ArcaInvoiceBuilderService`.
5. Implementar `ArcaVoucherService`.
6. Integrar con `OutboxService`.
7. Agregar admin de configuracion fiscal.
8. Agregar pantalla de estado y reproceso.

## 33. Convenciones de naming sugeridas en codigo

- `ConfiguracionFiscal`
- `Factura`
- `ArcaAuthService`
- `ArcaVoucherService`
- `ArcaInvoiceBuilderService`
- `ArcaQrService`
- `ArcaWorker`

Si el equipo prefiere nombres en ingles, mantener consistencia total:

- `FiscalConfig`
- `FiscalVoucher`
- `ArcaAuthService`
- `ArcaVoucherService`
- `ArcaInvoiceBuilderService`

No mezclar ambos estilos en las entidades principales.

## 34. Resumen ejecutivo

El modulo de facturacion electronica ARCA para Pique debe construirse como una capacidad fiscal multi-tenant, asincrona, auditable e idempotente. La unidad de aislamiento es `Club`; la unidad operativa de origen es `Account`/`Booking`; y la unidad fiscal a persistir es `Factura`. La implementacion debe apoyarse en `Redis` para cache y locks, y en el outbox existente para el procesamiento en background. La correlatividad, el manejo de certificados y la separacion entre errores tecnicos y funcionales son los ejes que determinan si el modulo sera estable en produccion.

## Onboarding fiscal de un club

Para activar la facturacion electronica de un club en `Pique`, la conexion tecnica con `ARCA` la realiza la plataforma, pero la identidad fiscal y la habilitacion operativa deben pertenecer al club emisor.

### Objetivo

Estandarizar el alta de nuevos tenants para que cada club pueda emitir comprobantes validos desde `Pique` con su propio `CUIT`, su propio punto de venta y sus propias credenciales fiscales.

### Principio de arquitectura

`Pique` centraliza la integracion tecnica, pero no centraliza la identidad fiscal.

Esto implica que:

- `Pique` realiza las llamadas a `WSAA` y `WSFEv1`.
- cada club emite comprobantes en nombre propio.
- cada club debe contar con su propia configuracion fiscal.
- no debe existir una unica credencial fiscal compartida para todos los tenants.

### Informacion que debe entregar el club

Cada club debe proveer como minimo:

- `CUIT`
- `Razon Social`
- condicion frente al IVA
- domicilio fiscal o comercial, si corresponde informarlo
- `Punto de Venta` habilitado para web service
- certificado digital vigente
- clave privada asociada al certificado
- passphrase de la clave privada, si aplica
- confirmacion de ambiente: `homologacion` o `produccion`

### Requisitos previos en ARCA

Antes de operar desde `Pique`, el club debe tener resuelto en `ARCA`:

- `CUIT` activo
- clave fiscal habilitada
- representacion legal o administrativa vigente
- alta de `Punto de Venta` para facturacion por web service
- certificado digital emitido y vigente
- autorizacion del certificado para consumir los web services de factura electronica

### Responsabilidades del club

Son responsabilidad del club:

- la validez de su identidad fiscal
- la vigencia del certificado
- la correcta habilitacion del punto de venta
- la actualizacion de credenciales si vencen o se reemplazan
- la coherencia entre su condicion fiscal y el tipo de comprobantes que desea emitir

### Responsabilidades de Pique

Son responsabilidad de `Pique`:

- almacenar la configuracion fiscal del club de forma segura
- cifrar o proteger certificado y clave privada en reposo
- autenticar contra `WSAA` en nombre del club
- reutilizar `Token` y `Sign` mientras sigan vigentes
- emitir comprobantes en `WSFEv1` usando el `CUIT` del club
- mantener aislada la numeracion y trazabilidad de cada tenant
- registrar `CAE`, vencimiento, QR, errores y observaciones

### Validaciones previas a la activacion

Antes de marcar un club como operativo, el sistema debe validar:

- que la configuracion fiscal este completa
- que el certificado no este vencido
- que la clave privada corresponda al certificado
- que se pueda autenticar correctamente contra `WSAA`
- que el punto de venta sea valido para el club
- que la emision de prueba en `homologacion` sea exitosa

### Estados sugeridos del onboarding fiscal

Se recomienda modelar el alta fiscal del club con estados internos:

- `BORRADOR`
- `PENDIENTE_VALIDACION`
- `HOMOLOGACION_OK`
- `LISTO_PARA_PRODUCCION`
- `ACTIVO`
- `BLOQUEADO`

### Motivos de bloqueo posibles

Un club no debe quedar activo si ocurre alguno de estos casos:

- certificado vencido
- clave privada invalida
- punto de venta no habilitado
- autenticacion `WSAA` fallida
- rechazo de pruebas en homologacion
- inconsistencia entre `CUIT`, razon social y configuracion fiscal

### Recomendacion operativa

El onboarding fiscal deberia resolverse con un checklist administrable desde backoffice, de modo que el alta de un club no dependa de configuracion manual dispersa ni de conocimiento operativo informal.

### Resumen

La integracion con `ARCA` es centralizada desde `Pique`, pero cada club debe operar con su propia identidad fiscal. Por lo tanto, cada tenant debe contar con su propio `CUIT`, punto de venta habilitado, certificado digital, clave privada y autorizacion correspondiente. `Pique` no factura con una credencial fiscal unica de plataforma, sino en nombre de cada club emisor.

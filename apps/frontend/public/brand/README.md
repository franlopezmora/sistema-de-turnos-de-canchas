# Punto brand assets

Fuente de verdad del paquete visual Punto.

## Logo principal horizontal
- `punto-logo-horizontal.svg`: version oficial por defecto para fondos claros.
- `punto-logo-horizontal-light.svg`: alias de la version para fondos claros.
- `punto-logo-horizontal-dark.svg`: version para fondos oscuros.

## Isotipo
- `punto-isotipo.svg`: mark oficial para app icon, favicon, sidebar y loaders.
- `punto-isotipo-dark.svg`: mark para fondos oscuros cuando conviene usar contorno claro.

## Compatibilidad
- `/Vector.svg` contiene el mismo isotipo oficial que `brand/punto-isotipo.svg`.
- `/brand/punto-isotipo.svg` es el isotipo oficial; el archivo raiz compatible replica esa marca y no debe usarse como fuente nueva.

## Raster generados
- `/favicon.ico`
- `/favicon-32.png`
- `/favicon-48.png`
- `/favicon-192.png`
- `/favicon-512.png`
- `/og-1200x630.png`

Regeneracion: `npm --prefix apps/frontend run generate-icons`.

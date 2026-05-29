## Compactar OTD en home + página dedicada a "Trabajos en riesgo"

### 1. Compactar `OTDTracker` en la home

Quitar de la card de la home:
- El bloque "Cómo se calcula" (legend)
- La tabla completa de Trabajos en riesgo

Dejar solo:
- Header `OTD · Entrega a Tiempo`
- Los 4 KPIs (OTD %, A tiempo, En riesgo, Tarde)
- Footer compacto con `Link` a `/riesgo`: "Ver trabajos en riesgo →" (mostrando el conteo `{atRisk.length} ODFs`)

Resultado: la card pasa de ~400px a ~140px de alto.

### 2. Nueva ruta `/riesgo` (`src/routes/riesgo.tsx`)

Página dedicada con:
- Header con título "Trabajos en Riesgo" + breadcrumb / link "← Volver al tablero"
- Los mismos 4 KPIs arriba (reutilizando los `Pct` cards extraídos a un sub-componente compartido)
- El bloque "Cómo se calcula" (legend completo)
- **Tabla expandida** de trabajos en riesgo con más columnas que la versión actual:
  - ODF, Tubo, PIR, Cantidad, Operador, Máquina, Fecha cliente, Fecha export planeada, Días restantes, Estado
  - Ordenable por fecha cliente (más urgente arriba por defecto)
  - Filtro tabs: Todos / En riesgo / Tarde
  - Click en fila abre el `JobDetailDialog` existente
- `head()` propio con title/description

Lee los mismos datos vía el hook `useFactData` ya existente.

### 3. Refactor mínimo

Extraer `Pct` y la legend a `src/components/fact/otd-shared.tsx` para reusar entre la card compacta y la página completa, sin duplicar markup.

### Archivos a tocar
- `src/components/fact/OTDTracker.tsx` — recortar a versión compacta
- `src/components/fact/otd-shared.tsx` — nuevo, KPIs + legend reutilizables
- `src/routes/riesgo.tsx` — nueva página
- (auto) `src/routeTree.gen.ts` se regenera

### Fuera de alcance
- Cambios al cálculo OTD (`src/lib/scheduling/otd.ts`)
- Cambios al resto del dashboard

## Adaptar horarios de turnos y capacidad de máquinas (email Fron)

Aplicar la realidad operativa que mandó Fron: ventanas horarias reales de los turnos, días laborables Lun–Vie, y configuración por máquina.

### 1. Horarios de turnos (`src/lib/shifts.ts`)

Cambiar `SHIFTS` y `shiftIndexFromHour` a las ventanas reales:

- Matutino (M): **07:00 – 15:00**
- Vespertino (T): **15:00 – 23:00**
- Nocturno (N): **23:00 – 07:00**

Actualizar:
- `SHIFTS[*].startHour` → 7 / 15 / 23
- `shiftIndexFromHour`: M `7≤h<15`, T `15≤h<23`, resto N
- `nextShiftBoundary`: boundaries `[7, 15, 23]`
- `formatShiftLabel`: ya muestra `startHour:00`, se beneficia automáticamente

### 2. Días laborables (Lun–Vie)

Añadir en `shifts.ts`:

```ts
export function isWorkday(d: Date) {
  const day = d.getDay(); // 0 = dom, 6 = sáb
  return day >= 1 && day <= 5;
}
```

Extender `nextActiveShiftBoundary` para saltar sábados y domingos: si el candidato cae en fin de semana, avanzar al lunes 07:00 y volver a evaluar el turno activo de la máquina.

Esto hace que el scheduler (`src/lib/scheduling/schedule.ts`, que ya usa `nextActiveShiftBoundary`) salte automáticamente el fin de semana sin más cambios.

### 3. Configuración por máquina (datos)

Migrar `machines.active_shifts` al estado real:

| Máquina | active_shifts |
|---|---|
| MAZAK 1 | `{manana,tarde,noche}` |
| MAZAK 2 | `{manana,tarde}` |
| MAZAK 3 | `{manana,tarde,noche}` |
| MAZAK 4 | `{manana}` |
| MAZAK 5 | `{manana}` |
| GEMAK, MAQYRO, TECMAC, GMAC | sin cambios (se quedan como están hasta que Fron confirme) |

Se hará con `supabase--insert` (UPDATE de datos, no migración de esquema).

### 4. UI

- `MachinesConfig.tsx`: los toggles M/T/N ya existen — solo verificar que las etiquetas y la capacidad diaria (`hours_per_shift × nº turnos activos`) reflejan los nuevos horarios.
- `MachineGantt.tsx` (bandas verticales M/T/N): se re-pintan solas porque leen `SHIFTS[*].startHour`. Verificar visualmente en `/`.
- Opcional: añadir un tooltip "Lun–Vie" debajo del nombre de cada máquina en la config para dejar el contrato explícito.

### Archivos a tocar
- `src/lib/shifts.ts` — horarios + helper `isWorkday` + skip de fin de semana
- (datos) tabla `machines` vía `supabase--insert`
- Verificación visual en `/configuracion` y `/`

### Fuera de alcance
- Excepciones puntuales (festivos, turno extra de fin de semana) — se podrán añadir después como override por fecha.
- Cambios al modelo de datos (no hace falta nueva columna).

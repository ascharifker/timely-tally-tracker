## Sincronizar Kanban ↔ Gantt (estado ↔ máquina)

Hoy el kanban edita `jobs.status` y el Gantt edita `jobs.machine_id` (+ fechas). Están desconectados: pasar la card de MAZAK a Taller Externo no la mueve a la fila de GMAC en el Gantt, y arrastrar la barra de MAZAK 1 a GMAC en el Gantt no cambia su columna en el kanban.

La regla es: **MAZAK ⟷ máquina interna**, **TALLER_EXTERNO ⟷ máquina `external_shop`**. Si una acción rompe esa equivalencia, la otra dimensión se sincroniza automáticamente.

### 1. Kanban → Gantt (`useUpdateJobStatus` en `src/hooks/useFactData.ts`)

Al cambiar status:

- **→ `TALLER_EXTERNO`**:
  - Si la máquina actual NO es `external_shop`, reasignar al primer machine con `type === "external_shop"` (hoy GMAC). Recalcular `planned_start`/`planned_end` con `scheduleJob` para esa máquina.
  - Si ya está en una externa, dejar la máquina.
- **→ `MAZAK`**:
  - Si la máquina actual es `external_shop`, limpiar `machine_id` y `planned_start`/`planned_end` (el usuario debe elegir MAZAK 1..5 — ya existe el toast "Asigná una máquina para verlo en el cronograma").
  - Si ya está en interna, comportamiento actual (re-schedule si faltan fechas).
- **Otros estados**: sin cambios.

Aplicarlo tanto en `onMutate` (optimista) como en el `mutationFn` (patch persistido), igual que el código actual.

### 2. Gantt → Kanban (`useRescheduleJob` y `useApplyReschedules`)

En el patch que se envía a Supabase y en el optimista, si `machine_id` cambia y eso cruza la frontera interna/externa, sumar `status` al patch:

- nueva máquina `external_shop` y status era `MAZAK` → `status = "TALLER_EXTERNO"`
- nueva máquina interna y status era `TALLER_EXTERNO` → `status = "MAZAK"`
- otros: no tocar status (CEMENTACION/EXPO/etc. se preservan).

Helper compartido:

```ts
function statusForMachine(currentStatus, newMachine) {
  if (!newMachine) return currentStatus;
  if (newMachine.type === "external_shop" && currentStatus === "MAZAK") return "TALLER_EXTERNO";
  if (newMachine.type === "internal"      && currentStatus === "TALLER_EXTERNO") return "MAZAK";
  return currentStatus;
}
```

Se llama en:
- `useRescheduleJob.mutationFn` y `onMutate` (línea ~377 en adelante)
- `useApplyReschedules.mutationFn` y `onMutate` (línea ~513) — itera sobre `commits[]`

### 3. UX

- Toast en el cambio implícito de status: "ODF 1234 movida a Taller Externo" cuando se origina desde el Gantt.
- En `ApproveMovesDialog`, si una move implica cambio de status, mostrarlo en la fila (badge nuevo "→ Taller Externo" / "→ MAZAK"). Opcional/menor; lo dejo si la fila ya muestra `original_machine_id` vs `machine_id`. **Lo incluyo solo si no añade fricción**.

### Archivos a tocar
- `src/hooks/useFactData.ts` — único archivo con lógica de mutación. Cambios localizados a 3 funciones: `useUpdateJobStatus`, `useRescheduleJob`, `useApplyReschedules`.
- (opcional) `src/components/fact/ApproveMovesDialog.tsx` — badge informativo si el move cambia status.

### Fuera de alcance
- Múltiples talleres externos: hoy solo GMAC. Si en el futuro hay 2+, se podrá mostrar un selector. Mientras tanto, auto-pick del primero por `display_order`.
- Cambios al esquema BD: ninguno (status y machine_id ya existen y permiten cualquier combinación).
- Cambios al scheduler en sí (`src/lib/scheduling/schedule.ts`).

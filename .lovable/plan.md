## Sembrar datos demo: cronograma saturado

Llenar las 4 MAZAK con trabajos consecutivos durante las próximas ~3 semanas para que el Gantt se vea cargado y podamos role-playear movimientos, ausencias, change orders y averías.

### Qué se va a sembrar

**~32 ODFs nuevos** (8 por cada MAZAK 1-4) más algunos en talleres externos:

- **MAZAK 1-4**: 8 ODFs cada una, encadenados sin huecos, duración 1-3 días por trabajo, arrancando hoy y cubriendo ~21 días
- **Estados variados** a lo largo del pipeline:
  - 1-2 en `MAZAK` (en curso, los más cercanos a hoy)
  - 2-3 en `PLANNED` (próximos)
  - 1 en `MAQUINADO_LISTO`, 1 en `CEMENTACION`, 1 en `EXPO` (más adelante o pasados)
  - 1 en `YA_SE_ENVIO` (ya pasado, para ver el verde)
- **Prioridades mezcladas**: ~70% normal, 20% high, 10% urgent (uno por máquina urgente para tener candidatos a "priority_shift")
- **Specs realistas**: tube specs tipo `2-7/8" L-80`, `3-1/2" P-110`, `4-1/2" J-55`, etc.
- **Fechas de cliente** (`customer_date`) ~2-4 días después del `planned_end` para que el OTD tracker tenga señal
- **PO/PIR** ficticios pero con formato consistente (`PO-MUSA-2026-xxxx`, `PIR-xxxx`)
- **Talleres externos** (GEMAK/MAQYRO/TECMAC): 2-3 ODFs cada uno para mostrar fila externa también

### Eventos demo opcionales (para tener historial)

Insertar 3-4 `status_events` pasados así el side panel de historial no está vacío:
- 1 `delay` (retraso de producción de 8h en una ODF)
- 1 `priority_shift` (urgente que se metió la semana pasada)
- 1 `breakdown` (avería corta en MAZAK 2)

### Cómo se ejecuta

Una sola llamada al insert tool con todos los `INSERT INTO jobs (...)` y `INSERT INTO status_events (...)`. **No** se borran los 9 ODFs existentes — se agregan encima. Si después querés empezar limpio te paso un script para vaciar.

### Después de sembrar

Vas a poder:
1. Ver las 4 MAZAK llenas en vista 14d
2. Arrastrar un urgente y aprobar el movimiento (priority_shift)
3. Marcar ausencia de personal en un turno y ver el cascade
4. Cambiar un change order y ver el ghost bar
5. Revisar historial en el side panel

### Pregunta antes de ejecutar

¿Querés que **borre los 9 ODFs existentes** primero para tener un set limpio, o los dejo y agrego encima?

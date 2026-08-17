# Draft reply to Catalina (Quality Matrix clarification)

## Goal
Send Catalina a clear, friendly reply in Spanish that explains what we mean by "Quality Matrix" in the engineering verification module, resolves her product-vs-process question, and asks for the QC checklist/template she already uses so we can digitize it.

## Proposed email (Spanish)

```text
Asunto: Matriz de Calidad – aclaración para el módulo de ingeniería

Hola Catalina,

Gracias por la pregunta, me doy cuenta de que no quedó claro.

La "matriz de calidad" que estamos armando está enfocada principalmente al **producto**: para cada número de parte / PO line item queremos definir los criterios de inspección y verificación que aseguren que la pieza salió conforme a especificaciones antes de pasar a producción.

Lo que buscamos capturar es algo como:

- Dimensiones críticas a verificar (OD, ID, longitudes, tolerancias, etc.)
- Características del material / acabado
- Método de inspección (calibre, CMM, visual, etc.)
- Frecuencia o momento de la verificación
- Criterio de aceptación / rechazo
- Quién firma/revisa

Dicho esto, también nos interesa que refleje un poco el **proceso**: quién hace cada revisión y en qué etapa (por ejemplo, al recibir PO, antes de maquinado, inspección final), para que quede trazable dentro de la plataforma.

La idea es tomar la lista de verificación o formato que tú ya uses en QC, subirlo como referencia, y convertirlo en una checklist digital por línea de PO. Cuando todos los puntos estén OK, el ingeniero puede firmar el paso de Quality Matrix y la línea avanza.

¿Podrías compartirme un ejemplo de la matriz/checklist que usan hoy? Puede ser un Excel, PDF o foto. Con eso lo adaptamos y lo metemos al flujo.

Gracias,
Alex
```

## Next step after her reply
Once Catalina shares her template, update the Quality Matrix panel so it matches her real criteria (checklist items, acceptance criteria, sign-off fields) instead of the generic placeholders currently in the code.

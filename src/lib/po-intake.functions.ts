import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertCanEditPo(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "po_editor", "coe_reviewer", "third_party_reviewer", "manager"]);
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error("Forbidden: PO editor role required");
  }
}

// ---------------------------------------------------------------
// Shared Zod schemas
// ---------------------------------------------------------------

const ExtractedLineItem = z.object({
  line_number: z.number().int().positive(),
  pir: z.string().nullable(),
  pir_rev: z.string().nullable().optional().default(null),
  customer_part_number: z.string().nullable().optional().default(null),
  low_confidence: z.boolean().optional().default(false),
  tube_spec: z.string().nullable(),
  qty_ordered: z.number().int().positive(),
  committed_date: z.string().nullable(),
  unit_price: z.number().nullable(),
  hb_price: z.number().nullable().optional().default(null),
  line_total: z.number().nullable().optional().default(null),
  currency: z.string().nullable(),
});

const ExtractedPo = z.object({
  customer_name: z.string(),
  po_number: z.string(),
  issued_date: z.string().nullable(),
  committed_date: z.string().nullable(),
  line_items: z.array(ExtractedLineItem),
});

export type ExtractedPoData = z.infer<typeof ExtractedPo>;

// ---------------------------------------------------------------
// extractPoFromPdf
// ---------------------------------------------------------------

export const extractPoFromPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ storagePath: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<ExtractedPoData> => {
    await assertCanEditPo(context.userId);
    const lovableKey = process.env.LOVABLE_API_KEY;
    if (!lovableKey) throw new Error("LOVABLE_API_KEY no configurada");

    // Download PDF from private bucket (service-role, bypasses RLS).
    const { data: file, error: dlErr } = await supabaseAdmin.storage
      .from("po-documents")
      .download(data.storagePath);
    if (dlErr || !file) {
      throw new Error(`No se pudo leer el PDF: ${dlErr?.message ?? "desconocido"}`);
    }
    const buffer = Buffer.from(await file.arrayBuffer());

    const gateway = createLovableAiGatewayProvider(lovableKey);
    const model = gateway("google/gemini-3-flash-preview");

    const systemPrompt = [
      "Sos un asistente que extrae datos estructurados de Purchase Orders (PO) de clientes industriales en Argentina.",
      "Los clientes típicos son Musa, Halliburton y similares.",
      "Devolvé EXCLUSIVAMENTE un JSON válido con esta forma:",
      "{",
      '  "customer_name": string,',
      '  "po_number": string,',
      '  "issued_date": "YYYY-MM-DD" | null,',
      '  "committed_date": "YYYY-MM-DD" | null,',
      '  "line_items": [',
      "    {",
      '      "line_number": number,',
      '      "pir": string | null,           // código PIR del item',
      '      "customer_part_number": string | null, // el mismo número tal cual figura en la columna Customer Part #',
      '      "pir_rev": string | null,       // revisión / versión del PIR o plano (ej "A", "02", "Rev C")',
      '      "tube_spec": string | null,     // descripción / spec del tubo',
      '      "qty_ordered": number,',
      '      "committed_date": "YYYY-MM-DD" | null,',
      '      "unit_price": number | null,      // precio unitario por pieza',
      '      "line_total": number | null,      // precio total / extendido de la línea',
      '      "currency": string | null',
      "    }",
      "  ]",
      "}",
      "Si un campo no aparece en el PDF, usá null. Las fechas SIEMPRE en formato YYYY-MM-DD.",
      "NÚMERO DE PARTE (CRÍTICO): el 'pir' de cada línea SIEMPRE sale de la columna 'Customer Part #' / 'Part #' / 'Material' de la tabla 'Line Items'.",
      "NUNCA tomes el número de parte del bloque de Comments / 'TECHNICAL DATA' que aparece debajo de cada línea: ese bloque es la lista de materiales (BOM) e incluye decenas de filas 'COM', 'PIR', 'MDW', 'SPC', 'DRW' de componentes hijos.",
      "Ignorá por completo las filas COM, MDW, SPC y DRW. Solo podés usar una fila 'PIR' o 'MAT' del bloque técnico si su nivel (LVL) es '00' Y su número coincide exactamente con el Customer Part # de esa línea.",
      "pir_rev: la letra REV de esa fila PIR/MAT de nivel 00 con el mismo número de parte (ej 'C'). Si no existe, null.",
      "tube_spec: la descripción de la línea que está en la columna 'Part # / Description' (ej 'SH,FL,7-5/8BLK TSH523 33.7,PQ,DV,RPT,EDJ'). Nunca uses la descripción de un componente del BOM.",
      "customer_part_number: copiá el valor de la columna Customer Part # tal cual, sin modificar.",
      "PRECIOS: buscá activamente columnas tipo 'Unit Price', 'Precio unitario', 'Price', 'Amount', 'Extended', 'Total', 'Importe'.",
      "Normalizá los números: quitá separadores de miles y símbolos de moneda; '1.234,56' => 1234.56; '$ 1,234.56' => 1234.56.",
      "Devolvé los precios como números puros (sin comas, sin símbolos).",
      "Si solo hay un total de línea, dejá unit_price en null y poné el valor en line_total.",
      "currency: usá el código ISO cuando puedas ('USD', 'ARS', 'EUR').",
      "No agregues texto fuera del JSON. No uses markdown ni ```.",
    ].join("\n");

    const { text } = await generateText({
      model,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extraé los datos estructurados de este Purchase Order:",
            },
            {
              type: "file",
              data: buffer,
              mediaType: "application/pdf",
            },
          ],
        },
      ],
    });

    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      throw new Error(
        `No pudimos parsear la respuesta del modelo. Texto: ${cleaned.slice(0, 200)}`,
      );
    }

    const result = ExtractedPo.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `La extracción no cumple el formato esperado: ${result.error.message}`,
      );
    }
    // Sanity-check part numbers, then derive unit price when only the total was found.
    return {
      ...result.data,
      line_items: result.data.line_items.map((li) => {
        const cpn = li.customer_part_number?.trim() || null;
        const pir = li.pir?.trim() || null;
        // The customer part number column is authoritative; the BOM block in the
        // Comments section confuses the model into picking a child component.
        const mismatch = !!cpn && !!pir && cpn !== pir;
        const resolvedPir = cpn ?? pir;
        li = {
          ...li,
          pir: resolvedPir,
          low_confidence: mismatch || !cpn,
        };
        if (li.unit_price == null && li.line_total != null && li.qty_ordered > 0) {
          const derivedPrice = Math.round((li.line_total / li.qty_ordered) * 100) / 100;
          return {
            ...li,
            unit_price: derivedPrice,
            hb_price: derivedPrice,
          };
        }
        return { ...li, hb_price: li.hb_price ?? li.unit_price };
      }),
    };
  });

// ---------------------------------------------------------------
// commitPo
// ---------------------------------------------------------------

const CommitPoInput = z.object({
  storagePath: z.string().nullable(),
  customer: z.object({
    id: z.string().uuid().nullable(),
    name: z.string().min(1),
  }),
  po_number: z.string().min(1),
  issued_date: z.string().nullable(),
  committed_date: z.string().nullable(),
  notes: z.string().nullable(),
  line_items: z
    .array(
      z.object({
        line_number: z.number().int().positive(),
        pir: z.string().nullable(),
        pir_rev: z.string().nullable().optional().default(null),
        tube_spec: z.string().nullable(),
        qty_ordered: z.number().int().positive(),
        committed_date: z.string().nullable(),
        unit_price: z.number().nullable(),
        hb_price: z.number().nullable().optional().default(null),
        currency: z.string().nullable(),
      }),
    )
    .min(1),
});

export const commitPo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CommitPoInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertCanEditPo(context.userId);
    // 1. Find or create customer.
    let customerId = data.customer.id;
    if (!customerId) {
      const { data: existing } = await supabaseAdmin
        .from("customers" as never)
        .select("id")
        .ilike("name", data.customer.name)
        .maybeSingle();
      if (existing) {
        customerId = (existing as { id: string }).id;
      } else {
        const { data: created, error: cErr } = await supabaseAdmin
          .from("customers" as never)
          .insert({ name: data.customer.name } as never)
          .select("id")
          .single();
        if (cErr) throw new Error(`No se pudo crear el cliente: ${cErr.message}`);
        customerId = (created as { id: string }).id;
      }
    }

    // 2. Insert purchase_order.
    let poId: string;
    const { data: po, error: poErr } = await supabaseAdmin
      .from("purchase_orders" as never)
      .insert({
        customer_id: customerId,
        po_number: data.po_number,
        issued_date: data.issued_date,
        committed_date: data.committed_date,
        notes: data.notes,
        source_document_url: data.storagePath,
      } as never)
      .select("id")
      .single();
    if (poErr) {
      // Duplicate (customer_id, po_number) — reuse existing PO and append new lines.
      const isDup =
        (poErr as { code?: string }).code === "23505" ||
        /duplicate key/i.test(poErr.message);
      if (!isDup) throw new Error(`No se pudo crear el PO: ${poErr.message}`);
      const { data: existingPo, error: findErr } = await supabaseAdmin
        .from("purchase_orders" as never)
        .select("id")
        .eq("customer_id", customerId)
        .eq("po_number", data.po_number)
        .maybeSingle();
      if (findErr || !existingPo) {
        throw new Error(`PO duplicado y no se pudo recuperar el existente: ${poErr.message}`);
      }
      poId = (existingPo as { id: string }).id;
    } else {
      poId = (po as { id: string }).id;
    }

    // 3. Insert line items — skip line_numbers that already exist for this PO.
    const { data: existingLines } = await supabaseAdmin
      .from("po_line_items" as never)
      .select("line_number")
      .eq("purchase_order_id", poId);
    const taken = new Set(
      ((existingLines as { line_number: number }[] | null) ?? []).map((r) => r.line_number),
    );
    const rows = data.line_items
      .filter((li) => !taken.has(li.line_number))
      .map((li) => ({
      purchase_order_id: poId,
      line_number: li.line_number,
      pir: li.pir,
      pir_rev: li.pir_rev ?? null,
      tube_spec: li.tube_spec,
      qty_ordered: li.qty_ordered,
      committed_date: li.committed_date,
       unit_price: li.unit_price ?? li.hb_price,
       hb_price: li.hb_price ?? li.unit_price,
      currency: li.currency,
    }));
    if (rows.length > 0) {
      const { error: liErr } = await supabaseAdmin
        .from("po_line_items" as never)
        .insert(rows as never);
      if (liErr) {
        throw new Error(`No se pudieron crear las líneas: ${liErr.message}`);
      }
    }

    return { id: poId };
  });

// ---------------------------------------------------------------
// getPoDocumentUrl — signed URL for the original PDF
// ---------------------------------------------------------------

export const getPoDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ storagePath: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCanEditPo(context.userId);
    const { data: signed, error } = await supabaseAdmin.storage
      .from("po-documents")
      .createSignedUrl(data.storagePath, 60 * 60);
    if (error || !signed) throw new Error(error?.message ?? "No se pudo firmar URL");
    return { url: signed.signedUrl };
  });

// ---------------------------------------------------------------
// attachPoDocument — link an uploaded PDF to an existing PO
// ---------------------------------------------------------------

export const attachPoDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        purchaseOrderId: z.string().uuid(),
        storagePath: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCanEditPo(context.userId);
    const { error } = await supabaseAdmin
      .from("purchase_orders" as never)
      .update({ source_document_url: data.storagePath } as never)
      .eq("id", data.purchaseOrderId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
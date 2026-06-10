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
  tube_spec: z.string().nullable(),
  qty_ordered: z.number().int().positive(),
  committed_date: z.string().nullable(),
  unit_price: z.number().nullable(),
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
      '      "tube_spec": string | null,     // descripción / spec del tubo',
      '      "qty_ordered": number,',
      '      "committed_date": "YYYY-MM-DD" | null,',
      '      "unit_price": number | null,',
      '      "currency": string | null',
      "    }",
      "  ]",
      "}",
      "Si un campo no aparece en el PDF, usá null. Las fechas SIEMPRE en formato YYYY-MM-DD.",
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
    return result.data;
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
        tube_spec: z.string().nullable(),
        qty_ordered: z.number().int().positive(),
        committed_date: z.string().nullable(),
        unit_price: z.number().nullable(),
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
      tube_spec: li.tube_spec,
      qty_ordered: li.qty_ordered,
      committed_date: li.committed_date,
      unit_price: li.unit_price,
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
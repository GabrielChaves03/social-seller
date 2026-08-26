import "server-only";
import { supabaseAdmin } from "./supabase-admin";

export type LeadStatus =
  | "novo"
  | "abordado"
  | "respondeu"
  | "qualificado"
  | "encaminhado_whatsapp"
  | "descartado";

export const LEAD_STATUSES: LeadStatus[] = [
  "novo",
  "abordado",
  "respondeu",
  "qualificado",
  "encaminhado_whatsapp",
  "descartado",
];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  novo: "Novo",
  abordado: "Abordado",
  respondeu: "Respondeu",
  qualificado: "Qualificado",
  encaminhado_whatsapp: "Encaminhado ao WhatsApp",
  descartado: "Descartado",
};

export type Lead = {
  id: string;
  account_id: string;
  ig_scoped_id: string;
  ig_username: string | null;
  status: LeadStatus;
  first_comment_text: string | null;
  first_contact_at: string | null;
  last_status_at: string;
};

/**
 * Busca o lead existente (por conta + ig_scoped_id) ou cria um novo com
 * status "novo". Um mesmo ig_scoped_id pode existir em contas diferentes
 * — cada conta tem seu próprio funil.
 */
export async function upsertLead({
  accountId,
  igScopedId,
  igUsername,
  commentText,
}: {
  accountId: string;
  igScopedId: string;
  igUsername?: string | null;
  commentText: string;
}): Promise<Lead> {
  const { data: existing, error: selectError } = await supabaseAdmin
    .from("leads")
    .select("*")
    .eq("account_id", accountId)
    .eq("ig_scoped_id", igScopedId)
    .maybeSingle();

  if (selectError) throw new Error(`Falha ao buscar lead: ${selectError.message}`);

  if (existing) {
    if (igUsername && igUsername !== existing.ig_username) {
      await supabaseAdmin
        .from("leads")
        .update({ ig_username: igUsername, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    }
    return existing;
  }

  const { data: created, error: insertError } = await supabaseAdmin
    .from("leads")
    .insert({
      account_id: accountId,
      ig_scoped_id: igScopedId,
      ig_username: igUsername ?? null,
      first_comment_text: commentText,
      first_contact_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError || !created) {
    throw new Error(`Falha ao criar lead: ${insertError?.message}`);
  }

  return created;
}

export async function updateLeadStatus(leadId: string, status: LeadStatus) {
  const { error } = await supabaseAdmin
    .from("leads")
    .update({ status, last_status_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", leadId);

  if (error) throw new Error(`Falha ao atualizar status do lead: ${error.message}`);
}

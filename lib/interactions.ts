import "server-only";
import { supabaseAdmin } from "./supabase-admin";
import type { LeadStatus } from "./leads";

export type InteractionStatus = "pending" | "sending" | "sent" | "failed" | "skipped";

export type InteractionWithLead = {
  id: string;
  comment_id: string | null;
  media_id: string | null;
  comment_text: string | null;
  generated_message: string | null;
  llm_model: string | null;
  status: InteractionStatus;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
  lead: {
    id: string;
    ig_scoped_id: string;
    ig_username: string | null;
    status: LeadStatus;
  } | null;
};

/** Mensagens (interações) de uma conta, mais recentes primeiro, com o lead relacionado. */
export async function listInteractionsForAccount(
  accountId: string,
  limit = 100
): Promise<InteractionWithLead[]> {
  const { data, error } = await supabaseAdmin
    .from("interactions")
    .select(
      "id, comment_id, media_id, comment_text, generated_message, llm_model, status, last_error, sent_at, created_at, lead:leads(id, ig_scoped_id, ig_username, status)"
    )
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Falha ao listar interações: ${error.message}`);
  return (data ?? []) as unknown as InteractionWithLead[];
}

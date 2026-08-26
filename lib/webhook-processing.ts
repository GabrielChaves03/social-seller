import "server-only";
import { supabaseAdmin } from "./supabase-admin";
import { getAccountByIgUserId, type Account } from "./accounts";
import { evaluateCommentRelevance } from "./relevance-filter";
import { upsertLead } from "./leads";
import { enqueueInteraction } from "./queue";

type CommentChangeValue = {
  id: string;
  text?: string;
  from?: { id: string; username?: string };
  media?: { id: string };
};

export type WebhookEntry = {
  id: string; // ig_user_id da conta profissional dona da assinatura do webhook
  time?: number;
  changes?: Array<{ field: string; value: CommentChangeValue }>;
};

export async function processWebhookEntry(entry: WebhookEntry) {
  const account = await getAccountByIgUserId(entry.id);

  for (const change of entry.changes ?? []) {
    if (change.field !== "comments") continue;

    await logEvent(account?.id ?? null, change.value.from?.id ?? null, change.value);

    if (!account) continue; // evento de uma conta não configurada ou inativa
    await processComment(account, change.value);
  }
}

async function logEvent(accountId: string | null, igScopedId: string | null, payload: unknown) {
  await supabaseAdmin.from("events").insert({
    account_id: accountId,
    event_type: "comment",
    ig_scoped_id: igScopedId,
    raw_payload: payload,
  });
}

/**
 * Filtro de relevância -> lead -> enfileira a interação. A geração da DM
 * via LLM e o envio acontecem no drenador (lib/drain.ts), fora do
 * caminho da request, com rate limit por conta e trava de dedupe.
 */
async function processComment(account: Account, value: CommentChangeValue) {
  if (!value.from?.id || !value.id) return;

  const relevance = await evaluateCommentRelevance({
    accountId: account.id,
    mediaId: value.media?.id,
    commentText: value.text,
    igScopedId: value.from.id,
  });

  if (!relevance.relevant) return;

  const lead = await upsertLead({
    accountId: account.id,
    igScopedId: value.from.id,
    igUsername: value.from.username,
    commentText: value.text ?? "",
  });

  await enqueueInteraction({
    accountId: account.id,
    leadId: lead.id,
    commentId: value.id,
    mediaId: value.media?.id,
    commentText: value.text,
  });
}

import "server-only";
import { supabaseAdmin } from "./supabase-admin";
import { getAccountById, type Account } from "./accounts";
import { generateDmMessage } from "./llm";
import { sendMessage } from "./instagram";
import { updateLeadStatus } from "./leads";

const BATCH_SIZE = 20;
const MAX_SENT_PER_HOUR_PER_ACCOUNT = 200;
const DELAY_BETWEEN_SENDS_MS = 500; // ~2 por segundo

type ClaimedInteraction = {
  id: string;
  account_id: string;
  lead_id: string;
  comment_id: string;
  comment_text: string | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getSentLastHourCounts(accountIds: string[]): Promise<Map<string, number>> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const counts = new Map<string, number>();

  for (const accountId of accountIds) {
    const { count } = await supabaseAdmin
      .from("interactions")
      .select("id", { count: "exact", head: true })
      .eq("account_id", accountId)
      .eq("status", "sent")
      .gte("sent_at", oneHourAgo);
    counts.set(accountId, count ?? 0);
  }

  return counts;
}

async function markFailed(interactionId: string, message: string) {
  await supabaseAdmin
    .from("interactions")
    .update({ status: "failed", last_error: message })
    .eq("id", interactionId);
}

/** Devolve a interação para "pending" — usado quando o orçamento por hora da conta estourou. */
async function requeue(interactionId: string) {
  await supabaseAdmin
    .from("interactions")
    .update({ status: "pending", claimed_at: null })
    .eq("id", interactionId);
}

/**
 * Drena a fila: reivindica um lote de interações pendentes (trava
 * atômica no Postgres via `claim_pending_interactions`), gera a DM via
 * LLM e envia pela API do Instagram — respeitando um teto de ~200/hora
 * POR CONTA (cada conta tem seu próprio orçamento de API na Meta, não é
 * compartilhado). Itens que estourariam o limite voltam para "pending"
 * para a próxima chamada. Seguro para ser chamado concorrentemente (pelo
 * webhook via `after()` e pelo cron) — a trava garante que nada é
 * enviado 2x.
 */
export async function drainQueue() {
  const { data: claimed, error } = await supabaseAdmin.rpc("claim_pending_interactions", {
    p_batch_size: BATCH_SIZE,
  });

  if (error) throw new Error(`Falha ao reivindicar fila: ${error.message}`);
  const items = (claimed ?? []) as ClaimedInteraction[];
  if (items.length === 0) return { drained: 0, reason: "fila_vazia" as const };

  const accountIds = [...new Set(items.map((item) => item.account_id))];
  const sentCounts = await getSentLastHourCounts(accountIds);
  const accountCache = new Map<string, Account | null>();

  let sent = 0;

  for (const item of items) {
    const sentSoFar = sentCounts.get(item.account_id) ?? 0;
    if (sentSoFar >= MAX_SENT_PER_HOUR_PER_ACCOUNT) {
      await requeue(item.id);
      continue;
    }

    let account = accountCache.get(item.account_id);
    if (account === undefined) {
      account = await getAccountById(item.account_id);
      accountCache.set(item.account_id, account);
    }

    if (!account || !account.access_token || !account.ig_user_id) {
      await markFailed(item.id, "Conta sem access_token/ig_user_id configurado");
      continue;
    }

    try {
      const generatedMessage = await generateDmMessage({
        accountId: account.id,
        commentText: item.comment_text ?? "",
        personaTone: account.persona_tone,
        whatsappNumber: account.whatsapp_number,
      });

      await sendMessage({
        igUserId: account.ig_user_id,
        accessToken: account.access_token,
        recipient: { comment_id: item.comment_id },
        message: { text: generatedMessage },
      });

      await supabaseAdmin
        .from("interactions")
        .update({
          status: "sent",
          generated_message: generatedMessage,
          llm_model: "claude-opus-5",
          sent_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      await updateLeadStatus(item.lead_id, "abordado");
      sentCounts.set(item.account_id, sentSoFar + 1);
      sent += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      await markFailed(item.id, message);
    }

    await sleep(DELAY_BETWEEN_SENDS_MS);
  }

  return { drained: sent };
}

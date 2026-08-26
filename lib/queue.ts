import "server-only";
import { supabaseAdmin } from "./supabase-admin";

/**
 * Insere uma interação pendente na fila. Usa `dedupe_key` (coluna unique)
 * com ignoreDuplicates para nunca processar o mesmo comentário duas vezes
 * se o webhook da Meta reentregar o evento.
 */
export async function enqueueInteraction({
  accountId,
  leadId,
  commentId,
  mediaId,
  commentText,
}: {
  accountId: string;
  leadId: string;
  commentId: string;
  mediaId?: string | null;
  commentText?: string | null;
}) {
  const { error } = await supabaseAdmin.from("interactions").upsert(
    {
      account_id: accountId,
      lead_id: leadId,
      comment_id: commentId,
      media_id: mediaId ?? null,
      comment_text: commentText ?? null,
      status: "pending",
      dedupe_key: `interaction:${commentId}`,
    },
    { onConflict: "dedupe_key", ignoreDuplicates: true }
  );

  if (error) throw new Error(`Falha ao enfileirar interação: ${error.message}`);
}

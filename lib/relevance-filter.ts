import "server-only";
import { supabaseAdmin } from "./supabase-admin";
import { matchesKeywords, type MatchType } from "./text-match";

type AccountHook = {
  id: string;
  media_id: string | null;
  keywords: string[];
  match_type: MatchType;
};

type ExclusionRule = {
  id: string;
  rule_type: "min_comment_length" | "blacklist_keyword" | "exclude_lead_status";
  value: Record<string, unknown>;
};

export type RelevanceCheck = {
  accountId: string;
  mediaId: string | null | undefined;
  commentText: string | null | undefined;
  igScopedId: string;
};

export type RelevanceResult =
  | { relevant: true; matchedHookId: string }
  | { relevant: false; reason: "nenhum_gancho_correspondente" | "comentario_curto_demais" | "palavra_bloqueada" | "lead_em_status_excluido" };

async function getActiveHooks(accountId: string): Promise<AccountHook[]> {
  const { data, error } = await supabaseAdmin
    .from("account_hooks")
    .select("id, media_id, keywords, match_type")
    .eq("account_id", accountId)
    .eq("active", true);

  if (error) throw new Error(`Falha ao buscar hooks da conta: ${error.message}`);
  return data ?? [];
}

async function getExclusionRules(accountId: string): Promise<ExclusionRule[]> {
  const { data, error } = await supabaseAdmin
    .from("account_exclusion_rules")
    .select("id, rule_type, value")
    .eq("account_id", accountId);

  if (error) throw new Error(`Falha ao buscar regras de exclusão: ${error.message}`);
  return data ?? [];
}

/**
 * Filtro de relevância aplicado ANTES de qualquer chamada de LLM.
 * 1. O comentário precisa bater com algum gancho (palavra-chave) configurado
 *    para a conta, no post certo (ou em qualquer post, se o gancho não
 *    limita `media_id`).
 * 2. Se bateu, passa pelas regras de exclusão da conta — qualquer uma que
 *    dispare descarta o comentário.
 */
export async function evaluateCommentRelevance({
  accountId,
  mediaId,
  commentText,
  igScopedId,
}: RelevanceCheck): Promise<RelevanceResult> {
  const hooks = await getActiveHooks(accountId);

  const matchedHook = hooks.find(
    (hook) =>
      (!hook.media_id || hook.media_id === mediaId) &&
      matchesKeywords(commentText, hook.keywords, hook.match_type)
  );

  if (!matchedHook) {
    return { relevant: false, reason: "nenhum_gancho_correspondente" };
  }

  const rules = await getExclusionRules(accountId);
  const trimmedText = (commentText ?? "").trim();

  for (const rule of rules) {
    if (rule.rule_type === "min_comment_length") {
      const minLength = Number(rule.value.length ?? 0);
      if (trimmedText.length < minLength) {
        return { relevant: false, reason: "comentario_curto_demais" };
      }
    }

    if (rule.rule_type === "blacklist_keyword") {
      const blacklist = Array.isArray(rule.value.keywords) ? (rule.value.keywords as string[]) : [];
      if (matchesKeywords(trimmedText, blacklist, "contains")) {
        return { relevant: false, reason: "palavra_bloqueada" };
      }
    }

    if (rule.rule_type === "exclude_lead_status") {
      const excludedStatuses = Array.isArray(rule.value.statuses) ? (rule.value.statuses as string[]) : [];
      if (excludedStatuses.length === 0) continue;

      const { data: existingLead, error } = await supabaseAdmin
        .from("leads")
        .select("status")
        .eq("account_id", accountId)
        .eq("ig_scoped_id", igScopedId)
        .maybeSingle();

      if (error) throw new Error(`Falha ao buscar lead: ${error.message}`);
      if (existingLead && excludedStatuses.includes(existingLead.status)) {
        return { relevant: false, reason: "lead_em_status_excluido" };
      }
    }
  }

  return { relevant: true, matchedHookId: matchedHook.id };
}

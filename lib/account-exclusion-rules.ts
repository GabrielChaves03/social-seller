import "server-only";
import { supabaseAdmin } from "./supabase-admin";

export type ExclusionRuleType = "min_comment_length" | "blacklist_keyword" | "exclude_lead_status";

export type AccountExclusionRule = {
  id: string;
  account_id: string;
  rule_type: ExclusionRuleType;
  value: Record<string, unknown>;
};

export async function listAccountExclusionRules(accountId: string): Promise<AccountExclusionRule[]> {
  const { data, error } = await supabaseAdmin
    .from("account_exclusion_rules")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Falha ao listar regras de exclusão: ${error.message}`);
  return data ?? [];
}

export async function createAccountExclusionRule(input: {
  accountId: string;
  ruleType: ExclusionRuleType;
  value: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin.from("account_exclusion_rules").insert({
    account_id: input.accountId,
    rule_type: input.ruleType,
    value: input.value,
  });

  if (error) throw new Error(`Falha ao criar regra de exclusão: ${error.message}`);
}

export async function deleteAccountExclusionRule(id: string) {
  const { error } = await supabaseAdmin.from("account_exclusion_rules").delete().eq("id", id);
  if (error) throw new Error(`Falha ao excluir regra de exclusão: ${error.message}`);
}

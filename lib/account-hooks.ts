import "server-only";
import { supabaseAdmin } from "./supabase-admin";
import type { MatchType } from "./text-match";

export type { MatchType };

export type AccountHook = {
  id: string;
  account_id: string;
  media_id: string | null;
  media_permalink: string | null;
  keywords: string[];
  match_type: MatchType;
  active: boolean;
};

export type AccountHookInput = {
  accountId: string;
  mediaId?: string | null;
  mediaPermalink?: string | null;
  keywords: string[];
  matchType: MatchType;
  active: boolean;
};

export async function listAccountHooks(accountId: string): Promise<AccountHook[]> {
  const { data, error } = await supabaseAdmin
    .from("account_hooks")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Falha ao listar ganchos: ${error.message}`);
  return data ?? [];
}

export async function createAccountHook(input: AccountHookInput) {
  const { error } = await supabaseAdmin.from("account_hooks").insert({
    account_id: input.accountId,
    media_id: input.mediaId || null,
    media_permalink: input.mediaPermalink || null,
    keywords: input.keywords,
    match_type: input.matchType,
    active: input.active,
  });

  if (error) throw new Error(`Falha ao criar gancho: ${error.message}`);
}

export async function deleteAccountHook(id: string) {
  const { error } = await supabaseAdmin.from("account_hooks").delete().eq("id", id);
  if (error) throw new Error(`Falha ao excluir gancho: ${error.message}`);
}

export async function toggleAccountHookActive(id: string, active: boolean) {
  const { error } = await supabaseAdmin.from("account_hooks").update({ active }).eq("id", id);
  if (error) throw new Error(`Falha ao atualizar gancho: ${error.message}`);
}

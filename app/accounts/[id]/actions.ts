"use server";

import { revalidatePath } from "next/cache";
import { createAccountProduct, deleteAccountProduct } from "@/lib/accounts";
import {
  createAccountHook,
  deleteAccountHook,
  toggleAccountHookActive,
  type MatchType,
} from "@/lib/account-hooks";
import {
  createAccountExclusionRule,
  deleteAccountExclusionRule,
  type ExclusionRuleType,
} from "@/lib/account-exclusion-rules";
import { updateLeadStatus, type LeadStatus } from "@/lib/leads";

function splitLines(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") return [];
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export async function createProductAction(accountId: string, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const painPoints = String(formData.get("pain_points") ?? "").trim();
  if (!name || !painPoints) throw new Error("Nome e dores do produto são obrigatórios");

  await createAccountProduct({ accountId, name, painPoints });
  revalidatePath(`/accounts/${accountId}`);
}

export async function deleteProductAction(accountId: string, productId: string) {
  await deleteAccountProduct(productId);
  revalidatePath(`/accounts/${accountId}`);
}

export async function createHookAction(accountId: string, formData: FormData) {
  const keywords = splitLines(formData.get("keywords"));
  const matchType = (formData.get("match_type") as MatchType) ?? "contains";
  if (matchType !== "any" && keywords.length === 0) {
    throw new Error("Informe pelo menos uma palavra-gancho");
  }

  await createAccountHook({
    accountId,
    mediaId: (formData.get("media_id") as string) || null,
    keywords,
    matchType,
    active: true,
  });
  revalidatePath(`/accounts/${accountId}`);
}

export async function deleteHookAction(accountId: string, hookId: string) {
  await deleteAccountHook(hookId);
  revalidatePath(`/accounts/${accountId}`);
}

export async function toggleHookActiveAction(accountId: string, hookId: string, active: boolean) {
  await toggleAccountHookActive(hookId, active);
  revalidatePath(`/accounts/${accountId}`);
}

export async function createExclusionRuleAction(accountId: string, formData: FormData) {
  const ruleType = formData.get("rule_type") as ExclusionRuleType;

  let value: Record<string, unknown>;
  if (ruleType === "min_comment_length") {
    const length = Number(formData.get("length") ?? 0);
    if (!length || length < 1) throw new Error("Informe um comprimento mínimo válido");
    value = { length };
  } else if (ruleType === "blacklist_keyword") {
    const keywords = splitLines(formData.get("keywords"));
    if (keywords.length === 0) throw new Error("Informe pelo menos uma palavra bloqueada");
    value = { keywords };
  } else if (ruleType === "exclude_lead_status") {
    const statuses = formData.getAll("statuses").map(String);
    if (statuses.length === 0) throw new Error("Selecione pelo menos um status");
    value = { statuses };
  } else {
    throw new Error("Tipo de regra inválido");
  }

  await createAccountExclusionRule({ accountId, ruleType, value });
  revalidatePath(`/accounts/${accountId}`);
}

export async function deleteExclusionRuleAction(accountId: string, ruleId: string) {
  await deleteAccountExclusionRule(ruleId);
  revalidatePath(`/accounts/${accountId}`);
}

export async function updateLeadStatusAction(accountId: string, leadId: string, formData: FormData) {
  const status = formData.get("status") as LeadStatus;
  await updateLeadStatus(leadId, status);
  revalidatePath(`/accounts/${accountId}/leads`);
}

import "server-only";
import { supabaseAdmin } from "./supabase-admin";

export type Account = {
  id: string;
  slug: string;
  ig_user_id: string | null;
  ig_username: string | null;
  ig_profile_picture_url: string | null;
  access_token: string | null;
  token_expires_at: string | null;
  connected_at: string | null;
  whatsapp_number: string;
  persona_tone: string;
  active: boolean;
  created_at: string;
};

/**
 * Identifica a qual conta configurada um evento de webhook pertence.
 * No payload da Meta, `entry.id` é o ig_user_id da conta profissional
 * dona da assinatura do webhook — é por esse campo que roteamos o
 * evento para a `account` certa (cada conta tem seu próprio token,
 * persona, produtos e regras).
 */
export async function getAccountByIgUserId(igUserId: string): Promise<Account | null> {
  const { data, error } = await supabaseAdmin
    .from("accounts")
    .select("*")
    .eq("ig_user_id", igUserId)
    .eq("active", true)
    .maybeSingle();

  if (error) throw new Error(`Falha ao buscar conta: ${error.message}`);
  return data;
}

/** Busca uma conta pelo id interno — usado pelo drenador da fila e pelo painel. */
export async function getAccountById(accountId: string): Promise<Account | null> {
  const { data, error } = await supabaseAdmin
    .from("accounts")
    .select("*")
    .eq("id", accountId)
    .maybeSingle();

  if (error) throw new Error(`Falha ao buscar conta: ${error.message}`);
  return data;
}

/** Lista todas as contas (ativas ou não) — usado pelo painel. */
export async function listAccounts(): Promise<Account[]> {
  const { data, error } = await supabaseAdmin
    .from("accounts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Falha ao listar contas: ${error.message}`);
  return data ?? [];
}

export type AccountInput = {
  slug: string;
  igUserId?: string | null;
  igUsername?: string | null;
  /** Deixe em branco numa edição para manter o token atual sem alterá-lo. */
  accessToken?: string | null;
  tokenExpiresAt?: string | null;
  whatsappNumber: string;
  personaTone: string;
  active: boolean;
};

export async function createAccount(input: AccountInput): Promise<Account> {
  const { data, error } = await supabaseAdmin
    .from("accounts")
    .insert({
      slug: input.slug,
      ig_user_id: input.igUserId || null,
      ig_username: input.igUsername || null,
      access_token: input.accessToken || null,
      token_expires_at: input.tokenExpiresAt || null,
      connected_at: input.accessToken ? new Date().toISOString() : null,
      whatsapp_number: input.whatsappNumber,
      persona_tone: input.personaTone,
      active: input.active,
    })
    .select()
    .single();

  if (error || !data) throw new Error(`Falha ao criar conta: ${error?.message}`);
  return data;
}

export async function updateAccount(id: string, input: AccountInput): Promise<Account> {
  const row: Record<string, unknown> = {
    slug: input.slug,
    ig_user_id: input.igUserId || null,
    ig_username: input.igUsername || null,
    whatsapp_number: input.whatsappNumber,
    persona_tone: input.personaTone,
    active: input.active,
    updated_at: new Date().toISOString(),
  };

  // Só sobrescreve o token se um valor novo foi informado — evita apagar
  // um token válido só porque o campo ficou em branco no formulário.
  if (input.accessToken) {
    row.access_token = input.accessToken;
    row.token_expires_at = input.tokenExpiresAt || null;
    row.connected_at = new Date().toISOString();
  }

  const { data, error } = await supabaseAdmin
    .from("accounts")
    .update(row)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) throw new Error(`Falha ao atualizar conta: ${error?.message}`);
  return data;
}

/** Contagens rápidas para o painel — sem carregar as listas inteiras. */
export async function getAccountStats(accountId: string) {
  const [{ count: leadsCount }, { count: sentCount }] = await Promise.all([
    supabaseAdmin.from("leads").select("id", { count: "exact", head: true }).eq("account_id", accountId),
    supabaseAdmin
      .from("interactions")
      .select("id", { count: "exact", head: true })
      .eq("account_id", accountId)
      .eq("status", "sent"),
  ]);

  return { leadsCount: leadsCount ?? 0, sentCount: sentCount ?? 0 };
}

export type AccountProduct = {
  id: string;
  account_id: string;
  name: string;
  pain_points: string;
};

/**
 * Produtos/soluções da conta e as dores que cada um resolve. Entra no
 * prompt de geração da DM para embasar a validação da dor da pessoa.
 */
export async function getAccountProducts(accountId: string): Promise<AccountProduct[]> {
  const { data, error } = await supabaseAdmin
    .from("account_products")
    .select("*")
    .eq("account_id", accountId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Falha ao buscar produtos da conta: ${error.message}`);
  return data ?? [];
}

export async function createAccountProduct(input: {
  accountId: string;
  name: string;
  painPoints: string;
}) {
  const { error } = await supabaseAdmin.from("account_products").insert({
    account_id: input.accountId,
    name: input.name,
    pain_points: input.painPoints,
  });

  if (error) throw new Error(`Falha ao criar produto: ${error.message}`);
}

export async function deleteAccountProduct(id: string) {
  const { error } = await supabaseAdmin.from("account_products").delete().eq("id", id);
  if (error) throw new Error(`Falha ao excluir produto: ${error.message}`);
}

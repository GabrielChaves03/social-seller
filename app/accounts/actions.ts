"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createAccount, updateAccount, type AccountInput } from "@/lib/accounts";

function parseAccountForm(formData: FormData): AccountInput {
  const tokenExpiresAtRaw = String(formData.get("token_expires_at") ?? "");

  return {
    slug: String(formData.get("slug") ?? "").trim(),
    igUserId: (formData.get("ig_user_id") as string) || null,
    igUsername: (formData.get("ig_username") as string) || null,
    accessToken: (formData.get("access_token") as string) || null,
    tokenExpiresAt: tokenExpiresAtRaw ? new Date(tokenExpiresAtRaw).toISOString() : null,
    whatsappNumber: String(formData.get("whatsapp_number") ?? "").trim(),
    personaTone: String(formData.get("persona_tone") ?? "").trim(),
    active: formData.get("active") === "on",
  };
}

function validate(input: AccountInput) {
  if (!input.slug) throw new Error("Identificador (slug) é obrigatório");
  if (!input.whatsappNumber) throw new Error("Número do WhatsApp é obrigatório");
  if (!input.personaTone) throw new Error("Persona/tom de voz é obrigatório");
}

export async function createAccountAction(formData: FormData) {
  const input = parseAccountForm(formData);
  validate(input);

  const account = await createAccount(input);
  revalidatePath("/");
  redirect(`/accounts/${account.id}`);
}

export async function updateAccountAction(id: string, formData: FormData) {
  const input = parseAccountForm(formData);
  validate(input);

  await updateAccount(id, input);
  revalidatePath("/");
  revalidatePath(`/accounts/${id}`);
  redirect(`/accounts/${id}`);
}

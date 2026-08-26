import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "./supabase-admin";
import { getAccountProducts } from "./accounts";

// Sem temperature: a Claude API não aceita temperature/top_p/top_k no
// claude-opus-5 (400 se enviado). A variação entre mensagens vem do
// prompt — instrução explícita de redigir do zero + as últimas mensagens
// já enviadas passadas como "não repita isto", não de um parâmetro de
// amostragem.
const MODEL = "claude-opus-5";
const RECENT_MESSAGES_LIMIT = 5;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}

const anthropic = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });

async function getRecentGeneratedMessages(accountId: string, limit: number): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from("interactions")
    .select("generated_message")
    .eq("account_id", accountId)
    .not("generated_message", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Falha ao buscar mensagens recentes: ${error.message}`);
  return (data ?? [])
    .map((row) => row.generated_message as string | null)
    .filter((text): text is string => Boolean(text));
}

function buildSystemPrompt({
  personaTone,
  whatsappNumber,
}: {
  personaTone: string;
  whatsappNumber: string;
}): string {
  return `Você escreve a primeira mensagem de uma DM do Instagram para uma marca, a partir de um comentário público que a pessoa deixou no post.

Seu único objetivo aqui é: (1) mostrar que leu o comentário de verdade, referenciando especificamente o que a pessoa descreveu — nunca de forma genérica; (2) validar que aquela dor é comum e que a marca sabe resolver; (3) convidar a pessoa a continuar a conversa no WhatsApp.

Regras rígidas:
- NUNCA explique a solução, o produto ou preço no direct — isso fica inteiramente para a conversa no WhatsApp.
- Sempre termine a mensagem convidando para o WhatsApp e incluindo o número: ${whatsappNumber}.
- Tom de voz da marca: ${personaTone}.
- Mensagem curta (2 a 4 frases), como uma pessoa real da equipe escreveria — nunca como um template preenchido.
- Redija do zero a cada chamada: varie vocabulário, ordem das frases e construção em relação às mensagens anteriores enviadas por esta conta (elas vêm listadas abaixo, quando existirem — não repita a estrutura delas).

Responda apenas com o texto da mensagem, sem aspas, sem explicações adicionais.`;
}

export type GenerateDmMessageParams = {
  accountId: string;
  commentText: string;
  postCaption?: string | null;
  personaTone: string;
  whatsappNumber: string;
};

/**
 * Gera a mensagem de abertura da DM via Claude API. Cada chamada busca os
 * produtos/dores da conta e as últimas mensagens já enviadas (para o
 * modelo evitar repetir vocabulário/estrutura) e monta um prompt novo —
 * nunca preenche um template fixo.
 */
export async function generateDmMessage({
  accountId,
  commentText,
  postCaption,
  personaTone,
  whatsappNumber,
}: GenerateDmMessageParams): Promise<string> {
  const [products, recentMessages] = await Promise.all([
    getAccountProducts(accountId),
    getRecentGeneratedMessages(accountId, RECENT_MESSAGES_LIMIT),
  ]);

  const productsBlock = products.length
    ? products.map((p) => `- ${p.name}: ${p.pain_points}`).join("\n")
    : "Nenhum produto cadastrado — valide a dor de forma genérica, sem citar solução específica.";

  const recentBlock = recentMessages.length
    ? `Últimas mensagens já enviadas por esta conta — NÃO repita a estrutura, a ordem das frases ou o vocabulário delas:\n${recentMessages
        .map((message, index) => `${index + 1}. ${message}`)
        .join("\n")}`
    : null;

  const userPrompt = [
    `Comentário da pessoa no post: "${commentText}"`,
    postCaption ? `Contexto do post: ${postCaption}` : null,
    `Produtos/dores que a marca resolve:\n${productsBlock}`,
    recentBlock,
    "Escreva agora a mensagem de abertura da DM.",
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n\n");

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    output_config: { effort: "medium" },
    system: buildSystemPrompt({ personaTone, whatsappNumber }),
    messages: [{ role: "user", content: userPrompt }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Geração da DM recusada pelo modelo (safety classifier).");
  }

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Resposta do modelo não contém bloco de texto.");
  }

  return textBlock.text.trim();
}

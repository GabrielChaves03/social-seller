import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccountById, getAccountProducts } from "@/lib/accounts";
import { listAccountHooks } from "@/lib/account-hooks";
import { listAccountExclusionRules, type AccountExclusionRule } from "@/lib/account-exclusion-rules";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, type LeadStatus } from "@/lib/leads";
import AccountForm from "../AccountForm";
import { updateAccountAction } from "../actions";
import {
  createProductAction,
  deleteProductAction,
  createHookAction,
  deleteHookAction,
  toggleHookActiveAction,
  createExclusionRuleAction,
  deleteExclusionRuleAction,
} from "./actions";

const sectionClass = "space-y-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800";
const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900";
const labelClass = "block text-sm font-medium mb-1";
const smallButtonClass =
  "rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800";

export const dynamic = "force-dynamic";

function describeExclusionRule(rule: AccountExclusionRule): string {
  if (rule.rule_type === "min_comment_length") {
    return `Ignora comentários com menos de ${rule.value.length} caracteres`;
  }
  if (rule.rule_type === "blacklist_keyword") {
    const keywords = Array.isArray(rule.value.keywords) ? rule.value.keywords.join(", ") : "";
    return `Ignora comentários com: ${keywords}`;
  }
  if (rule.rule_type === "exclude_lead_status") {
    const statuses = Array.isArray(rule.value.statuses)
      ? rule.value.statuses
          .map((status: string) => LEAD_STATUS_LABELS[status as LeadStatus] ?? status)
          .join(", ")
      : "";
    return `Não aborda leads com status: ${statuses}`;
  }
  return "Regra desconhecida";
}

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = await getAccountById(id);
  if (!account) notFound();

  const [products, hooks, exclusionRules] = await Promise.all([
    getAccountProducts(id),
    listAccountHooks(id),
    listAccountExclusionRules(id),
  ]);

  const updateAction = updateAccountAction.bind(null, id);
  const createProduct = createProductAction.bind(null, id);
  const createHook = createHookAction.bind(null, id);
  const createExclusionRule = createExclusionRuleAction.bind(null, id);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-blue-600 underline dark:text-blue-400">
            ← Painel
          </Link>
          <h1 className="mt-2 text-2xl font-bold">
            {account.ig_username ? `@${account.ig_username}` : account.slug}
          </h1>
        </div>
        <Link href={`/accounts/${id}/leads`} className={smallButtonClass}>
          Ver mensagens
        </Link>
      </div>

      <div className="mb-6">
        <AccountForm
          action={updateAction}
          submitLabel="Salvar conta"
          hasToken={Boolean(account.access_token)}
          initial={{
            slug: account.slug,
            ig_user_id: account.ig_user_id,
            ig_username: account.ig_username,
            whatsapp_number: account.whatsapp_number,
            persona_tone: account.persona_tone,
            active: account.active,
            token_expires_at: account.token_expires_at,
          }}
        />
      </div>

      <section className={`${sectionClass} mb-6`}>
        <h2 className="font-semibold">Produtos / dores que a marca resolve</h2>
        {products.length === 0 && (
          <p className="text-sm text-neutral-500">Nenhum produto cadastrado ainda.</p>
        )}
        <ul className="space-y-2">
          {products.map((product) => {
            const del = deleteProductAction.bind(null, id, product.id);
            return (
              <li
                key={product.id}
                className="flex items-start justify-between gap-3 rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800"
              >
                <div>
                  <p className="font-medium">{product.name}</p>
                  <p className="text-neutral-500">{product.pain_points}</p>
                </div>
                <form action={del}>
                  <button type="submit" className="text-xs text-red-600 hover:underline dark:text-red-400">
                    Excluir
                  </button>
                </form>
              </li>
            );
          })}
        </ul>

        <form action={createProduct} className="space-y-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <div>
            <label className={labelClass} htmlFor="name">
              Nome do produto
            </label>
            <input id="name" name="name" required className={inputClass} placeholder="Consultoria de pele" />
          </div>
          <div>
            <label className={labelClass} htmlFor="pain_points">
              Dores que resolve
            </label>
            <textarea
              id="pain_points"
              name="pain_points"
              rows={2}
              required
              className={inputClass}
              placeholder="acne persistente, insegurança pra sair sem maquiagem"
            />
          </div>
          <button type="submit" className={smallButtonClass}>
            + Adicionar produto
          </button>
        </form>
      </section>

      <section className={`${sectionClass} mb-6`}>
        <h2 className="font-semibold">Ganchos (posts monitorados + palavras-chave)</h2>
        {hooks.length === 0 && (
          <p className="text-sm text-neutral-500">
            Nenhum gancho cadastrado ainda — nenhum comentário será abordado até que exista um.
          </p>
        )}
        <ul className="space-y-2">
          {hooks.map((hook) => {
            const del = deleteHookAction.bind(null, id, hook.id);
            const toggle = toggleHookActiveAction.bind(null, id, hook.id, !hook.active);
            return (
              <li
                key={hook.id}
                className="flex items-start justify-between gap-3 rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800"
              >
                <div>
                  <p className="font-medium">{hook.media_id ? `Post ${hook.media_id}` : "Qualquer post da conta"}</p>
                  <p className="text-neutral-500">
                    {hook.match_type === "any"
                      ? "Qualquer comentário"
                      : `${hook.match_type === "exact" ? "É exatamente" : "Contém"}: ${hook.keywords.join(", ")}`}
                  </p>
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      hook.active
                        ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                        : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                    }`}
                  >
                    {hook.active ? "Ativo" : "Pausado"}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <form action={toggle}>
                    <button type="submit" className="text-xs text-blue-600 hover:underline dark:text-blue-400">
                      {hook.active ? "Pausar" : "Ativar"}
                    </button>
                  </form>
                  <form action={del}>
                    <button type="submit" className="text-xs text-red-600 hover:underline dark:text-red-400">
                      Excluir
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>

        <form action={createHook} className="space-y-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <div>
            <label className={labelClass} htmlFor="media_id">
              ID do post (opcional — em branco monitora todos os posts)
            </label>
            <input id="media_id" name="media_id" className={inputClass} placeholder="17900000000000000" />
          </div>
          <div>
            <label className={labelClass} htmlFor="keywords">
              Palavras-gancho (uma por linha)
            </label>
            <textarea
              id="keywords"
              name="keywords"
              rows={3}
              className={inputClass}
              placeholder={"quero\ncomo faço\nme ajuda"}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="match_type">
              Tipo de correspondência
            </label>
            <select id="match_type" name="match_type" defaultValue="contains" className={inputClass}>
              <option value="contains">Contém a palavra</option>
              <option value="exact">É exatamente a palavra</option>
              <option value="any">Qualquer comentário</option>
            </select>
          </div>
          <button type="submit" className={smallButtonClass}>
            + Adicionar gancho
          </button>
        </form>
      </section>

      <section className={sectionClass}>
        <h2 className="font-semibold">Regras de exclusão</h2>
        {exclusionRules.length === 0 && (
          <p className="text-sm text-neutral-500">Nenhuma regra cadastrada.</p>
        )}
        <ul className="space-y-2">
          {exclusionRules.map((rule) => {
            const del = deleteExclusionRuleAction.bind(null, id, rule.id);
            return (
              <li
                key={rule.id}
                className="flex items-start justify-between gap-3 rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800"
              >
                <p>{describeExclusionRule(rule)}</p>
                <form action={del}>
                  <button type="submit" className="text-xs text-red-600 hover:underline dark:text-red-400">
                    Excluir
                  </button>
                </form>
              </li>
            );
          })}
        </ul>

        <div className="grid grid-cols-1 gap-4 border-t border-neutral-200 pt-4 sm:grid-cols-3 dark:border-neutral-800">
          <form action={createExclusionRule} className="space-y-2">
            <input type="hidden" name="rule_type" value="min_comment_length" />
            <label className={labelClass} htmlFor="length">
              Comprimento mínimo
            </label>
            <input id="length" name="length" type="number" min={1} className={inputClass} placeholder="8" />
            <button type="submit" className={smallButtonClass}>
              + Adicionar
            </button>
          </form>

          <form action={createExclusionRule} className="space-y-2">
            <input type="hidden" name="rule_type" value="blacklist_keyword" />
            <label className={labelClass} htmlFor="blacklist_keywords">
              Bloquear palavras (uma por linha)
            </label>
            <textarea
              id="blacklist_keywords"
              name="keywords"
              rows={3}
              className={inputClass}
              placeholder={"spam\nvende seguidor"}
            />
            <button type="submit" className={smallButtonClass}>
              + Adicionar
            </button>
          </form>

          <form action={createExclusionRule} className="space-y-2">
            <input type="hidden" name="rule_type" value="exclude_lead_status" />
            <span className={labelClass}>Não abordar leads com status</span>
            <div className="space-y-1">
              {LEAD_STATUSES.map((status) => (
                <label key={status} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="statuses" value={status} />
                  {LEAD_STATUS_LABELS[status]}
                </label>
              ))}
            </div>
            <button type="submit" className={smallButtonClass}>
              + Adicionar
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

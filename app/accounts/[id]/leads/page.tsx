import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccountById } from "@/lib/accounts";
import { listInteractionsForAccount, type InteractionStatus } from "@/lib/interactions";
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from "@/lib/leads";
import { formatDateTimeBR } from "@/lib/format";
import { updateLeadStatusAction } from "../actions";

const statusBadgeClass: Record<InteractionStatus, string> = {
  sent: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  pending: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
  sending: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  skipped: "bg-neutral-100 text-neutral-500 dark:bg-neutral-800",
};

const statusLabel: Record<InteractionStatus, string> = {
  sent: "Enviada",
  pending: "Pendente",
  sending: "Enviando",
  failed: "Falhou",
  skipped: "Ignorada",
};

export const dynamic = "force-dynamic";

export default async function AccountLeadsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = await getAccountById(id);
  if (!account) notFound();

  const interactions = await listInteractionsForAccount(id);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <Link href={`/accounts/${id}`} className="text-sm text-blue-600 underline dark:text-blue-400">
          ← {account.ig_username ? `@${account.ig_username}` : account.slug}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Mensagens</h1>
      </div>

      {interactions.length === 0 && (
        <p className="text-sm text-neutral-500">Nenhum comentário relevante processado ainda.</p>
      )}

      <ul className="space-y-3">
        {interactions.map((interaction) => {
          const updateStatus = interaction.lead
            ? updateLeadStatusAction.bind(null, id, interaction.lead.id)
            : null;

          return (
            <li
              key={interaction.id}
              className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">
                    {interaction.lead?.ig_username
                      ? `@${interaction.lead.ig_username}`
                      : interaction.lead?.ig_scoped_id ?? "desconhecido"}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass[interaction.status]}`}
                  >
                    {statusLabel[interaction.status]}
                  </span>
                </div>
                <span className="text-xs text-neutral-500">
                  {formatDateTimeBR(interaction.sent_at ?? interaction.created_at)}
                </span>
              </div>

              {interaction.comment_text && (
                <p className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">
                  <span className="font-medium">Comentário:</span> &ldquo;{interaction.comment_text}&rdquo;
                </p>
              )}

              {interaction.generated_message ? (
                <p className="mb-2 rounded-md bg-neutral-50 p-3 text-sm dark:bg-neutral-900">
                  {interaction.generated_message}
                </p>
              ) : (
                <p className="mb-2 text-sm text-neutral-500">Mensagem ainda não gerada.</p>
              )}

              {interaction.status === "failed" && interaction.last_error && (
                <p className="mb-2 text-sm text-red-600 dark:text-red-400">Erro: {interaction.last_error}</p>
              )}

              {updateStatus && interaction.lead && (
                <form action={updateStatus} className="flex flex-wrap items-center gap-2">
                  <label className="text-xs text-neutral-500" htmlFor={`status-${interaction.id}`}>
                    Status do lead
                  </label>
                  <select
                    id={`status-${interaction.id}`}
                    name="status"
                    defaultValue={interaction.lead.status}
                    className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900"
                  >
                    {LEAD_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {LEAD_STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded-md border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
                  >
                    Salvar
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}

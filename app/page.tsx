import Link from "next/link";
import { listAccounts, getAccountStats } from "@/lib/accounts";

// Sempre busca dados frescos do banco — nunca faz sentido servir uma
// lista de contas/estatísticas cacheada estaticamente do build.
export const dynamic = "force-dynamic";

export default async function Home() {
  const accounts = await listAccounts();
  const stats = await Promise.all(accounts.map((account) => getAccountStats(account.id)));

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Social Seller</h1>
        <Link
          href="/accounts/novo"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + Nova conta
        </Link>
      </div>

      {accounts.length === 0 && (
        <p className="text-sm text-neutral-500">Nenhuma conta cadastrada ainda.</p>
      )}

      <ul className="space-y-3">
        {accounts.map((account, index) => (
          <li
            key={account.id}
            className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800"
          >
            <div>
              <div className="flex items-center gap-2">
                <Link href={`/accounts/${account.id}`} className="font-semibold hover:underline">
                  {account.ig_username ? `@${account.ig_username}` : account.slug}
                </Link>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    account.active
                      ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                      : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                  }`}
                >
                  {account.active ? "Ativa" : "Pausada"}
                </span>
                {!account.access_token && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                    Sem token
                  </span>
                )}
              </div>
              <p className="text-sm text-neutral-500">
                {account.slug} · WhatsApp {account.whatsapp_number}
              </p>
              <p className="text-sm text-neutral-500">
                {stats[index].leadsCount} leads · {stats[index].sentCount} mensagens enviadas
              </p>
            </div>

            <div className="flex gap-2">
              <Link
                href={`/accounts/${account.id}/leads`}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                Mensagens
              </Link>
              <Link
                href={`/accounts/${account.id}`}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                Editar
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

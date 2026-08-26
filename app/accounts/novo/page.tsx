import Link from "next/link";
import AccountForm from "../AccountForm";
import { createAccountAction } from "../actions";

export default function NovaContaPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/" className="text-sm text-blue-600 underline dark:text-blue-400">
        ← Painel
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-bold">Nova conta</h1>
      <AccountForm action={createAccountAction} submitLabel="Criar conta" />
    </main>
  );
}

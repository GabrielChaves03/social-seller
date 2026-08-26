import "server-only";
import type { NextRequest } from "next/server";

/**
 * O endpoint de cron é público na internet (o agendador bate nele por
 * HTTP). Exigimos um segredo compartilhado para que ninguém mais
 * consiga forçar a drenagem da fila.
 */
export function isAuthorizedCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const provided =
    request.nextUrl.searchParams.get("secret") ?? request.headers.get("x-cron-secret");

  return provided === secret;
}

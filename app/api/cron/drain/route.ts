import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { drainQueue } from "@/lib/drain";

// Backup do envio disparado pelo webhook — cobre o caso de o `after()`
// da request falhar ou não rodar. Chamado por um agendador externo
// (pg_cron do Supabase, Vercel Cron, etc.) a cada 1-2 minutos.
export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const result = await drainQueue();
  return NextResponse.json(result);
}

export async function GET(request: NextRequest) {
  return POST(request);
}

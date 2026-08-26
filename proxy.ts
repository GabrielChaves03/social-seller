import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rotas que precisam continuar públicas mesmo com o painel protegido:
// - /api/webhook: a Meta chama direto, sem navegador (validado por assinatura HMAC)
// - /api/cron: o agendador externo chama direto (protegido por CRON_SECRET)
const PUBLIC_PATHS = ["/api/webhook", "/api/cron"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const user = process.env.DASHBOARD_USER;
  const password = process.env.DASHBOARD_PASSWORD;

  if (!user || !password) {
    // Em produção, nunca deixar o painel aberto por credencial ausente.
    if (process.env.VERCEL) {
      return new NextResponse(
        "DASHBOARD_USER e DASHBOARD_PASSWORD precisam estar configurados nas variáveis de ambiente.",
        { status: 500 }
      );
    }
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Basic ")) {
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    const providedUser = decoded.slice(0, separatorIndex);
    const providedPassword = decoded.slice(separatorIndex + 1);

    if (providedUser === user && providedPassword === password) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Autenticação necessária", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="painel"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

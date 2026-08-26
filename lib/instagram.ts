import "server-only";

// Portado do manychat-clone (lib/instagram.ts). Já era escrito de forma
// multi-tenant-friendly: toda chamada que fala com uma conta recebe
// `accessToken`/`igUserId` como parâmetro, em vez de ler de uma config
// singleton — só o app OAuth (client id/secret) é global, porque é o
// mesmo Meta App recebendo a conexão de várias contas Instagram.

const API_VERSION = "v25.0";
const GRAPH_BASE = `https://graph.instagram.com/${API_VERSION}`;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}

export function buildAuthorizeUrl(state: string): string {
  const clientId = requireEnv("INSTAGRAM_APP_ID");
  const redirectUri = `${requireEnv("NEXT_PUBLIC_APP_URL")}/api/oauth/callback`;
  const scope = [
    "instagram_business_basic",
    "instagram_business_manage_messages",
    "instagram_business_manage_comments",
  ].join(",");

  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scope);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCodeForShortLivedToken(code: string) {
  const clientId = requireEnv("INSTAGRAM_APP_ID");
  const clientSecret = requireEnv("INSTAGRAM_APP_SECRET");
  const redirectUri = `${requireEnv("NEXT_PUBLIC_APP_URL")}/api/oauth/callback`;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code,
  });

  const res = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    body,
  });

  if (!res.ok) {
    throw new Error(`Falha ao trocar code por token curto: ${await res.text()}`);
  }

  return (await res.json()) as {
    access_token: string;
    user_id: number;
    permissions: string[];
  };
}

export async function exchangeForLongLivedToken(shortLivedToken: string) {
  const clientSecret = requireEnv("INSTAGRAM_APP_SECRET");

  const url = new URL(`${GRAPH_BASE}/access_token`);
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("access_token", shortLivedToken);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Falha ao trocar por token longo: ${await res.text()}`);
  }

  return (await res.json()) as {
    access_token: string;
    token_type: string;
    expires_in: number; // segundos, ~60 dias
  };
}

export async function refreshLongLivedToken(longLivedToken: string) {
  const url = new URL(`${GRAPH_BASE}/refresh_access_token`);
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", longLivedToken);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Falha ao renovar token: ${await res.text()}`);
  }

  return (await res.json()) as {
    access_token: string;
    token_type: string;
    expires_in: number;
  };
}

export async function getProfile(accessToken: string) {
  const url = new URL(`${GRAPH_BASE}/me`);
  url.searchParams.set(
    "fields",
    "user_id,username,name,profile_picture_url"
  );
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Falha ao buscar perfil: ${await res.text()}`);
  }

  return (await res.json()) as {
    user_id: string;
    username: string;
    name?: string;
    profile_picture_url?: string;
  };
}

export async function subscribeWebhooks(igUserId: string, accessToken: string) {
  const url = new URL(`${GRAPH_BASE}/${igUserId}/subscribed_apps`);
  url.searchParams.set("subscribed_fields", "comments");
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString(), { method: "POST" });
  if (!res.ok) {
    throw new Error(`Falha ao assinar webhooks: ${await res.text()}`);
  }

  return (await res.json()) as { success: boolean };
}

export async function getMedia(igUserId: string, accessToken: string) {
  const url = new URL(`${GRAPH_BASE}/${igUserId}/media`);
  url.searchParams.set(
    "fields",
    "id,media_type,media_url,thumbnail_url,caption,permalink"
  );
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Falha ao buscar mídia: ${await res.text()}`);
  }

  return (await res.json()) as {
    data: Array<{
      id: string;
      media_type: string;
      media_url?: string;
      thumbnail_url?: string;
      caption?: string;
      permalink: string;
    }>;
  };
}

type SendMessagePayload = {
  igUserId: string;
  accessToken: string;
  recipient: { comment_id: string } | { id: string };
  message: {
    text?: string;
  };
};

export async function sendMessage({
  igUserId,
  accessToken,
  recipient,
  message,
}: SendMessagePayload) {
  const url = new URL(`${GRAPH_BASE}/${igUserId}/messages`);
  url.searchParams.set("access_token", accessToken);

  const body: Record<string, unknown> = { recipient, message };

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Falha ao enviar mensagem: ${await res.text()}`);
  }

  return (await res.json()) as { recipient_id?: string; message_id?: string };
}

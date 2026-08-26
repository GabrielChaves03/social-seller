# Social Seller

Agente proativo que escuta comentários no Instagram, filtra os relevantes antes de gastar chamada de LLM, gera uma DM personalizada com Claude (referenciando a dor do comentário + validação + convite pro WhatsApp da marca) e envia — registrando tudo em `leads`/`interactions`.

Multi-conta desde o início: cada conta Instagram plugada tem seu próprio token, persona, produtos/dores, ganchos de post e regras de exclusão. Tudo isso — além dos leads e mensagens geradas — é gerenciado pelo painel web (protegido por autenticação básica).

Projeto **completamente separado** do manychat-clone: processo, porta (3100), banco Supabase e deploy próprios. Nenhum código daquele projeto é tocado ou compartilhado aqui.

## Requisitos

- Node.js 20+
- Um projeto Supabase **novo** (não o do manychat-clone)
- Um Meta App com o produto "Instagram" configurado (mesmo tipo de app usado no manychat-clone, mas nada impede reaproveitar o mesmo Meta App — o que muda é o token de cada conta conectada)
- Uma chave de API da Anthropic (`ANTHROPIC_API_KEY`)

## Setup local

```bash
npm install
cp .env.example .env.local
# preencha .env.local com as chaves do seu projeto Supabase, do Meta App e da Anthropic
npm run dev
```

O servidor de dev sobe em `http://localhost:3100`, protegido por autenticação básica do navegador (`DASHBOARD_USER`/`DASHBOARD_PASSWORD` no `.env.local`).

## Banco de dados

Rode as migrations em `supabase/migrations/` (em ordem) no seu projeto Supabase — pelo SQL Editor do painel, ou via Supabase CLI (`supabase db push`):

- `0001_init.sql` — schema multi-tenant (`accounts`, `account_products`, `account_hooks`, `account_exclusion_rules`, `leads`, `interactions`, `events`)
- `0002_interactions_queue.sql` — transforma `interactions` na fila de envio (dedupe, claim atômico)

## Painel

Acesse `/` (protegido por Basic Auth) para gerenciar tudo: lista de contas com status e estatísticas rápidas, edição de cada conta (persona, WhatsApp, token), produtos/dores, ganchos (posts + palavras-chave), regras de exclusão, e a lista de mensagens geradas/enviadas com o status de cada lead editável.

Cadastrar uma conta ainda tem uma etapa manual fora da interface: obter o **access token** do Instagram (a interface não faz o fluxo OAuth sozinha, só guarda o token que você colar nela).

### 1. Obter o access token

O projeto não tem uma rota `/api/oauth/callback` ativa — o fluxo abaixo é manual, feito uma vez por conta (o token dura ~60 dias; renovar antes de expirar é um passo futuro, ainda não automatizado).

**a) Autorizar.** Abra no navegador (substituindo as variáveis pelos valores do seu `.env.local`), logado como a conta Instagram que você quer conectar:

```
https://www.instagram.com/oauth/authorize?client_id=SEU_INSTAGRAM_APP_ID&redirect_uri=SEU_NEXT_PUBLIC_APP_URL/api/oauth/callback&scope=instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments&response_type=code&state=setup
```

Depois de autorizar, o navegador tenta redirecionar para uma rota que não existe (tudo bem) — o que importa é o `?code=...` que aparece na barra de endereço. Copie esse código (remova um `#_` no final, se vier).

**b) Trocar o code por um token curto:**

```bash
curl -X POST https://api.instagram.com/oauth/access_token \
  -F client_id=SEU_INSTAGRAM_APP_ID \
  -F client_secret=SEU_INSTAGRAM_APP_SECRET \
  -F grant_type=authorization_code \
  -F redirect_uri="SEU_NEXT_PUBLIC_APP_URL/api/oauth/callback" \
  -F code="COLE_O_CODE_AQUI"
```

**c) Trocar o token curto por um de longa duração (~60 dias):**

```bash
curl "https://graph.instagram.com/v25.0/access_token?grant_type=ig_exchange_token&client_secret=SEU_INSTAGRAM_APP_SECRET&access_token=TOKEN_CURTO_DO_PASSO_B"
```

**d) Pegar o `ig_user_id` e o `username` da conta:**

```bash
curl "https://graph.instagram.com/v25.0/me?fields=user_id,username&access_token=TOKEN_LONGO_DO_PASSO_C"
```

**e) Assinar o webhook de comentários para essa conta:**

```bash
curl -X POST "https://graph.instagram.com/v25.0/USER_ID_DO_PASSO_D/subscribed_apps?subscribed_fields=comments&access_token=TOKEN_LONGO_DO_PASSO_C"
```

### 2. Cadastrar a conta no painel

Com o token em mãos, vá em `/accounts/novo` no painel e preencha: slug, `ig_user_id` e `@usuário` (do passo 1d), cole o access token (passo 1c), o número de WhatsApp e a persona/tom de voz da marca.

Depois de criar, a própria página da conta (`/accounts/[id]`) tem as seções pra cadastrar produtos/dores, ganchos (posts monitorados + palavras-chave) e regras de exclusão — sem precisar de SQL.

### 3. Configurar o webhook no Meta App

No painel do Meta App, produto **Webhooks** (Instagram):
- **Callback URL:** `https://SEU_DOMINIO/api/webhook`
- **Verify token:** o mesmo valor de `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` no seu `.env`
- Assine o campo **comments**

## Deploy

Crie um projeto **novo e separado** no Vercel (ou onde for hospedar), apontando para esta pasta — não reaproveite o projeto do manychat-clone. Configure as mesmas variáveis do `.env.example` nas env vars do ambiente de produção.

Configure um agendador batendo em `/api/cron/drain` a cada 1–2 minutos (Vercel Cron, pg_cron do Supabase via `pg_net`, ou qualquer outro) como backup do disparo automático que já acontece logo após cada webhook:

```
POST https://SEU_DOMINIO/api/cron/drain?secret=SEU_CRON_SECRET
```

## O que ainda falta (fora do escopo construído até aqui)

- Renovação automática do access token antes de expirar (o manychat-clone tem um cron pra isso; aqui ainda é manual — refazer o passo 1 e colar o novo token no painel quando estiver perto de vencer)
- Fluxo OAuth completo dentro do painel (hoje só o passo de obter o token é manual, via curl)

-- ============================================================
-- Schema inicial: Social Seller (multi-conta)
-- Todas as tabelas têm RLS ligado e SEM políticas.
-- Acesso é feito apenas pelo servidor (Next.js) com a service role key,
-- que ignora RLS. Nenhum acesso direto do navegador é permitido.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- accounts: cada conta do Instagram plugada no sistema.
-- Diferente do manychat-clone, aqui NÃO é singleton — cada linha é
-- uma marca/conta independente, com seu próprio token, persona e
-- número de WhatsApp de handoff.
-- ------------------------------------------------------------
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,

  ig_user_id text unique,
  ig_username text,
  ig_profile_picture_url text,
  access_token text,
  token_expires_at timestamptz,
  connected_at timestamptz,

  -- handoff: para onde a DM gerada deve direcionar a pessoa
  whatsapp_number text not null,

  -- usado no prompt de geração da DM (formal, descontraído, técnico...)
  persona_tone text not null default '',

  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table accounts enable row level security;

create index if not exists accounts_ig_user_id_idx on accounts (ig_user_id);
create index if not exists accounts_active_idx on accounts (active);

-- ------------------------------------------------------------
-- account_products: produtos/soluções da conta e as dores que cada um
-- resolve. Entra no prompt do LLM para embasar a validação da dor.
-- ------------------------------------------------------------
create table if not exists account_products (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  name text not null,
  pain_points text not null, -- descrição livre das dores que esse produto resolve
  created_at timestamptz not null default now()
);

alter table account_products enable row level security;

create index if not exists account_products_account_idx on account_products (account_id);

-- ------------------------------------------------------------
-- account_hooks: posts monitorados + palavras/expressões-gancho que
-- qualificam um comentário como candidato a abordagem.
-- ------------------------------------------------------------
create table if not exists account_hooks (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,

  media_id text, -- null = monitora todos os posts da conta
  media_permalink text,

  keywords text[] not null default '{}',
  match_type text not null default 'contains'
    check (match_type in ('contains', 'exact', 'any')),

  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table account_hooks enable row level security;

create index if not exists account_hooks_account_idx on account_hooks (account_id);
create index if not exists account_hooks_media_idx on account_hooks (media_id);

-- ------------------------------------------------------------
-- account_exclusion_rules: regras que impedem a abordagem mesmo
-- quando um comentário bate com um hook (comprimento mínimo, já é
-- cliente, palavra na blacklist etc). `value` guarda o parâmetro da
-- regra em formato livre (jsonb) conforme o `rule_type`.
-- ------------------------------------------------------------
create table if not exists account_exclusion_rules (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,

  rule_type text not null
    check (rule_type in ('min_comment_length', 'blacklist_keyword', 'exclude_lead_status')),
  value jsonb not null,

  created_at timestamptz not null default now()
);

alter table account_exclusion_rules enable row level security;

create index if not exists account_exclusion_rules_account_idx on account_exclusion_rules (account_id);

-- ------------------------------------------------------------
-- leads: pessoas que comentaram e foram (ou podem vir a ser)
-- abordadas, por conta. Um mesmo ig_scoped_id pode existir em mais de
-- uma conta (contas são independentes), por isso o unique é composto.
-- ------------------------------------------------------------
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,

  ig_scoped_id text not null,
  ig_username text,

  status text not null default 'novo'
    check (status in ('novo', 'abordado', 'respondeu', 'qualificado', 'encaminhado_whatsapp', 'descartado')),

  first_comment_text text,
  first_contact_at timestamptz,
  last_status_at timestamptz not null default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (account_id, ig_scoped_id)
);

alter table leads enable row level security;

create index if not exists leads_account_idx on leads (account_id);
create index if not exists leads_status_idx on leads (status);

-- ------------------------------------------------------------
-- interactions: cada comentário relevante processado + a mensagem
-- gerada pelo LLM para ele. Serve como log e como fonte das "últimas
-- N mensagens desta conta" passadas ao prompt para evitar repetição.
-- ------------------------------------------------------------
create table if not exists interactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  lead_id uuid not null references leads (id) on delete cascade,

  comment_id text,
  media_id text,
  comment_text text,

  generated_message text,
  llm_model text,

  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  last_error text,
  sent_at timestamptz,

  created_at timestamptz not null default now()
);

alter table interactions enable row level security;

create index if not exists interactions_account_idx on interactions (account_id);
create index if not exists interactions_lead_idx on interactions (lead_id);
create index if not exists interactions_account_created_idx on interactions (account_id, created_at desc);

-- ------------------------------------------------------------
-- events: log bruto de tudo que chega da Meta, por conta (quando já
-- identificada).
-- ------------------------------------------------------------
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts (id) on delete set null,
  event_type text not null, -- 'comment' | outros
  ig_scoped_id text,
  raw_payload jsonb not null,
  received_at timestamptz not null default now()
);

alter table events enable row level security;

create index if not exists events_received_at_idx on events (received_at desc);
create index if not exists events_account_idx on events (account_id);

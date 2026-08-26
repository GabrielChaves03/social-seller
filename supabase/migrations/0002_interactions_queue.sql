-- ============================================================
-- Transforma `interactions` na própria fila de envio.
-- Diferente do manychat-clone (que tem uma tabela `queue` separada para
-- vários tipos de envio por automação), aqui é sempre 1 mensagem por
-- comentário relevante — então a linha pendente de `interactions` JÁ É
-- "a próxima DM a gerar e enviar" para aquele comentário.
-- ============================================================

alter table interactions
  add column if not exists dedupe_key text unique,
  add column if not exists claimed_at timestamptz,
  add column if not exists attempts integer not null default 0;

-- Adiciona 'sending' aos status possíveis (trava de claim atômico).
alter table interactions drop constraint if exists interactions_status_check;
alter table interactions add constraint interactions_status_check
  check (status in ('pending', 'sending', 'sent', 'failed', 'skipped'));

-- Reivindica um lote de interações pendentes de forma atômica — evita
-- envio em dobro quando o drenador é chamado ao mesmo tempo pelo webhook
-- (via `after()`) e pelo cron de backup. FOR UPDATE SKIP LOCKED garante
-- que duas chamadas concorrentes nunca peguem a mesma linha.
create or replace function claim_pending_interactions(p_batch_size int)
returns setof interactions
language plpgsql
as $$
begin
  return query
  update interactions i
  set status = 'sending',
      claimed_at = now(),
      attempts = attempts + 1
  where i.id in (
    select id from interactions
    where status = 'pending'
    order by created_at asc
    for update skip locked
    limit p_batch_size
  )
  returning i.*;
end;
$$;

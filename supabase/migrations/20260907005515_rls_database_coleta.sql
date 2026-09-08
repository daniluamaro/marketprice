-- =============================================================================
-- Fase 1.2 — RLS multi-tenant sobre a tabela de fatos JA EXISTENTE
-- Contrato: CLAUDE.md §4.1, §5
--
-- IMPORTANTE: esta migration NAO cria, NAO recria e NAO altera a estrutura de
-- public.database_coleta. Ela apenas:
--   a) garante que a RLS esteja ligada (ja estava, o comando e idempotente);
--   b) cria uma policy de SELECT;
--   c) ajusta grants.
-- Nenhum create table / alter table ... add|drop|alter column e emitido.
--
-- Por que isso nao quebra a ingestao do n8n: a RLS ja estava habilitada com
-- ZERO policies e mesmo assim ha 331 linhas na tabela — logo o n8n escreve com
-- a service_role, que ignora RLS. Adicionar uma policy de leitura nao interfere.
-- =============================================================================

alter table public.database_coleta enable row level security;

-- -----------------------------------------------------------------------------
-- CNPJ_contratante e double precision (float8) no schema real, nao text.
-- O cast canonico aprovado e ("CNPJ_contratante")::bigint::text:
--   - float8::text direto poderia emitir notacao cientifica;
--   - um CNPJ tem 14 digitos (< 2^53), entao ::bigint e exato, sem perda.
-- Linhas com CNPJ_contratante NULL (existem 4) nao casam com ninguem e ficam
-- invisiveis para todos os tenants — que e o comportamento seguro.
-- -----------------------------------------------------------------------------
drop policy if exists "tenant_pode_ler_seus_dados" on public.database_coleta;
create policy "tenant_pode_ler_seus_dados"
  on public.database_coleta
  for select
  to authenticated
  using ( (("CNPJ_contratante")::bigint)::text = public.current_cnpj() );

-- Somente leitura, e somente para usuarios autenticados.
revoke all on public.database_coleta from anon;
revoke insert, update, delete on public.database_coleta from authenticated;
grant select on public.database_coleta to authenticated;

-- -----------------------------------------------------------------------------
-- public.query e public.log_registros: tabelas operacionais do fluxo n8n.
-- Decisao aprovada: permanecem com RLS ligada e ZERO policies => invisiveis ao
-- frontend. O n8n continua escrevendo via service_role.
-- -----------------------------------------------------------------------------
revoke all on public.query          from anon, authenticated;
revoke all on public.log_registros  from anon, authenticated;

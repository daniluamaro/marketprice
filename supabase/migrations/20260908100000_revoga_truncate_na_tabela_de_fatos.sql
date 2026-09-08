-- =============================================================================
-- Fecha um privilegio perigoso na tabela de fatos: TRUNCATE
--
-- ACHADO (validacao de RLS, §14): o papel `authenticated` tinha
--   SELECT, TRUNCATE, TRIGGER, REFERENCES
-- sobre public.database_coleta. INSERT/UPDATE/DELETE ja estavam fora, mas
-- TRUNCATE havia passado — sao os grants padrao que o Supabase concede ao
-- schema public, e o revoke anterior (20260907120000) mirou apenas as views.
--
-- POR QUE IMPORTA: **TRUNCATE ignora RLS por completo.** Politicas de linha
-- filtram SELECT/INSERT/UPDATE/DELETE; TRUNCATE nao passa por elas. Ou seja,
-- o privilegio nao apagaria "as linhas do tenant" — apagaria a tabela inteira,
-- de todos os clientes de uma vez. Com dois contratantes na base, um unico
-- comando levaria os dois.
--
-- Nao era exploravel pela API hoje (o PostgREST nao expoe TRUNCATE), mas
-- bastaria uma futura funcao SECURITY INVOKER que limpasse dados para o
-- buraco virar real. Privilegio que nao deveria existir se remove antes.
--
-- TRIGGER e REFERENCES saem pelo mesmo motivo: TRIGGER permite anexar gatilhos
-- a tabela e REFERENCES permite apontar chaves estrangeiras para ela. Nenhum
-- dos dois tem uso legitimo para um usuario final do dashboard.
--
-- NAO altera estrutura nem dados (§4.1 preservado): revoke mexe apenas em
-- permissao. SELECT permanece — e a RLS continua sendo quem decide as linhas.
-- O fluxo n8n nao e afetado: ele grava com service_role, que ignora estes
-- grants.
-- =============================================================================

revoke truncate, trigger, references on public.database_coleta from authenticated;
revoke truncate, trigger, references on public.database_coleta from anon;

-- Impede que o problema volte: sem isto, um objeto futuro criado no schema
-- herdaria de novo os privilegios amplos do padrao.
alter default privileges in schema public
  revoke truncate, trigger, references on tables from authenticated, anon;

-- =============================================================================
-- Fase 4 — endurecimento das permissoes das views analiticas
--
-- O QUE FOI ENCONTRADO: `authenticated` tinha INSERT, UPDATE, DELETE e TRUNCATE
-- em v_produtos, v_preco_vigente e v_precos_base. Nao veio de nenhuma migration
-- deste projeto — e o DEFAULT do Supabase, que concede `all` em tabelas novas do
-- schema public para os papeis do PostgREST.
--
-- Por que nao era explorável hoje: as tres views nao sao auto-atualizaveis (tem
-- join, distinct on e agregacao), e a RLS de database_coleta so tem policy de
-- SELECT — uma escrita seria recusada de qualquer forma.
--
-- Por que mesmo assim se corrige: o CLAUDE.md §5 e explicito ("nao crie policy
-- de escrita ampla p/ cliente"), e a defesa nao pode depender de um detalhe de
-- implementacao da view. Se um dia alguem simplificar v_precos_base a ponto de
-- ela virar auto-atualizavel, o privilegio ja estaria concedido esperando.
--
-- Leitura continua liberada: as telas dependem de SELECT nestas views.
-- =============================================================================

revoke insert, update, delete, truncate, references, trigger
  on public.v_produtos, public.v_preco_vigente, public.v_precos_base
  from authenticated;

revoke all
  on public.v_produtos, public.v_preco_vigente, public.v_precos_base
  from anon;

grant select
  on public.v_produtos, public.v_preco_vigente, public.v_precos_base
  to authenticated;

-- Impede que a proxima view criada neste schema nasca com o mesmo excesso.
alter default privileges in schema public
  revoke insert, update, delete, truncate on tables from authenticated;

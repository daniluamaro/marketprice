-- =============================================================================
-- Fase 1.5 — Correcao de grants: tirar EXECUTE do papel anon
--
-- POR QUE ESTA MIGRATION EXISTE:
-- as migrations anteriores faziam `revoke all on function ... from public`, o
-- que NAO foi suficiente. O Supabase mantem um `alter default privileges` no
-- schema public que concede EXECUTE explicitamente aos papeis anon,
-- authenticated e service_role em toda funcao recem-criada. Revogar de PUBLIC
-- (o pseudo-papel) nao remove um grant explicito a um papel nomeado — entao
-- anon continuava podendo chamar /rest/v1/rpc/<funcao> sem estar logado.
-- Detectado pelos lints 0028/0029 do database linter do Supabase.
--
-- Impacto pratico do que estava aberto: baixo, porque sem JWT o auth.uid() e
-- nulo — current_cnpj() retornaria NULL, is_admin() false, as RPCs analiticas
-- nada (a RLS bloqueia) e rpc_confirmar_troca_senha() atualizaria zero linhas.
-- Ainda assim, funcao nenhuma deste produto tem motivo para existir na
-- superficie publica da API. Fechado.
-- =============================================================================

revoke all on function public.current_cnpj()              from anon;
revoke all on function public.is_admin()                  from anon;
revoke all on function public.rpc_confirmar_troca_senha() from anon;

revoke all on function public.rpc_kpis(date, date, text, text)                          from anon;
revoke all on function public.rpc_comparativo_produto(text, date, date, text)           from anon;
revoke all on function public.rpc_ranking_estabelecimentos(date, date, text, text, int) from anon;
revoke all on function public.rpc_evolucao_preco(text, text, date, date)                from anon;
revoke all on function public.rpc_dispersao_precos(date, date, text, text, int, int)    from anon;
revoke all on function public.rpc_preco_categoria(date, date, text)                     from anon;
revoke all on function public.rpc_preco_geografico(date, date, text)                    from anon;
revoke all on function public.rpc_filtros_disponiveis()                                 from anon;

-- Impede que QUALQUER funcao futura criada em public ja nasca executavel por
-- anon. Sem isto, a proxima migration reintroduz o mesmo problema em silencio.
alter default privileges in schema public revoke execute on functions from anon;

-- =============================================================================
-- Fase 4 — Ranking de lojas por QUANTIDADE de itens abaixo da media de mercado
--
-- Complementa, e nao repete, o rpc_ranking_estabelecimentos:
--
--   rpc_ranking_estabelecimentos  -> "quao barata a loja e, na media" (INTENSIDADE)
--   rpc_ranking_abaixo_mercado    -> "em quantos itens ela ganha"     (AMPLITUDE)
--
-- Sao coisas diferentes e podem discordar. Uma loja com 3 itens 40% abaixo tem
-- indice de competitividade otimo e pouca presenca; outra com 30 itens 4%
-- abaixo tem indice mediano e ganha em quase toda a gondola. Quem monta
-- sortimento precisa da segunda leitura, que a media esconde.
--
-- DEFINICAO usada aqui, deliberadamente literal: "abaixo da media" e
-- preco < media de mercado do MESMO item. Nao se usa a faixa 97-103 do IPP
-- porque a pergunta foi sobre estar abaixo da media, nao sobre estar fora de
-- uma zona de tolerancia. Empate exato (preco = media) conta como nao-abaixo,
-- para que as duas colunas sempre somem o total.
--
-- p_min_lojas: item vendido por uma loja so tem media de mercado igual ao
-- proprio preco — nunca estaria abaixo nem acima, e so poluiria a contagem.
-- =============================================================================

create or replace function public.rpc_ranking_abaixo_mercado(
  p_data_ini   date default null,
  p_data_fim   date default null,
  p_ncm_grupo  text default null,
  p_cidade     text default null,
  p_ean        text default null,
  p_estab      text default null,
  p_min_lojas  int  default 2,
  p_limit      int  default 200
)
returns table (
  cnpj_estabelecimento  text,
  nome_estabelecimento  text,
  bairro                text,
  cidade                text,
  itens_comparados      bigint,
  itens_abaixo          bigint,
  itens_acima           bigint,
  pct_abaixo            numeric,
  ipp_medio             numeric,
  economia_media        numeric
)
language sql
stable
set search_path = ''
as $$
  with base as (
    select b.*
    from public.v_precos_base b
    where b.preco_liquido is not null
      and (p_data_ini  is null or (b.data_nf at time zone 'America/Sao_Paulo')::date >= p_data_ini)
      and (p_data_fim  is null or (b.data_nf at time zone 'America/Sao_Paulo')::date <= p_data_fim)
      and (p_ncm_grupo is null or b.ncm_grupo = p_ncm_grupo)
      and (p_cidade    is null or b.cidade    = p_cidade)
      and (p_ean       is null or b.cod_barras = nullif(p_ean, '')::bigint)
  ),
  vigente as (
    select distinct on (b.cod_barras, b.cnpj_estabelecimento) b.*
    from base b
    order by b.cod_barras, b.cnpj_estabelecimento, b.data_nf desc
  ),
  -- A media do item sai ANTES do filtro de loja: o mercado e sempre o mercado
  -- inteiro, senao filtrar uma loja a compararia consigo mesma.
  mercado as (
    select v.cod_barras,
           avg(v.preco_liquido)                   as pmed,
           count(distinct v.cnpj_estabelecimento) as lojas
    from vigente v
    group by v.cod_barras
  ),
  par as (
    select v.cnpj_estabelecimento,
           v.nome_estabelecimento,
           v.bairro,
           v.cidade,
           v.preco_liquido,
           m.pmed
    from vigente v
    join mercado m on m.cod_barras = v.cod_barras
    where m.lojas >= p_min_lojas
      and (p_estab is null or v.cnpj_estabelecimento = p_estab)
  )
  select
    p.cnpj_estabelecimento,
    max(p.nome_estabelecimento),
    max(p.bairro),
    max(p.cidade),
    count(*),
    count(*) filter (where p.preco_liquido <  p.pmed),
    count(*) filter (where p.preco_liquido >= p.pmed),
    round(count(*) filter (where p.preco_liquido < p.pmed)::numeric
          / nullif(count(*), 0) * 100, 1),
    round(avg(p.preco_liquido / nullif(p.pmed, 0)) * 100, 1),
    -- Quanto, em reais, a loja fica abaixo da media nos itens em que ganha.
    -- Da a dimensao do desconto medio, nao so a contagem.
    round(avg(p.pmed - p.preco_liquido) filter (where p.preco_liquido < p.pmed), 2)
  from par p
  group by p.cnpj_estabelecimento
  order by count(*) filter (where p.preco_liquido < p.pmed) desc,
           count(*) filter (where p.preco_liquido < p.pmed)::numeric
             / nullif(count(*), 0) desc,
           max(p.nome_estabelecimento) asc
  limit p_limit;
$$;

revoke all    on function public.rpc_ranking_abaixo_mercado(date, date, text, text, text, text, int, int) from public, anon;
grant execute on function public.rpc_ranking_abaixo_mercado(date, date, text, text, text, text, int, int) to authenticated, service_role;

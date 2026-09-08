-- =============================================================================
-- Fase 4 — Indice de Posicionamento de Preco (IPP) por produto x loja
--
-- GRANULARIDADE NOVA. O `rpc_ranking_estabelecimentos` ja existente devolve UM
-- numero por loja: a media das razoes dela contra o mercado, item a item. Ele
-- responde "esta loja e cara?".
--
-- Esta funcao desce um nivel e devolve uma linha por par (EAN, CNPJ):
--
--     IPP = preco da loja naquele item / media de mercado do MESMO item x 100
--
-- Responde outra pergunta: "nesta loja, QUAIS itens estao fora de posicao?".
-- Uma loja pode ter indice 100 na media e ainda assim estar 40% acima em tres
-- produtos e 40% abaixo em outros tres — informacao que a media apaga e que e
-- justamente onde mora a negociacao.
--
-- Semantica de p_estab (a mesma do resto do projeto): ele restringe as LINHAS
-- devolvidas, mas a media de mercado continua sendo calculada sobre TODAS as
-- lojas. Filtrar a loja e comparar so com ela mesma daria IPP 100 sempre.
--
-- p_min_lojas evita comparar um produto com "o mercado" quando o mercado e ele
-- proprio: com uma unica loja vendendo o item, a media e o proprio preco e o
-- IPP e 100 por construcao, o que nao informa nada.
-- =============================================================================

create or replace function public.rpc_ipp(
  p_data_ini   date default null,
  p_data_fim   date default null,
  p_ncm_grupo  text default null,
  p_cidade     text default null,
  p_ean        text default null,
  p_estab      text default null,
  p_min_lojas  int  default 2,
  p_limit      int  default 3000
)
returns table (
  cod_barras            bigint,
  nome_exibicao         text,
  ncm_grupo             text,
  cnpj_estabelecimento  text,
  nome_estabelecimento  text,
  bairro                text,
  cidade                text,
  preco                 numeric,
  preco_medio_mercado   numeric,
  lojas_no_mercado      bigint,
  ipp                   numeric,
  data_nf               timestamptz
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
  -- Preco vigente: o registro mais recente por (produto, loja).
  vigente as (
    select distinct on (b.cod_barras, b.cnpj_estabelecimento) b.*
    from base b
    order by b.cod_barras, b.cnpj_estabelecimento, b.data_nf desc
  ),
  -- Mercado de cada EAN calculado ANTES do filtro de loja, de proposito.
  mercado as (
    select v.cod_barras,
           avg(v.preco_liquido)                    as pmed,
           count(distinct v.cnpj_estabelecimento)  as lojas
    from vigente v
    group by v.cod_barras
  )
  select
    v.cod_barras,
    v.nome_exibicao,
    v.ncm_grupo,
    v.cnpj_estabelecimento,
    v.nome_estabelecimento,
    v.bairro,
    v.cidade,
    round(v.preco_liquido, 2),
    round(m.pmed, 2),
    m.lojas,
    round(v.preco_liquido / nullif(m.pmed, 0) * 100, 1),
    v.data_nf
  from vigente v
  join mercado m on m.cod_barras = v.cod_barras
  where m.lojas >= p_min_lojas
    and (p_estab is null or v.cnpj_estabelecimento = p_estab)
  -- Ordem estavel e NAO enviesada: cortar por p_limit depois de ordenar por
  -- IPP descartaria justamente o outro extremo da distribuicao.
  order by v.cod_barras, v.cnpj_estabelecimento
  limit p_limit;
$$;

revoke all    on function public.rpc_ipp(date, date, text, text, text, text, int, int) from public, anon;
grant execute on function public.rpc_ipp(date, date, text, text, text, text, int, int) to authenticated, service_role;

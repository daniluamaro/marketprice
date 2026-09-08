-- =============================================================================
-- Fase 4.2 — Indice de competitividade por regiao
--
-- POR QUE ESTA FUNCAO EXISTE, e nao bastava rpc_preco_geografico:
--
-- "preco medio do bairro" mistura produtos diferentes, entao mede o SORTIMENTO
-- daquela regiao, nao o quanto ela e cara. Um bairro com lojas que so vendem
-- itens grandes apareceria caro sem praticar um centavo a mais. E o mesmo
-- defeito que ja tinha sido corrigido em rpc_preco_categoria.
--
-- Aqui a comparacao e produto a produto: para cada EAN, o preco praticado na
-- regiao dividido pela media de mercado DAQUELE EAN; depois a media dessas
-- razoes. Media das razoes, nunca razao das medias — e o que neutraliza o mix.
--   < 1,00 = regiao abaixo do mercado
--   > 1,00 = regiao acima do mercado
--
-- p_min_produtos evita ranquear um bairro por causa de um unico item.
-- =============================================================================

create or replace function public.rpc_indice_geografico(
  p_data_ini      date default null,
  p_data_fim      date default null,
  p_ncm_grupo     text default null,
  p_cidade        text default null,
  p_ean           text default null,
  p_estab         text default null,
  p_min_produtos  int  default 2
)
returns table (
  cidade                  text,
  bairro                  text,
  estabelecimentos        bigint,
  produtos                bigint,
  preco_medio             numeric,
  indice_competitividade  numeric
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
  -- Mesma semantica do §4.1 desta fase: o filtro de estabelecimento restringe
  -- o UNIVERSO de produtos, mas a comparacao continua contra o mercado todo.
  universo as (
    select distinct b.cod_barras
    from base b
    where p_estab is null or b.cnpj_estabelecimento = p_estab
  ),
  vigente as (
    select distinct on (b.cod_barras, b.cnpj_estabelecimento) b.*
    from base b
    join universo u on u.cod_barras = b.cod_barras
    order by b.cod_barras, b.cnpj_estabelecimento, b.data_nf desc
  ),
  mercado as (
    select v.cod_barras, avg(v.preco_liquido) as pmed
    from vigente v group by v.cod_barras
  ),
  razao as (
    select coalesce(v.cidade, 'Não informada') as cid,
           coalesce(v.bairro, 'Não informado') as bai,
           v.cnpj_estabelecimento,
           v.cod_barras,
           v.preco_liquido,
           v.preco_liquido / nullif(m.pmed, 0) as r
    from vigente v
    join mercado m on m.cod_barras = v.cod_barras
  )
  select z.cid, z.bai,
         count(distinct z.cnpj_estabelecimento),
         count(distinct z.cod_barras),
         round(avg(z.preco_liquido), 2),
         round(avg(z.r), 4)
  from razao z
  group by z.cid, z.bai
  having count(distinct z.cod_barras) >= p_min_produtos
  order by avg(z.r) asc nulls last;
$$;

revoke all    on function public.rpc_indice_geografico(date, date, text, text, text, text, int) from public, anon;
grant execute on function public.rpc_indice_geografico(date, date, text, text, text, text, int) to authenticated, service_role;

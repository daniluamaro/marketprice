-- =============================================================================
-- Fase 4 — KPIs adicionais e distribuicao de precos
--
-- 1. v_precos_base ganha `cod_nfce`. A coluna existe na tabela de fatos desde
--    sempre, mas nao havia sido exposta porque nenhuma tela precisava dela.
--    Agora precisa: "quantas NFC-e sustentam esta analise" e uma medida de
--    confianca na amostra, e nao da para contar cupom sem o codigo do cupom.
--    A view e recriada com a coluna NO FIM — `create or replace view` so aceita
--    acrescimo no final da lista.
--
-- 2. rpc_kpis passa a devolver total_bairros, total_nfce e preco_mediano.
--
--    Por que a MEDIANA e nao so a media: a media de uma cesta com detergente de
--    R$ 45 e sabonete de R$ 2 e puxada pelos extremos. A mediana diz onde esta
--    o meio de verdade, e a distancia entre as duas ja e um sinal — media muito
--    acima da mediana significa cauda de itens caros.
--
-- 3. rpc_distribuicao_precos: histograma dos precos vigentes.
--
-- NENHUM create/alter sobre a tabela de fatos (§4.1). Somente leitura.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. v_precos_base + cod_nfce
-- -----------------------------------------------------------------------------
create or replace view public.v_precos_base with (security_invoker = true) as
select f.cod_barras, p.nome_exibicao, f.nome_produto as nome_original,
       p.ncm_grupo, p.classe_item, f.cnpj_estabelecimento, f.nome_estabelecimento,
       f.bairro, f.cidade, f.cod_cidade, f.preco_liquido, f.data_nf, f.data_consulta,
       f.cod_nfce
from public.database_coleta f
join public.v_produtos p using (cod_barras);

-- -----------------------------------------------------------------------------
-- 2. rpc_kpis — tres colunas novas
-- -----------------------------------------------------------------------------
drop function if exists public.rpc_kpis(date, date, text, text, text, text);

create function public.rpc_kpis(
  p_data_ini   date default null,
  p_data_fim   date default null,
  p_ncm_grupo  text default null,
  p_cidade     text default null,
  p_ean        text default null,
  p_estab      text default null
)
returns table (
  total_produtos          bigint,
  total_estabelecimentos  bigint,
  total_cidades           bigint,
  preco_medio             numeric,
  ultima_coleta           timestamptz,
  variacao_recente_pct    numeric,
  amplitude_media_pct     numeric,
  total_bairros           bigint,
  total_nfce              bigint,
  preco_mediano           numeric
)
language sql
stable
set search_path = ''
as $$
  with base as (
    select b.*
    from public.v_precos_base b
    where (p_data_ini  is null or (b.data_nf at time zone 'America/Sao_Paulo')::date >= p_data_ini)
      and (p_data_fim  is null or (b.data_nf at time zone 'America/Sao_Paulo')::date <= p_data_fim)
      and (p_ncm_grupo is null or b.ncm_grupo = p_ncm_grupo)
      and (p_cidade    is null or b.cidade    = p_cidade)
      and (p_ean       is null or b.cod_barras = nullif(p_ean, '')::bigint)
      and (p_estab     is null or b.cnpj_estabelecimento = p_estab)
  ),
  vigente as (
    select distinct on (b.cod_barras, b.cnpj_estabelecimento) b.*
    from base b
    order by b.cod_barras, b.cnpj_estabelecimento, b.data_nf desc
  ),
  ref as (select max(b.data_nf) as fim from base b),
  janela as (
    select
      avg(b.preco_liquido) filter (
        where b.data_nf >= (select r.fim from ref r) - interval '7 days') as atual,
      avg(b.preco_liquido) filter (
        where b.data_nf <  (select r.fim from ref r) - interval '7 days'
          and b.data_nf >= (select r.fim from ref r) - interval '14 days') as anterior
    from base b
  ),
  amplitudes as (
    select (max(v.preco_liquido) - min(v.preco_liquido))
             / nullif(min(v.preco_liquido), 0) * 100 as amp
    from vigente v
    group by v.cod_barras
    having count(distinct v.cnpj_estabelecimento) >= 2
  )
  select
    (select count(distinct v.cod_barras)           from vigente v),
    (select count(distinct v.cnpj_estabelecimento) from vigente v),
    (select count(distinct v.cidade)               from vigente v),
    (select round(avg(v.preco_liquido), 2)         from vigente v),
    (select r.fim from ref r),
    (select round((j.atual - j.anterior) / nullif(j.anterior, 0) * 100, 2) from janela j),
    (select round(avg(a.amp), 1) from amplitudes a),
    (select count(distinct v.bairro) from vigente v),
    -- NFC-e conta sobre BASE, nao sobre vigente: a pergunta e quantos cupons
    -- alimentaram o recorte, e nao quantos sobreviveram ao corte de vigencia.
    (select count(distinct b.cod_nfce) from base b where b.cod_nfce is not null),
    (select round(
       percentile_cont(0.5) within group (order by v.preco_liquido)::numeric, 2)
     from vigente v);
$$;

revoke all    on function public.rpc_kpis(date, date, text, text, text, text) from public, anon;
grant execute on function public.rpc_kpis(date, date, text, text, text, text) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. rpc_distribuicao_precos — histograma
--
-- Devolve p_faixas intervalos de largura igual entre o menor e o maior preco
-- vigente, com a contagem de itens em cada um. `width_bucket` faz a alocacao;
-- o valor exatamente igual ao maximo cai na faixa p_faixas+1 e por isso e
-- dobrado de volta na ultima faixa — senao o item mais caro some do grafico.
--
-- Quando ha um preco so (hi = lo) nao existe distribuicao a mostrar e a funcao
-- devolve zero linhas, deixando a tela usar o estado vazio.
-- -----------------------------------------------------------------------------
create or replace function public.rpc_distribuicao_precos(
  p_data_ini   date default null,
  p_data_fim   date default null,
  p_ncm_grupo  text default null,
  p_cidade     text default null,
  p_ean        text default null,
  p_estab      text default null,
  p_faixas     int  default 12
)
returns table (
  faixa      int,
  preco_de   numeric,
  preco_ate  numeric,
  registros  bigint,
  produtos   bigint
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
      and (p_estab     is null or b.cnpj_estabelecimento = p_estab)
  ),
  vigente as (
    select distinct on (b.cod_barras, b.cnpj_estabelecimento) b.*
    from base b
    order by b.cod_barras, b.cnpj_estabelecimento, b.data_nf desc
  ),
  lim as (
    select min(v.preco_liquido) as lo, max(v.preco_liquido) as hi from vigente v
  ),
  alocado as (
    select
      least(width_bucket(v.preco_liquido, l.lo, l.hi, p_faixas), p_faixas) as b,
      v.cod_barras
    from vigente v cross join lim l
    where l.hi > l.lo
  ),
  serie as (select generate_series(1, p_faixas) as b)
  select
    s.b,
    round(l.lo + (l.hi - l.lo) * (s.b - 1)::numeric / p_faixas, 2),
    round(l.lo + (l.hi - l.lo) * s.b::numeric      / p_faixas, 2),
    count(a.b),
    count(distinct a.cod_barras)
  from serie s
  cross join lim l
  left join alocado a on a.b = s.b
  where l.hi > l.lo
  group by s.b, l.lo, l.hi
  order by s.b;
$$;

revoke all    on function public.rpc_distribuicao_precos(date, date, text, text, text, text, int) from public, anon;
grant execute on function public.rpc_distribuicao_precos(date, date, text, text, text, text, int) to authenticated, service_role;

-- =============================================================================
-- Fase 4 — Boxplot de preco por EAN + Matriz Preco x Dispersao
--
-- As duas RPCs respondem perguntas que a media nao responde:
--
--   rpc_boxplot_precos          -> COMO os precos de um item se espalham
--   rpc_matriz_preco_dispersao  -> QUAIS itens merecem atencao, e por que
--
-- UNIDADE DE OBSERVACAO (vale para as duas): um ponto = uma LOJA, com o preco
-- VIGENTE dela (ultimo data_nf). Nao se usa o historico bruto porque um item
-- coletado 5 vezes na mesma loja pesaria 5 vezes na dispersao e inventaria uma
-- variacao entre lojas que nao existe.
--
-- p_min_lojas = 2: com uma loja so nao ha dispersao para medir — o boxplot
-- viraria um traco e o desvio padrao seria nulo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Boxplot: minimo, Q1, mediana, Q3, maximo e outliers por EAN
--
-- Convencao de Tukey, que e a que da sentido a palavra "outlier":
--   IQR      = Q3 - Q1
--   cercas   = Q1 - 1.5*IQR  e  Q3 + 1.5*IQR
--   whiskers = menor/maior preco DENTRO das cercas (nao a cerca em si)
--   outliers = os precos fora das cercas, devolvidos um a um
--
-- Por que devolver whisker e min/max separados: o min/max ainda e o numero que
-- o comprador quer ("qual o menor preco que existe?"), enquanto o whisker e o
-- que a caixa deve desenhar. Misturar os dois faz o grafico mentir ou a tabela
-- discordar do grafico.
--
-- p_ean_destaque nao FILTRA — ele ORDENA. A tela de Comparativo trabalha com um
-- produto selecionado, e o valor dela esta em ver esse produto ao lado dos
-- outros, nao sozinho. Sem isso, um item fora do top p_limit sumiria do proprio
-- grafico em que deveria ser o protagonista.
-- -----------------------------------------------------------------------------
create or replace function public.rpc_boxplot_precos(
  p_data_ini     date default null,
  p_data_fim     date default null,
  p_ncm_grupo    text default null,
  p_cidade       text default null,
  p_ean          text default null,
  p_estab        text default null,
  p_min_lojas    int  default 2,
  p_limit        int  default 20,
  p_ean_destaque text default null
)
returns table (
  cod_barras     bigint,
  nome_exibicao  text,
  ncm_grupo      text,
  lojas          bigint,
  minimo         numeric,
  q1             numeric,
  mediana        numeric,
  q3             numeric,
  maximo         numeric,
  whisker_inf    numeric,
  whisker_sup    numeric,
  outliers       numeric[],
  preco_medio    numeric,
  amplitude_pct  numeric
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
  est as (
    select
      v.cod_barras,
      max(v.nome_exibicao) as nome_exibicao,
      max(v.ncm_grupo)     as ncm_grupo,
      count(*)             as lojas,
      min(v.preco_liquido) as minimo,
      max(v.preco_liquido) as maximo,
      avg(v.preco_liquido) as preco_medio,
      -- percentile_cont devolve double precision; o cast mantem tudo em
      -- numeric ate o round, evitando 7.8600000000000003 na interface.
      (percentile_cont(0.25) within group (order by v.preco_liquido))::numeric as q1,
      (percentile_cont(0.50) within group (order by v.preco_liquido))::numeric as mediana,
      (percentile_cont(0.75) within group (order by v.preco_liquido))::numeric as q3
    from vigente v
    group by v.cod_barras
    having count(*) >= p_min_lojas
  ),
  cerca as (
    select e.*,
           e.q1 - 1.5 * (e.q3 - e.q1) as lo,
           e.q3 + 1.5 * (e.q3 - e.q1) as hi
    from est e
  )
  select
    c.cod_barras,
    c.nome_exibicao,
    c.ncm_grupo,
    c.lojas,
    round(c.minimo, 2),
    round(c.q1, 2),
    round(c.mediana, 2),
    round(c.q3, 2),
    round(c.maximo, 2),
    round((select min(v.preco_liquido) from vigente v
            where v.cod_barras = c.cod_barras and v.preco_liquido >= c.lo), 2),
    round((select max(v.preco_liquido) from vigente v
            where v.cod_barras = c.cod_barras and v.preco_liquido <= c.hi), 2),
    coalesce(
      (select array_agg(round(v.preco_liquido, 2) order by v.preco_liquido)
         from vigente v
        where v.cod_barras = c.cod_barras
          and (v.preco_liquido < c.lo or v.preco_liquido > c.hi)),
      '{}'::numeric[]
    ),
    round(c.preco_medio, 2),
    round((c.maximo - c.minimo) / nullif(c.minimo, 0) * 100, 1)
  from cerca c
  -- Com p_ean_destaque nulo a comparacao e NULL para todas as linhas e o
  -- criterio simplesmente nao pesa (nulls last mantem a ordem seguinte).
  order by (c.cod_barras = nullif(p_ean_destaque, '')::bigint) desc nulls last,
           c.lojas desc,
           c.mediana asc
  limit p_limit;
$$;

revoke all    on function public.rpc_boxplot_precos(date, date, text, text, text, text, int, int, text) from public, anon;
grant execute on function public.rpc_boxplot_precos(date, date, text, text, text, text, int, int, text) to authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 2. Matriz Preco x Dispersao (quadrantes estrategicos)
--
-- Eixo X = preco medio do item entre as lojas.
-- Eixo Y = COEFICIENTE DE VARIACAO (desvio padrao / media * 100).
--
-- Por que CV e nao a amplitude % usada nas outras telas: amplitude olha so dois
-- pontos (o mais barato e o mais caro), entao uma unica loja fora da curva joga
-- o item para o quadrante errado. O CV usa todas as lojas e responde "o mercado
-- inteiro esta espalhado?", que e a pergunta de um mapa estrategico. A
-- amplitude % vai junto na resposta para amarrar com o resto do produto.
--
-- CORTES ADAPTATIVOS: o "alto/baixo" de cada eixo e a MEDIANA do proprio
-- recorte, nao um valor fixo. Um limiar absoluto (ex.: R$ 10) classificaria
-- errado assim que o cliente filtrasse uma categoria mais cara ou mais barata.
-- Os cortes voltam em toda linha para a interface desenhar as linhas divisorias
-- exatamente onde o servidor classificou — se cada lado calculasse o seu, ponto
-- e quadrante poderiam discordar na fronteira.
-- -----------------------------------------------------------------------------
create or replace function public.rpc_matriz_preco_dispersao(
  p_data_ini  date default null,
  p_data_fim  date default null,
  p_ncm_grupo text default null,
  p_cidade    text default null,
  p_ean       text default null,
  p_estab     text default null,
  p_min_lojas int  default 2,
  p_limit     int  default 300
)
returns table (
  cod_barras      bigint,
  nome_exibicao   text,
  ncm_grupo       text,
  lojas           bigint,
  preco_medio     numeric,
  preco_min       numeric,
  preco_max       numeric,
  dispersao_pct   numeric,
  amplitude_pct   numeric,
  corte_preco     numeric,
  corte_dispersao numeric,
  quadrante       text
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
  est as (
    select
      v.cod_barras,
      max(v.nome_exibicao)         as nome_exibicao,
      max(v.ncm_grupo)             as ncm_grupo,
      count(*)                     as lojas,
      avg(v.preco_liquido)         as pm,
      min(v.preco_liquido)         as pmin,
      max(v.preco_liquido)         as pmax,
      -- stddev_samp (n-1) e nao stddev_pop: as lojas coletadas sao uma AMOSTRA
      -- do mercado, nao o mercado inteiro.
      stddev_samp(v.preco_liquido) as dp
    from vigente v
    group by v.cod_barras
    having count(*) >= p_min_lojas
  ),
  cv as (
    select e.*,
           round(e.dp / nullif(e.pm, 0) * 100, 1) as disp
    from est e
  ),
  cortes as (
    select
      (percentile_cont(0.5) within group (order by c.pm))::numeric   as corte_preco,
      (percentile_cont(0.5) within group (order by c.disp))::numeric as corte_disp
    from cv c
  )
  select
    c.cod_barras,
    c.nome_exibicao,
    c.ncm_grupo,
    c.lojas,
    round(c.pm, 2),
    round(c.pmin, 2),
    round(c.pmax, 2),
    c.disp,
    round((c.pmax - c.pmin) / nullif(c.pmin, 0) * 100, 1),
    round(k.corte_preco, 2),
    round(k.corte_disp, 1),
    case
      when c.pm >= k.corte_preco and c.disp >= k.corte_disp then 'oportunidade'
      when c.pm >= k.corte_preco and c.disp <  k.corte_disp then 'caro_estavel'
      when c.pm <  k.corte_preco and c.disp >= k.corte_disp then 'competitivo'
      else 'consolidado'
    end
  from cv c
  cross join cortes k
  order by c.disp desc nulls last, c.pm desc
  limit p_limit;
$$;

revoke all    on function public.rpc_matriz_preco_dispersao(date, date, text, text, text, text, int, int) from public, anon;
grant execute on function public.rpc_matriz_preco_dispersao(date, date, text, text, text, text, int, int) to authenticated, service_role;

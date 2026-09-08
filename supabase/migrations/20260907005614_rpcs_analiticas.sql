-- =============================================================================
-- Fase 1.4 — Funcoes RPC analiticas
-- Contrato: CLAUDE.md §6.4, §9
--
-- Convencoes aplicadas em TODAS as funcoes abaixo:
--
--  1. SECURITY INVOKER (padrao, nao declarado): a RLS de database_coleta e
--     aplicada normalmente. Nenhuma delas e SECURITY DEFINER.
--
--  2. "Preco vigente DENTRO DO RECORTE": as RPCs partem de v_precos_base
--     (fato bruto enriquecido), aplicam os filtros globais e SO ENTAO reduzem
--     para o ultimo data_nf por (cod_barras, cnpj_estabelecimento). Fazer o
--     contrario — partir de v_preco_vigente e filtrar depois — daria numero
--     errado, porque v_preco_vigente ja escolheu o ultimo registro de TODA a
--     serie, ignorando o periodo pedido pelo usuario.
--
--  3. Datas: o bucket de dia usa `at time zone 'America/Sao_Paulo'`. data_nf e
--     timestamptz e o banco roda em UTC; sem a conversao, uma nota das 22h de
--     Porto Seguro cairia no dia seguinte no grafico.
--
--  4. cod_barras trafega como TEXT na fronteira da API (parametros e retorno),
--     apesar de ser bigint na tabela. Isso mantem a assinatura pedida pelo
--     contrato (p_ean text) e evita qualquer surpresa de precisao numerica no
--     JavaScript.
--
--  5. Divisoes sempre com nullif(x, 0) para nao estourar em base pequena.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- rpc_kpis — cartoes da Visao Geral.
-- variacao_recente_pct compara a media dos ultimos 7 dias com a dos 7 dias
-- anteriores; retorna NULL quando ainda nao ha historico suficiente (hoje a
-- base tem 4 dias, entao virá NULL — a UI deve tratar como "sem base de
-- comparacao", nunca exibir 0 ou NaN).
-- -----------------------------------------------------------------------------
create or replace function public.rpc_kpis(
  p_data_ini   date default null,
  p_data_fim   date default null,
  p_ncm_grupo  text default null,
  p_cidade     text default null
)
returns table (
  total_produtos          bigint,
  total_estabelecimentos  bigint,
  total_cidades           bigint,
  preco_medio             numeric,
  ultima_coleta           timestamptz,
  variacao_recente_pct    numeric
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
  ),
  vigente as (
    select distinct on (b.cod_barras, b.cnpj_estabelecimento) b.*
    from base b
    order by b.cod_barras, b.cnpj_estabelecimento, b.data_nf desc
  ),
  ref as (
    select max(b.data_nf) as fim from base b
  ),
  janela as (
    select
      avg(b.preco_liquido) filter (
        where b.data_nf >= (select r.fim from ref r) - interval '7 days'
      ) as atual,
      avg(b.preco_liquido) filter (
        where b.data_nf <  (select r.fim from ref r) - interval '7 days'
          and b.data_nf >= (select r.fim from ref r) - interval '14 days'
      ) as anterior
    from base b
  )
  select
    (select count(distinct v.cod_barras)           from vigente v),
    (select count(distinct v.cnpj_estabelecimento) from vigente v),
    (select count(distinct v.cidade)               from vigente v),
    (select round(avg(v.preco_liquido), 2)         from vigente v),
    (select r.fim from ref r),
    (select round((j.atual - j.anterior) / nullif(j.anterior, 0) * 100, 2) from janela j);
$$;


-- -----------------------------------------------------------------------------
-- rpc_comparativo_produto — tela Comparativo de Precos.
-- Uma linha por estabelecimento que vende o EAN, com o preco vigente dele e as
-- estatisticas de mercado repetidas (min/media/max/spread) para a UI montar
-- barras e badges sem recalcular nada no browser.
-- -----------------------------------------------------------------------------
create or replace function public.rpc_comparativo_produto(
  p_ean       text,
  p_data_ini  date default null,
  p_data_fim  date default null,
  p_cidade    text default null
)
returns table (
  cnpj_estabelecimento  text,
  nome_estabelecimento  text,
  bairro                text,
  cidade                text,
  preco                 numeric,
  data_nf               timestamptz,
  preco_min             numeric,
  preco_medio           numeric,
  preco_max             numeric,
  spread_pct            numeric,
  desvio_media_pct      numeric
)
language sql
stable
set search_path = ''
as $$
  with base as (
    select b.*
    from public.v_precos_base b
    where b.cod_barras = nullif(p_ean, '')::bigint
      and b.preco_liquido is not null
      and (p_data_ini is null or (b.data_nf at time zone 'America/Sao_Paulo')::date >= p_data_ini)
      and (p_data_fim is null or (b.data_nf at time zone 'America/Sao_Paulo')::date <= p_data_fim)
      and (p_cidade   is null or b.cidade = p_cidade)
  ),
  vigente as (
    select distinct on (b.cnpj_estabelecimento) b.*
    from base b
    order by b.cnpj_estabelecimento, b.data_nf desc
  ),
  agg as (
    select
      min(v.preco_liquido) as pmin,
      avg(v.preco_liquido) as pmed,
      max(v.preco_liquido) as pmax
    from vigente v
  )
  select
    v.cnpj_estabelecimento,
    v.nome_estabelecimento,
    v.bairro,
    v.cidade,
    v.preco_liquido,
    v.data_nf,
    round(a.pmin, 2),
    round(a.pmed, 2),
    round(a.pmax, 2),
    round((a.pmax - a.pmin) / nullif(a.pmin, 0) * 100, 2),
    round((v.preco_liquido - a.pmed) / nullif(a.pmed, 0) * 100, 2)
  from vigente v
  cross join agg a
  order by v.preco_liquido asc;
$$;


-- -----------------------------------------------------------------------------
-- rpc_ranking_estabelecimentos — tela Ranking.
--
-- indice_competitividade = media, por loja, da razao
--     (preco da loja para o EAN) / (preco medio de mercado para o MESMO EAN).
--
-- Nota metodologica: a media das razoes por EAN e nao a razao das medias. Isso
-- neutraliza o mix — uma loja que so vende itens caros nao aparece "cara" por
-- isso. < 1,00 => barato vs mercado; > 1,00 => caro.
-- -----------------------------------------------------------------------------
create or replace function public.rpc_ranking_estabelecimentos(
  p_data_ini   date default null,
  p_data_fim   date default null,
  p_ncm_grupo  text default null,
  p_cidade     text default null,
  p_min_produtos int default 1
)
returns table (
  cnpj_estabelecimento    text,
  nome_estabelecimento    text,
  bairro                  text,
  cidade                  text,
  produtos_comparados     bigint,
  preco_medio_loja        numeric,
  preco_medio_mercado     numeric,
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
  ),
  vigente as (
    select distinct on (b.cod_barras, b.cnpj_estabelecimento) b.*
    from base b
    order by b.cod_barras, b.cnpj_estabelecimento, b.data_nf desc
  ),
  mercado as (
    select v.cod_barras, avg(v.preco_liquido) as pmed_mercado
    from vigente v
    group by v.cod_barras
  ),
  razao as (
    select
      v.cnpj_estabelecimento,
      v.nome_estabelecimento,
      v.bairro,
      v.cidade,
      v.cod_barras,
      v.preco_liquido,
      m.pmed_mercado,
      v.preco_liquido / nullif(m.pmed_mercado, 0) as r
    from vigente v
    join mercado m on m.cod_barras = v.cod_barras
  )
  select
    z.cnpj_estabelecimento,
    max(z.nome_estabelecimento),
    max(z.bairro),
    max(z.cidade),
    count(distinct z.cod_barras),
    round(avg(z.preco_liquido), 2),
    round(avg(z.pmed_mercado), 2),
    round(avg(z.r), 4)
  from razao z
  group by z.cnpj_estabelecimento
  having count(distinct z.cod_barras) >= p_min_produtos
  order by avg(z.r) asc nulls last;
$$;


-- -----------------------------------------------------------------------------
-- rpc_evolucao_preco — tela Evolucao de Precos.
-- Serie diaria por estabelecimento. Alem das lojas, devolve uma serie extra com
-- cnpj_estabelecimento NULL e nome "Media de mercado", para a UI desenhar a
-- linha de referencia sem agregar nada no browser.
-- -----------------------------------------------------------------------------
create or replace function public.rpc_evolucao_preco(
  p_ean       text,
  p_estab     text default null,
  p_data_ini  date default null,
  p_data_fim  date default null
)
returns table (
  dia                   date,
  cnpj_estabelecimento  text,
  nome_estabelecimento  text,
  preco_medio           numeric,
  preco_min             numeric,
  preco_max             numeric,
  registros             bigint
)
language sql
stable
set search_path = ''
as $$
  with base as (
    select
      (b.data_nf at time zone 'America/Sao_Paulo')::date as dia,
      b.cnpj_estabelecimento,
      b.nome_estabelecimento,
      b.preco_liquido
    from public.v_precos_base b
    where b.cod_barras = nullif(p_ean, '')::bigint
      and b.preco_liquido is not null
      and (p_estab    is null or b.cnpj_estabelecimento = p_estab)
      and (p_data_ini is null or (b.data_nf at time zone 'America/Sao_Paulo')::date >= p_data_ini)
      and (p_data_fim is null or (b.data_nf at time zone 'America/Sao_Paulo')::date <= p_data_fim)
  )
  select
    b.dia,
    b.cnpj_estabelecimento,
    max(b.nome_estabelecimento),
    round(avg(b.preco_liquido), 2),
    min(b.preco_liquido),
    max(b.preco_liquido),
    count(*)
  from base b
  group by b.dia, b.cnpj_estabelecimento

  union all

  select
    b.dia,
    null::text,
    'Media de mercado'::text,
    round(avg(b.preco_liquido), 2),
    min(b.preco_liquido),
    max(b.preco_liquido),
    count(*)
  from base b
  group by b.dia

  order by 1 asc, 2 asc nulls first;
$$;


-- -----------------------------------------------------------------------------
-- rpc_dispersao_precos — tela Amplitude & Oportunidades.
-- amplitude_pct = (max - min) / min * 100, sobre os precos vigentes do recorte.
-- Exige por padrao >= 2 estabelecimentos: amplitude de um produto vendido em
-- uma loja so e sempre 0% e polui o ranking de oportunidades.
-- -----------------------------------------------------------------------------
create or replace function public.rpc_dispersao_precos(
  p_data_ini             date default null,
  p_data_fim             date default null,
  p_ncm_grupo            text default null,
  p_cidade               text default null,
  p_min_estabelecimentos int default 2,
  p_limit                int default 100
)
returns table (
  cod_barras        text,
  nome_exibicao     text,
  ncm_grupo         text,
  estabelecimentos  bigint,
  preco_min         numeric,
  preco_medio       numeric,
  preco_max         numeric,
  amplitude_pct     numeric
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
  ),
  vigente as (
    select distinct on (b.cod_barras, b.cnpj_estabelecimento) b.*
    from base b
    order by b.cod_barras, b.cnpj_estabelecimento, b.data_nf desc
  )
  select
    v.cod_barras::text,
    max(v.nome_exibicao),
    max(v.ncm_grupo),
    count(distinct v.cnpj_estabelecimento),
    min(v.preco_liquido),
    round(avg(v.preco_liquido), 2),
    max(v.preco_liquido),
    round((max(v.preco_liquido) - min(v.preco_liquido)) / nullif(min(v.preco_liquido), 0) * 100, 2)
  from vigente v
  group by v.cod_barras
  having count(distinct v.cnpj_estabelecimento) >= p_min_estabelecimentos
  order by
    round((max(v.preco_liquido) - min(v.preco_liquido)) / nullif(min(v.preco_liquido), 0) * 100, 2) desc nulls last
  limit p_limit;
$$;


-- -----------------------------------------------------------------------------
-- rpc_preco_categoria — tela Analise por Categoria (ncm_grupo).
-- -----------------------------------------------------------------------------
create or replace function public.rpc_preco_categoria(
  p_data_ini  date default null,
  p_data_fim  date default null,
  p_cidade    text default null
)
returns table (
  ncm_grupo         text,
  produtos          bigint,
  estabelecimentos  bigint,
  preco_min         numeric,
  preco_medio       numeric,
  preco_max         numeric,
  amplitude_pct     numeric
)
language sql
stable
set search_path = ''
as $$
  with base as (
    select b.*
    from public.v_precos_base b
    where b.preco_liquido is not null
      and (p_data_ini is null or (b.data_nf at time zone 'America/Sao_Paulo')::date >= p_data_ini)
      and (p_data_fim is null or (b.data_nf at time zone 'America/Sao_Paulo')::date <= p_data_fim)
      and (p_cidade   is null or b.cidade = p_cidade)
  ),
  vigente as (
    select distinct on (b.cod_barras, b.cnpj_estabelecimento) b.*
    from base b
    order by b.cod_barras, b.cnpj_estabelecimento, b.data_nf desc
  )
  select
    coalesce(v.ncm_grupo, 'Sem categoria'),
    count(distinct v.cod_barras),
    count(distinct v.cnpj_estabelecimento),
    min(v.preco_liquido),
    round(avg(v.preco_liquido), 2),
    max(v.preco_liquido),
    round((max(v.preco_liquido) - min(v.preco_liquido)) / nullif(min(v.preco_liquido), 0) * 100, 2)
  from vigente v
  group by coalesce(v.ncm_grupo, 'Sem categoria')
  order by count(distinct v.cod_barras) desc;
$$;


-- -----------------------------------------------------------------------------
-- rpc_preco_geografico — tela Analise Geografica (cidade x bairro).
-- -----------------------------------------------------------------------------
create or replace function public.rpc_preco_geografico(
  p_data_ini   date default null,
  p_data_fim   date default null,
  p_ncm_grupo  text default null
)
returns table (
  cidade            text,
  bairro            text,
  estabelecimentos  bigint,
  produtos          bigint,
  preco_min         numeric,
  preco_medio       numeric,
  preco_max         numeric
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
  ),
  vigente as (
    select distinct on (b.cod_barras, b.cnpj_estabelecimento) b.*
    from base b
    order by b.cod_barras, b.cnpj_estabelecimento, b.data_nf desc
  )
  select
    coalesce(v.cidade, 'Nao informada'),
    coalesce(v.bairro, 'Nao informado'),
    count(distinct v.cnpj_estabelecimento),
    count(distinct v.cod_barras),
    min(v.preco_liquido),
    round(avg(v.preco_liquido), 2),
    max(v.preco_liquido)
  from vigente v
  group by coalesce(v.cidade, 'Nao informada'), coalesce(v.bairro, 'Nao informado')
  order by coalesce(v.cidade, 'Nao informada') asc, round(avg(v.preco_liquido), 2) desc;
$$;


-- -----------------------------------------------------------------------------
-- rpc_filtros_disponiveis — ADICAO ao §6.4.
-- A barra de filtros globais do §9 precisa das opcoes de cidade / categoria e
-- do intervalo de datas do tenant. Sem esta RPC o frontend teria que baixar
-- linhas cruas para montar dropdowns, o que o §3 proibe explicitamente.
-- -----------------------------------------------------------------------------
create or replace function public.rpc_filtros_disponiveis()
returns table (
  cidades      text[],
  ncm_grupos   text[],
  data_min     date,
  data_max     date
)
language sql
stable
set search_path = ''
as $$
  select
    (select coalesce(array_agg(distinct b.cidade    order by b.cidade),    '{}') from public.v_precos_base b where b.cidade    is not null),
    (select coalesce(array_agg(distinct b.ncm_grupo order by b.ncm_grupo), '{}') from public.v_precos_base b where b.ncm_grupo is not null),
    (select (min(b.data_nf) at time zone 'America/Sao_Paulo')::date from public.v_precos_base b),
    (select (max(b.data_nf) at time zone 'America/Sao_Paulo')::date from public.v_precos_base b);
$$;


-- -----------------------------------------------------------------------------
-- Grants: nenhuma RPC exposta ao anon.
-- -----------------------------------------------------------------------------
revoke all on function public.rpc_kpis(date, date, text, text)                                from public;
revoke all on function public.rpc_comparativo_produto(text, date, date, text)                 from public;
revoke all on function public.rpc_ranking_estabelecimentos(date, date, text, text, int)       from public;
revoke all on function public.rpc_evolucao_preco(text, text, date, date)                      from public;
revoke all on function public.rpc_dispersao_precos(date, date, text, text, int, int)          from public;
revoke all on function public.rpc_preco_categoria(date, date, text)                           from public;
revoke all on function public.rpc_preco_geografico(date, date, text)                          from public;
revoke all on function public.rpc_filtros_disponiveis()                                       from public;

grant execute on function public.rpc_kpis(date, date, text, text)                          to authenticated, service_role;
grant execute on function public.rpc_comparativo_produto(text, date, date, text)           to authenticated, service_role;
grant execute on function public.rpc_ranking_estabelecimentos(date, date, text, text, int) to authenticated, service_role;
grant execute on function public.rpc_evolucao_preco(text, text, date, date)                to authenticated, service_role;
grant execute on function public.rpc_dispersao_precos(date, date, text, text, int, int)    to authenticated, service_role;
grant execute on function public.rpc_preco_categoria(date, date, text)                     to authenticated, service_role;
grant execute on function public.rpc_preco_geografico(date, date, text)                    to authenticated, service_role;
grant execute on function public.rpc_filtros_disponiveis()                                 to authenticated, service_role;

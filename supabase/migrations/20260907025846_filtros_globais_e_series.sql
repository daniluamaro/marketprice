-- =============================================================================
-- Fase 4.1 — Filtros globais (§9) e series para a Visao Geral
--
-- Acrescenta dois recortes que faltavam em toda a camada analitica, p_ean e
-- p_estab, e cria as funcoes que alimentam os graficos novos.
--
-- DECISAO DE SEMANTICA DO FILTRO DE ESTABELECIMENTO (importante):
--
--   Em rpc_kpis, rpc_preco_categoria e rpc_preco_geografico, p_estab filtra
--   LINHAS: "me mostre os numeros desta loja".
--
--   Em rpc_dispersao_precos e rpc_ranking_estabelecimentos ele significa outra
--   coisa: "restrinja o universo aos produtos QUE ESTA LOJA VENDE, mas continue
--   comparando com o mercado inteiro". O motivo e que amplitude e indice de
--   competitividade so existem na comparacao ENTRE lojas — filtrar as linhas
--   para uma unica loja daria amplitude 0% e um ranking de um item so, ou seja,
--   um filtro que destroi o proprio relatorio. Com esta leitura a pergunta vira
--   util: "dos produtos que eu vendo, quais tem mais dispersao no mercado?".
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Opcoes da barra de filtros, em uma unica chamada.
-- Substitui rpc_filtros_disponiveis, que nao trazia produtos nem lojas.
-- -----------------------------------------------------------------------------
create or replace function public.rpc_opcoes_filtro()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'data_min',
      (select (min(b.data_nf) at time zone 'America/Sao_Paulo')::date from public.v_precos_base b),
    'data_max',
      (select (max(b.data_nf) at time zone 'America/Sao_Paulo')::date from public.v_precos_base b),
    'cidades', coalesce(
      (select jsonb_agg(distinct b.cidade order by b.cidade)
         from public.v_precos_base b where b.cidade is not null), '[]'::jsonb),
    'ncm_grupos', coalesce(
      (select jsonb_agg(distinct b.ncm_grupo order by b.ncm_grupo)
         from public.v_precos_base b where b.ncm_grupo is not null), '[]'::jsonb),
    'produtos', coalesce(
      (select jsonb_agg(jsonb_build_object('ean', p.cod_barras::text, 'nome', p.nome_exibicao)
                        order by p.nome_exibicao)
         from public.v_produtos p), '[]'::jsonb),
    'estabelecimentos', coalesce(
      (select jsonb_agg(jsonb_build_object(
                'cnpj', e.cnpj_estabelecimento,
                'nome', e.nome_estabelecimento,
                'bairro', e.bairro,
                'cidade', e.cidade)
              order by e.nome_estabelecimento, e.bairro)
         from (select distinct on (v.cnpj_estabelecimento)
                      v.cnpj_estabelecimento, v.nome_estabelecimento, v.bairro, v.cidade
                 from public.v_preco_vigente v
                order by v.cnpj_estabelecimento, v.data_nf desc) e), '[]'::jsonb)
  );
$$;


-- -----------------------------------------------------------------------------
-- rpc_kpis — agora com p_ean e p_estab (filtro de linhas).
-- -----------------------------------------------------------------------------
drop function if exists public.rpc_kpis(date, date, text, text);

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
  amplitude_media_pct     numeric
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
    (select round(avg(a.amp), 1) from amplitudes a);
$$;


-- -----------------------------------------------------------------------------
-- rpc_dispersao_precos — p_ean filtra o produto; p_estab restringe o universo
-- aos produtos vendidos por aquela loja (ver nota do topo).
-- -----------------------------------------------------------------------------
drop function if exists public.rpc_dispersao_precos(date, date, text, text, int, int);

create function public.rpc_dispersao_precos(
  p_data_ini             date default null,
  p_data_fim             date default null,
  p_ncm_grupo            text default null,
  p_cidade               text default null,
  p_ean                  text default null,
  p_estab                text default null,
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
      and (p_ean       is null or b.cod_barras = nullif(p_ean, '')::bigint)
  ),
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
  )
  select
    v.cod_barras::text,
    max(v.nome_exibicao),
    max(v.ncm_grupo),
    count(distinct v.cnpj_estabelecimento),
    min(v.preco_liquido),
    round(avg(v.preco_liquido), 2),
    max(v.preco_liquido),
    round((max(v.preco_liquido) - min(v.preco_liquido))
          / nullif(min(v.preco_liquido), 0) * 100, 2)
  from vigente v
  group by v.cod_barras
  having count(distinct v.cnpj_estabelecimento) >= p_min_estabelecimentos
  order by round((max(v.preco_liquido) - min(v.preco_liquido))
                 / nullif(min(v.preco_liquido), 0) * 100, 2) desc nulls last
  limit p_limit;
$$;


-- -----------------------------------------------------------------------------
-- rpc_ranking_estabelecimentos — mesma logica de universo para p_estab.
-- -----------------------------------------------------------------------------
drop function if exists public.rpc_ranking_estabelecimentos(date, date, text, text, int);

create function public.rpc_ranking_estabelecimentos(
  p_data_ini      date default null,
  p_data_fim      date default null,
  p_ncm_grupo     text default null,
  p_cidade        text default null,
  p_ean           text default null,
  p_estab         text default null,
  p_min_produtos  int  default 1,
  p_limit         int  default 100
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
      and (p_ean       is null or b.cod_barras = nullif(p_ean, '')::bigint)
  ),
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
    select v.cod_barras, avg(v.preco_liquido) as pmed_mercado
    from vigente v group by v.cod_barras
  ),
  razao as (
    select v.cnpj_estabelecimento, v.nome_estabelecimento, v.bairro, v.cidade,
           v.cod_barras, v.preco_liquido, m.pmed_mercado,
           v.preco_liquido / nullif(m.pmed_mercado, 0) as r
    from vigente v join mercado m on m.cod_barras = v.cod_barras
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
  order by avg(z.r) asc nulls last
  limit p_limit;
$$;


-- -----------------------------------------------------------------------------
-- rpc_preco_categoria — filtros completos.
-- -----------------------------------------------------------------------------
drop function if exists public.rpc_preco_categoria(date, date, text);

create function public.rpc_preco_categoria(
  p_data_ini  date default null,
  p_data_fim  date default null,
  p_cidade    text default null,
  p_ean       text default null,
  p_estab     text default null
)
returns table (
  ncm_grupo              text,
  produtos               bigint,
  estabelecimentos       bigint,
  preco_min              numeric,
  preco_medio            numeric,
  preco_max              numeric,
  amplitude_mediana_pct  numeric
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
      and (p_ean      is null or b.cod_barras = nullif(p_ean, '')::bigint)
      and (p_estab    is null or b.cnpj_estabelecimento = p_estab)
  ),
  vigente as (
    select distinct on (b.cod_barras, b.cnpj_estabelecimento) b.*
    from base b
    order by b.cod_barras, b.cnpj_estabelecimento, b.data_nf desc
  ),
  por_produto as (
    select coalesce(v.ncm_grupo, 'Sem categoria') as grupo,
           v.cod_barras,
           count(distinct v.cnpj_estabelecimento) as lojas,
           (max(v.preco_liquido) - min(v.preco_liquido))
             / nullif(min(v.preco_liquido), 0) * 100 as amplitude
    from vigente v
    group by coalesce(v.ncm_grupo, 'Sem categoria'), v.cod_barras
  ),
  agregado as (
    select coalesce(v.ncm_grupo, 'Sem categoria') as grupo,
           count(distinct v.cod_barras)           as produtos,
           count(distinct v.cnpj_estabelecimento) as estabelecimentos,
           min(v.preco_liquido)                   as preco_min,
           round(avg(v.preco_liquido), 2)         as preco_medio,
           max(v.preco_liquido)                   as preco_max
    from vigente v
    group by coalesce(v.ncm_grupo, 'Sem categoria')
  ),
  mediana as (
    select pp.grupo,
           round(percentile_cont(0.5) within group
                 (order by pp.amplitude::double precision)::numeric, 2) as amp_mediana
    from por_produto pp
    where pp.lojas >= 2
    group by pp.grupo
  )
  select a.grupo, a.produtos, a.estabelecimentos,
         a.preco_min, a.preco_medio, a.preco_max, m.amp_mediana
  from agregado a
  left join mediana m on m.grupo = a.grupo
  order by a.produtos desc;
$$;


-- -----------------------------------------------------------------------------
-- rpc_preco_geografico — filtros completos, agora tambem por cidade.
-- -----------------------------------------------------------------------------
drop function if exists public.rpc_preco_geografico(date, date, text);

create function public.rpc_preco_geografico(
  p_data_ini   date default null,
  p_data_fim   date default null,
  p_ncm_grupo  text default null,
  p_cidade     text default null,
  p_ean        text default null,
  p_estab      text default null
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
      and (p_cidade    is null or b.cidade    = p_cidade)
      and (p_ean       is null or b.cod_barras = nullif(p_ean, '')::bigint)
      and (p_estab     is null or b.cnpj_estabelecimento = p_estab)
  ),
  vigente as (
    select distinct on (b.cod_barras, b.cnpj_estabelecimento) b.*
    from base b
    order by b.cod_barras, b.cnpj_estabelecimento, b.data_nf desc
  )
  select
    coalesce(v.cidade, 'Não informada'),
    coalesce(v.bairro, 'Não informado'),
    count(distinct v.cnpj_estabelecimento),
    count(distinct v.cod_barras),
    min(v.preco_liquido),
    round(avg(v.preco_liquido), 2),
    max(v.preco_liquido)
  from vigente v
  group by coalesce(v.cidade, 'Não informada'), coalesce(v.bairro, 'Não informado')
  order by coalesce(v.cidade, 'Não informada') asc, round(avg(v.preco_liquido), 2) desc;
$$;


-- -----------------------------------------------------------------------------
-- rpc_evolucao_mercado — serie diaria do preco medio do recorte inteiro.
-- Diferente de rpc_evolucao_preco, que e de UM produto: esta responde "o
-- mercado que eu monitoro esta subindo ou descendo?".
-- -----------------------------------------------------------------------------
create or replace function public.rpc_evolucao_mercado(
  p_data_ini   date default null,
  p_data_fim   date default null,
  p_ncm_grupo  text default null,
  p_cidade     text default null,
  p_ean        text default null,
  p_estab      text default null
)
returns table (
  dia            date,
  preco_medio    numeric,
  preco_min      numeric,
  preco_max      numeric,
  produtos       bigint,
  estabelecimentos bigint,
  registros      bigint
)
language sql
stable
set search_path = ''
as $$
  select
    (b.data_nf at time zone 'America/Sao_Paulo')::date,
    round(avg(b.preco_liquido), 2),
    min(b.preco_liquido),
    max(b.preco_liquido),
    count(distinct b.cod_barras),
    count(distinct b.cnpj_estabelecimento),
    count(*)
  from public.v_precos_base b
  where b.preco_liquido is not null
    and (p_data_ini  is null or (b.data_nf at time zone 'America/Sao_Paulo')::date >= p_data_ini)
    and (p_data_fim  is null or (b.data_nf at time zone 'America/Sao_Paulo')::date <= p_data_fim)
    and (p_ncm_grupo is null or b.ncm_grupo = p_ncm_grupo)
    and (p_cidade    is null or b.cidade    = p_cidade)
    and (p_ean       is null or b.cod_barras = nullif(p_ean, '')::bigint)
    and (p_estab     is null or b.cnpj_estabelecimento = p_estab)
  group by (b.data_nf at time zone 'America/Sao_Paulo')::date
  order by 1;
$$;


-- -----------------------------------------------------------------------------
-- Grants. Nenhuma exposta ao anon.
-- -----------------------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'rpc\_%'
  loop
    execute format('revoke all on function %s from public, anon', f.assinatura);
    execute format('grant execute on function %s to authenticated, service_role', f.assinatura);
  end loop;
end $$;

-- =============================================================================
-- Fase 4 — Frequencia de NFC-e por EAN (proxy de participacao de mercado)
--
-- A fonte NAO tem quantidade vendida (CLAUDE.md §4.1), entao market share real
-- e impossivel. O proxy adotado, a pedido do cliente, e a CONTAGEM DE CUPONS
-- em que o produto aparece: se o item sai em muitas NFC-e, ele gira mais.
--
-- ------------------------------------------------------------------ ATENCAO --
-- Estas RPCs contam APARICOES EM CUPONS COLETADOS, nao vendas. Duas limitacoes
-- que precisam estar claras para quem interpreta o numero:
--
--   1. Um cupom com 1 unidade e um cupom com 12 unidades contam igual — o
--      volume nao existe na fonte.
--   2. O denominador e a coleta, nao o mercado. Se o fluxo captura mais cupons
--      de uma loja que de outra, o "share" reflete a coleta antes de refletir
--      a venda. Enquanto houver ~1 cupom por loja/EAN, este numero e leitura
--      de COBERTURA; ele so vira sinal de giro conforme a base acumula varios
--      cupons da mesma loja ao longo do tempo.
--
-- Por isso `registros` e `estabelecimentos` voltam junto de `nfce`: e a
-- comparacao entre os tres que denuncia qual dos dois regimes esta valendo.
-- -----------------------------------------------------------------------------
--
-- SEM `distinct on` aqui, de proposito: as telas de preco usam o preco VIGENTE
-- (um por loja), mas frequencia precisa de TODA ocorrencia — reduzir ao vigente
-- destruiria justamente o que se quer contar.
--
-- cod_nfce e globalmente unico na base (verificado: count(distinct cod_nfce) =
-- count(distinct loja||cupom)), entao `count(distinct b.cod_nfce)` nao corre o
-- risco de fundir cupons de lojas diferentes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Frequencia por EAN — "quais produtos giram mais no recorte"
--
-- Dois percentuais, porque respondem coisas diferentes:
--   share_pct      = fatia do produto no total de aparicoes (soma 100% entre os
--                    produtos) -> e a leitura de "market share" pedida.
--   penetracao_pct = em quantos % dos cupons do recorte o item aparece (NAO
--                    soma 100%, ja que um cupom pode conter varios itens).
-- -----------------------------------------------------------------------------
create or replace function public.rpc_frequencia_produto(
  p_data_ini  date default null,
  p_data_fim  date default null,
  p_ncm_grupo text default null,
  p_cidade    text default null,
  p_ean       text default null,
  p_estab     text default null,
  p_limit     int  default 200
)
returns table (
  cod_barras       bigint,
  nome_exibicao    text,
  ncm_grupo        text,
  nfce             bigint,
  registros        bigint,
  estabelecimentos bigint,
  cidades          bigint,
  bairros          bigint,
  share_pct        numeric,
  penetracao_pct   numeric,
  preco_medio      numeric,
  primeira_nf      date,
  ultima_nf        date
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
  por as (
    select
      b.cod_barras,
      max(b.nome_exibicao)                    as nome_exibicao,
      max(b.ncm_grupo)                        as ncm_grupo,
      count(distinct b.cod_nfce)              as nfce,
      count(*)                                as registros,
      count(distinct b.cnpj_estabelecimento)  as estabelecimentos,
      count(distinct b.cidade)                as cidades,
      count(distinct b.bairro)                as bairros,
      round(avg(b.preco_liquido), 2)          as preco_medio,
      min((b.data_nf at time zone 'America/Sao_Paulo')::date) as primeira,
      max((b.data_nf at time zone 'America/Sao_Paulo')::date) as ultima
    from base b
    group by b.cod_barras
  ),
  tot as (
    select
      sum(p.nfce)                                     as soma_aparicoes,
      (select count(distinct b.cod_nfce) from base b) as cupons
    from por p
  )
  select
    p.cod_barras,
    p.nome_exibicao,
    p.ncm_grupo,
    p.nfce,
    p.registros,
    p.estabelecimentos,
    p.cidades,
    p.bairros,
    round(p.nfce::numeric / nullif(t.soma_aparicoes, 0) * 100, 1),
    round(p.nfce::numeric / nullif(t.cupons, 0)         * 100, 1),
    p.preco_medio,
    p.primeira,
    p.ultima
  from por p
  cross join tot t
  order by p.nfce desc, p.registros desc, p.nome_exibicao asc
  limit p_limit;
$$;

revoke all    on function public.rpc_frequencia_produto(date, date, text, text, text, text, int) from public, anon;
grant execute on function public.rpc_frequencia_produto(date, date, text, text, text, text, int) to authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 2. Frequencia por EAN x dimensao — estabelecimento, cidade ou bairro
--
-- Uma RPC so para as tres quebras: a conta e identica e muda apenas a chave de
-- agrupamento. Tres funcoes quase iguais divergiriam na primeira correcao.
--
-- Bairro agrupa por (cidade, bairro), nunca so pelo nome: "Centro" existe em
-- toda cidade e somar todos eles produziria um bairro fantasma.
--
-- plpgsql (e nao sql) por causa da validacao de p_dimensao: um valor
-- desconhecido precisa FALHAR. Com `case ... else estabelecimento` a tela
-- pediria "cidade", receberia loja e ninguem perceberia.
-- -----------------------------------------------------------------------------
create or replace function public.rpc_frequencia_dimensao(
  p_dimensao  text,
  p_data_ini  date default null,
  p_data_fim  date default null,
  p_ncm_grupo text default null,
  p_cidade    text default null,
  p_ean       text default null,
  p_estab     text default null,
  p_limit     int  default 300
)
returns table (
  cod_barras        bigint,
  nome_exibicao     text,
  chave_id          text,
  chave             text,
  contexto          text,
  nfce              bigint,
  registros         bigint,
  share_produto_pct numeric,
  share_local_pct   numeric,
  preco_medio       numeric
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_dim text := lower(coalesce(p_dimensao, ''));
begin
  if v_dim not in ('estabelecimento', 'cidade', 'bairro') then
    raise exception 'dimensao invalida: %. Use estabelecimento, cidade ou bairro.', p_dimensao
      using errcode = 'invalid_parameter_value';
  end if;

  return query
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
  dim as (
    select
      b.cod_barras,
      b.nome_exibicao,
      b.cod_nfce,
      b.preco_liquido,
      case v_dim
        when 'estabelecimento' then b.cnpj_estabelecimento
        when 'cidade'          then coalesce(b.cidade, 'Não informada')
        else coalesce(b.cidade, 'Não informada') || ' · ' || coalesce(b.bairro, 'Não informado')
      end as chave_id,
      case v_dim
        when 'estabelecimento' then coalesce(b.nome_estabelecimento, b.cnpj_estabelecimento)
        when 'cidade'          then coalesce(b.cidade, 'Não informada')
        else coalesce(b.bairro, 'Não informado')
      end as chave,
      case v_dim
        when 'estabelecimento' then nullif(concat_ws(' · ', b.bairro, b.cidade), '')
        when 'cidade'          then null
        else b.cidade
      end as contexto
    from base b
  ),
  agrupado as (
    select
      d.cod_barras,
      max(d.nome_exibicao)           as nome_exibicao,
      d.chave_id,
      max(d.chave)                   as chave,
      max(d.contexto)                as contexto,
      count(distinct d.cod_nfce)     as nfce,
      count(*)                       as registros,
      round(avg(d.preco_liquido), 2) as preco_medio
    from dim d
    group by d.cod_barras, d.chave_id
  )
  select
    a.cod_barras,
    a.nome_exibicao,
    a.chave_id,
    a.chave,
    a.contexto,
    a.nfce,
    a.registros,
    -- Quanto este local representa do giro DO PRODUTO (soma 100% por EAN).
    round(a.nfce::numeric
          / nullif(sum(a.nfce) over (partition by a.cod_barras), 0) * 100, 1),
    -- Quanto este produto representa do giro DO LOCAL (soma 100% por local).
    round(a.nfce::numeric
          / nullif(sum(a.nfce) over (partition by a.chave_id), 0) * 100, 1),
    a.preco_medio
  from agrupado a
  order by a.nfce desc, a.registros desc, a.chave asc
  limit p_limit;
end;
$$;

revoke all    on function public.rpc_frequencia_dimensao(text, date, date, text, text, text, text, int) from public, anon;
grant execute on function public.rpc_frequencia_dimensao(text, date, date, text, text, text, text, int) to authenticated, service_role;

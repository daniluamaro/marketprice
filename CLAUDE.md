# CLAUDE.md — Plataforma de Inteligência de Preços (Performar · produto comercial)

> Contrato de trabalho para o Claude Code. Leia por inteiro antes de escrever
> qualquer linha. Define **o que** construir, **como** construir, **o nível de
> acabamento exigido** e **as regras de execução**. Em conflito entre o que
> você acha e o que está aqui, **este documento vence**; se discordar
> tecnicamente, levante a questão antes de agir.

---

## 0. Missão e barra de qualidade (leia isto primeiro)

Este é um **produto SaaS que será vendido por assinatura** (acesso pago por
empresa cliente). Isso muda o padrão de entrega: **não é um protótipo, não é um
dashboard interno, não pode ter cara de amador.** Cada tela precisa parecer um
produto que um cliente pagaria para usar.

O critério de aceite visual é simples e severo: **se qualquer tela parecer um
template genérico, um admin do Bootstrap, ou uma demonstração de faculdade, está
reprovado.** Trate a §10 (Design System) com o mesmo rigor que a lógica de
dados.

> Existe um arquivo de **mockup de referência** (`dash-preco-da-hora.html`)
> apenas para comunicar o **nível de acabamento e a linguagem visual desejada**
> (tema escuro sofisticado, tipografia refinada, uso semântico de cor, densidade
> de informação bem resolvida). **Não copie o conteúdo, o layout literal nem os
> dados dele.** Use-o como régua de qualidade, não como gabarito.

---

## 1. Contexto e objetivo

Aplicação web **multi-tenant de inteligência de preços**. Uma base no Supabase
(Postgres) é alimentada continuamente por um fluxo externo (n8n) com preços de
produtos coletados de NFC-e, por EAN, estabelecimento e cidade.

Cada empresa cliente enxerga **apenas os dados do seu próprio CNPJ** e usa o
dashboard para decidir posicionamento, negociação e competitividade de preço.

**Regras inegociáveis do produto:**

- Login por e-mail/senha. Ao autenticar, o sistema identifica **o CNPJ do
  usuário** e filtra **tudo** por esse CNPJ (isolamento total entre clientes).
- Sidebar fixa à esquerda com múltiplos relatórios.
- Visual **premium** (ver §0 e §10).
- Dados **dinâmicos**: novos registros no Supabase refletem nos relatórios sem
  redeploy.
- Publicação em **GitHub Pages**, sob `marketprice.vemperformar.com.br`.
- Controle de acesso comercial: admin ativa/desativa clientes; usuário inativo
  não entra.

---

## 2. Stack tecnológico (fixado — não substituir sem aprovação)

| Camada         | Tecnologia                                                    |
|----------------|---------------------------------------------------------------|
| Build/Frontend | **Vite + React + TypeScript** (strict mode)                   |
| Estilo         | **Tailwind CSS** + **shadcn/ui**, tema via design tokens (§10)|
| Gráficos       | **Apache ECharts** (`echarts-for-react`) com **tema custom**  |
| Estado/Dados   | **TanStack Query** + **Zustand** (UI state)                   |
| Ícones         | **lucide-react** (linha fina, consistente)                    |
| Roteamento     | **React Router** (`BrowserRouter` + fallback SPA — §11)       |
| Backend/Dados  | **Supabase** (Postgres + Auth + RLS + Edge Functions)         |
| Cliente API    | **@supabase/supabase-js** (somente a `anon` key no frontend)  |
| Formatação     | **`Intl` pt-BR** para moeda, número e data (§10.6)            |
| Deploy         | **GitHub Actions → GitHub Pages** (domínio custom)            |

**Por que não Python e por que não HTML/JS puro:** GitHub Pages serve só
estático — não roda backend. O visual (HTML/CSS) do mockup é ótimo e **é
exatamente o que o React renderiza**; React não substitui o CSS, ele o gera. O
que o React resolve é a máquina que um HTML puro não sustenta de forma
manutenível: sessão, dados ao vivo por tenant, filtros cruzados, gráficos
interativos e export.

---

## 3. Arquitetura geral

```
┌─────────────────────────────────┐        ┌──────────────────────────────┐
│ SPA estática (GitHub Pages)     │  HTTPS │           Supabase           │
│ marketprice.vemperformar.com.br │◄──────►│  • Auth (e-mail/senha)       │
│ React + Vite + ECharts          │        │  • Postgres + RLS            │
│ usa apenas a ANON KEY           │        │  • Views / RPC (agregações)  │
│                                 │        │  • Edge Function (admin)     │
└─────────────────────────────────┘        └──────────────────────────────┘
```

- Segurança de dados **100% no servidor** via RLS. A `anon` key é pública por
  design; só libera o que a RLS permitir para o usuário logado.
- Agregações **no Postgres** (views/RPC), nunca somando linhas cruas no browser.
- Criação de usuários (privilegiada) só em **Edge Function** com `service_role`.

---

## 4. Modelo de dados

### 4.1 Tabela de fatos (JÁ EXISTE E JÁ TEM DADOS — NÃO CRIAR / NÃO ALTERAR)

> **Atenção:** esta tabela **já foi criada pelo Danilo e já está populada** (é
> alimentada por um fluxo n8n). **Não crie, não recrie e não altere a estrutura
> dela.** O papel do Claude Code é **conectar no Supabase via MCP, visualizar a
> tabela existente** e construir **em cima** dela (a `profiles`, a RLS, as views
> e as RPC). Qualquer `create table`/`alter table` sobre a tabela de fatos é
> proibido.

**Fase 0 obrigatória:** via MCP do Supabase, inspecione o schema real e confirme
**nome exato da tabela** e **tipos das colunas** antes de assumir qualquer coisa.
Colunas da amostra (22):

`pk_chave`, **`CNPJ_contratante` (chave de tenant)**, `nome_contratante`,
`cod_nfce`, `tipo_nfce`, **`cod_barras` (EAN — identidade canônica do produto)**,
`nome_produto` (bruto, não normalizado), `classe_item`, `cod_ncm`, `ncm_grupo`,
`preco_bruto`, **`preco_liquido` (preço de referência)**, `desconto`, `unidade`,
`cnpj_estabelecimento`, `nome_estabelecimento`, `bairro`, `cod_cidade`, `cidade`,
`telefone`, **`data_nf` (define preço vigente e série temporal)**, `data_consulta`.

**Regras de negócio confirmadas:**

- Comparação de produto é **por `cod_barras`**, nunca por `nome_produto`.
- Preço de todas as análises: **`preco_liquido`**.
- "Preço vigente" = registro **mais recente por `data_nf`** para o par
  (`cod_barras`, `cnpj_estabelecimento`).
- A fonte **não tem quantidade vendida** — sem "market share" real; as análises
  são de **posicionamento/competitividade de preço**.
- Compare `CNPJ_contratante` como **texto** (cast se a coluna vier numérica).

### 4.2 Tabela `profiles` (esta SIM deve ser criada — via migration)

Diferente da tabela de fatos (§4.1), a `profiles` **ainda não existe** e é o
Claude Code quem a cria. Liga cada usuário a **um único CNPJ**, define papel,
**estado comercial** e o controle de **senha provisória**.

```sql
create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  email             text not null,
  cnpj_contratante  text not null,
  nome_contratante  text,
  role              text not null default 'user' check (role in ('user','admin')),
  ativo             boolean not null default true,       -- gate de acesso pago
  plano             text default 'padrao',               -- rótulo comercial
  senha_provisoria  boolean not null default true,       -- força troca no 1º acesso
  created_at        timestamptz not null default now()
);
create index on public.profiles (cnpj_contratante);
```

---

## 5. Segurança e multi-tenancy (RLS)

```sql
-- tenant do usuário logado
create or replace function public.current_cnpj()
returns text language sql stable security definer set search_path = public as $$
  select cnpj_contratante from public.profiles
  where id = auth.uid() and ativo = true
$$;

-- RLS na tabela de fatos (usuário inativo => current_cnpj() nulo => vê nada)
alter table public.database_coleta enable row level security;
create policy "tenant_pode_ler_seus_dados" on public.database_coleta
for select using ( "CNPJ_contratante"::text = public.current_cnpj() );

-- RLS em profiles
alter table public.profiles enable row level security;
create policy "self_read" on public.profiles for select using ( id = auth.uid() );
create policy "admin_read_all" on public.profiles for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role='admin')
);
```

**Regras de chave (CRÍTICO):**

- `service_role` **nunca** no frontend, no build, nos secrets do frontend ou em
  arquivo versionado. Só como *secret* da Edge Function.
- No Supabase → Auth → Email: **desabilitar cadastro público** (só admin cria).
- **Sem servidor de e-mail / sem Resend / sem SMTP.** Não há convite, confirmação
  nem recuperação de senha por e-mail. O provisionamento é manual (ver §7).
- Escrita em `profiles` só via Edge Function ou via RPC restrito — não crie policy
  de escrita ampla p/ cliente (única exceção controlada: o RPC de troca de senha
  do próprio usuário, §7).

---

## 6. Camada analítica (views e RPC)

Toda agregação vive no Postgres, respeitando RLS. **Views com
`security_invoker=true`** (senão a view "vaza" dados de outros tenants). Funções
`rpc_*` são `SECURITY INVOKER` por padrão — mantenha assim.

### 6.1 Dimensão de produto — nome de exibição = **mais frequente por EAN**

Desempate: maior frequência → nome mais curto → alfabética.

```sql
create or replace view public.v_produtos with (security_invoker = true) as
with contagem as (
  select cod_barras, nome_produto, count(*) as freq,
         max(ncm_grupo) as ncm_grupo, max(classe_item) as classe_item
  from public.database_coleta group by cod_barras, nome_produto
)
select distinct on (cod_barras)
       cod_barras, nome_produto as nome_exibicao, ncm_grupo, classe_item
from contagem
order by cod_barras, freq desc, length(nome_produto) asc, nome_produto asc;
```

### 6.2 Preço vigente (último `data_nf` por produto/estabelecimento)

```sql
create or replace view public.v_preco_vigente with (security_invoker = true) as
select distinct on (cod_barras, cnpj_estabelecimento)
       cod_barras, cnpj_estabelecimento, nome_estabelecimento,
       bairro, cidade, cod_cidade, preco_liquido, data_nf
from public.database_coleta
order by cod_barras, cnpj_estabelecimento, data_nf desc;
```

### 6.3 Fato enriquecido (tabela detalhada e filtros)

```sql
create or replace view public.v_precos_base with (security_invoker = true) as
select f.cod_barras, p.nome_exibicao, f.nome_produto as nome_original,
       p.ncm_grupo, p.classe_item, f.cnpj_estabelecimento, f.nome_estabelecimento,
       f.bairro, f.cidade, f.cod_cidade, f.preco_liquido, f.data_nf, f.data_consulta
from public.database_coleta f
join public.v_produtos p using (cod_barras);
```

### 6.4 Funções RPC (implementar, todas herdando RLS)

- `rpc_kpis()` → nº produtos, nº estabelecimentos, nº cidades, preço médio,
  última coleta (`max(data_nf)`), variação recente.
- `rpc_comparativo_produto(p_ean text)` → preço vigente por estabelecimento;
  min/média/máx e **spread %**.
- `rpc_ranking_estabelecimentos()` → **índice de competitividade** por loja
  (preço médio da loja ÷ média de mercado dos mesmos produtos).
- `rpc_evolucao_preco(p_ean text, p_estab text default null)` → série temporal
  por `data_nf`.
- `rpc_dispersao_precos()` → min/média/máx e **amplitude %** por produto,
  ordenado por maior amplitude (oportunidades).
- `rpc_preco_categoria()` → agregados por `ncm_grupo`.
- `rpc_preco_geografico()` → preço médio por cidade e bairro.

Aceite parâmetros de filtro global (período `data_nf`, categoria, cidade) onde
fizer sentido (§9, barra de filtros).

---

## 7. Autenticação, controle de acesso e admin (fluxo SEM e-mail)

**Premissa:** não há servidor de e-mail. Todo o provisionamento é **manual pelo
admin**, e a senha é repassada ao cliente **por fora do sistema**
(WhatsApp/telefone). Nada de convite, confirmação ou recuperação por e-mail.

- **Tela de login (minimalista — ver §10.7):** contém **apenas** campo de
  e-mail, campo de senha e botão **Entrar**. **Sem** link de "esqueci a senha",
  **sem** cadastro, **sem** login social.
- **Gate comercial:** ao logar, buscar `profile`. Se `ativo = false`, **bloquear
  com tela explicativa** ("acesso suspenso — fale com o suporte"), sem vazar dados.
- **Troca de senha no 1º acesso (obrigatória):** se `profiles.senha_provisoria =
  true`, após autenticar o app **redireciona para a tela "definir nova senha"** e
  **não libera o dashboard** enquanto a troca não ocorrer. A troca usa
  `supabase.auth.updateUser({ password })` (funciona no cliente, sem e-mail) e, em
  seguida, chama o RPC `rpc_confirmar_troca_senha()` para marcar
  `senha_provisoria = false`.
- **Esqueci a senha:** **não há autoatendimento.** O cliente contata o admin, que
  reseta a senha pela tela de Administração (gera nova senha provisória e a
  repassa por fora); no próximo login o cliente é forçado a trocá-la.
- **Sessão:** guardar `cnpj_contratante`, `nome_contratante`, `role`, `plano`,
  `senha_provisoria` (Zustand). Rotas protegidas; persistir sessão entre reloads.
- **Papéis:** `user` (relatórios do próprio CNPJ) e `admin` (também a seção
  Administração).

**Administração (só admin) — gestão de acessos:** listar, criar, editar
(nome/CNPJ/papel/plano), **ativar/desativar** e **resetar senha**. As operações
que exigem `service_role` rodam na **Edge Function `admin-users`**, que valida que
o chamador é `admin` antes de agir:

- **Criar usuário:** `auth.admin.createUser({ email, password: <senha_provisoria>,
  email_confirm: true })` + `insert`/`upsert` em `profiles` (CNPJ, nome, papel,
  plano, `senha_provisoria = true`). O admin anota a senha provisória e a repassa
  manualmente ao cliente.
- **Resetar senha:** `auth.admin.updateUserById(id, { password:
  <nova_senha_provisoria> })` + `senha_provisoria = true` no profile.
- **Ativar/Desativar:** alterna `profiles.ativo` (revoga/reativa o acesso pago).
- Frontend chama tudo via
  `supabase.functions.invoke('admin-users', { body: { action, ... } })`.

**RPC de troca de senha (SECURITY DEFINER, restrito ao próprio usuário):**

```sql
create or replace function public.rpc_confirmar_troca_senha()
returns void language sql security definer set search_path = public as $$
  update public.profiles set senha_provisoria = false where id = auth.uid();
$$;
```

**Escopo de dados do admin (default):** admin também vê só o próprio CNPJ nos
relatórios; o extra dele é a Administração. Um "super-admin" que troca de tenant
é variante futura — **não implementar sem aprovação.**

---

## 8. Camada comercial (venda de acessos)

- O trio `ativo` + `plano` + `senha_provisoria` sustenta o modelo de assinatura
  no MVP: o admin provisiona o cliente **manualmente** ao vender (cria o usuário,
  gera a senha provisória e a repassa por fora) e desativa quando cancela/inadimple.
- **Fora do escopo agora** (não implementar sem aprovação): checkout/pagamento
  automático (Stripe/Mercado Pago), autoatendimento de assinatura, trials
  automáticos. Deixe o código organizado para permitir isso depois.

---

## 9. Relatórios / telas (todas no MVP)

**Sidebar fixa** (ícones lucide, item ativo destacado, colapsável):

1. **Visão Geral** — KPIs (`rpc_kpis`) + destaques (produto de maior amplitude,
   loja mais competitiva) + gráfico-resumo. Exiba **"dados atualizados em
   {última coleta}"** como sinal de confiança.
2. **Comparativo de Preços** — busca de produto (EAN/nome);
   `rpc_comparativo_produto`: barras horizontais ordenadas + badges de spread %.
3. **Ranking de Estabelecimentos** — `rpc_ranking_estabelecimentos`: barras do
   índice + tabela ordenável.
4. **Evolução de Preços** — `rpc_evolucao_preco`: linha por `data_nf`, seleção de
   produto e comparação entre lojas.
5. **Amplitude & Oportunidades** — `rpc_dispersao_precos`: min–média–máx /
   boxplot por produto, ordenado por amplitude.
6. **Análise por Categoria** — `rpc_preco_categoria` (treemap ou barras).
7. **Análise Geográfica** — `rpc_preco_geografico` (por cidade/bairro).
8. **Dados Detalhados** — `v_precos_base` com filtros, **paginação server-side**
   e **export CSV**.
9. **Administração** — *(só admin)* gestão de acessos (§7/§8).

**Barra superior:** filtros globais (período por `data_nf`, categoria, cidade),
nome da empresa logada, avatar, logout.

**Dinamismo:** TanStack Query com `refetchOnWindowFocus` + botão "Atualizar" e
`staleTime` curto. (Supabase Realtime é opcional — não implementar sem aprovação.)

> **Módulos opcionais (NÃO no MVP, dependem de decisão de dados):** "Cobertura &
> Leads" e "Giro & Frequência" exigem um conceito de **marca/produtos próprios do
> cliente** (flag/tabela ligando o `CNPJ_contratante` aos seus EANs/marcas), que
> ainda não existe. Deixe a arquitetura aberta para adicioná-los, mas **não os
> construa agora.**

---

## 10. Design System & Barra de Qualidade Visual (tratar como requisito, não enfeite)

O objetivo desta seção é impedir aparência amadora. Implemente um **sistema de
design**, não estilos avulsos por tela.

### 10.1 Direção visual

- **Tema escuro sofisticado como padrão** (na linha do mockup de referência):
  fundos em camadas (base → painel → elevado), contraste controlado, **sem
  preto puro (#000) nem branco puro (#fff)**. Um único **acento de marca**
  usado com parcimônia. Modo claro é opcional/futuro.
- Densidade de informação alta, porém **respirável**: espaçamento consistente,
  alinhamento rigoroso, nada "espremido" nem "solto demais".

### 10.2 Tokens (definir uma vez, no Tailwind config + CSS vars; consumir via shadcn)

Valores de **referência** (ajuste fino é bem-vindo; a estrutura é obrigatória):

```css
:root{
  /* superfícies */
  --bg-base:#0A0E1A; --bg-panel:#0F1524; --bg-elevated:#141B2E; --bg-hover:#1A2237;
  --border:#212A42; --border-soft:#1A2237;
  /* acento de marca (token — pode ser calibrado p/ a identidade da Performar) */
  --accent:#D4AF37; --accent-bright:#F0CC5C; --accent-dim:#8A7328;
  /* texto */
  --text-primary:#EEF1F8; --text-secondary:#8D96B0; --text-tertiary:#5C6480;
  /* semântico */
  --success:#3DDC97; --danger:#FF6B6B; --warning:#F0B429;
  /* raio + tipografia */
  --radius:10px;
  --font-display:'Manrope',sans-serif; --font-body:'Inter',sans-serif;
  --font-mono:'JetBrains Mono',monospace;
}
```

- Escala de espaçamento coerente (ex.: 4/8/12/16/20/24/32). Nada de valores
  aleatórios.
- Sombra sutil só onde há hierarquia real; bordas de 1px `--border` para separar
  painéis.

### 10.3 Tipografia

- **Display** (Manrope) para títulos; **corpo** (Inter) para texto; **mono**
  (JetBrains Mono) **para todo número** (preços, KPIs, %, contagens) — números
  monoespaçados são o que dá cara de produto de dados sério.
- Hierarquia clara: KPI grande e legível, rótulos em caixa alta discreta,
  `letter-spacing` leve em labels.
- Carregar fontes via Google Fonts com `preconnect` e **fallback stack real**.

### 10.4 Layout e componentes

- **Sidebar** fixa com marca no topo, grupos de navegação, item ativo com acento
  + borda sutil, hover suave, e no rodapé o **chip da empresa logada** (nome real
  do contratante) + selo de fonte/atualização.
- **Cards de KPI** uniformes, com rótulo, valor (mono) e delta semântico
  (verde/vermelho/âmbar) quando fizer sentido.
- **Seções** como cartões com "eyebrow" (rótulo pequeno em acento) + título
  display + descrição curta. Consistência total entre telas.
- **Tabelas** com cabeçalho discreto em caixa alta, linhas com hover, números à
  direita em mono, zebra opcional muito sutil, e barras inline (CSS) para
  dispersão/rankings quando couber (leves e elegantes).

### 10.5 Tema de gráficos (ECharts) — obrigatório

Registrar **um tema ECharts custom** que consuma os tokens, para os gráficos não
parecerem "ECharts de tutorial":

- `backgroundColor` transparente; `textStyle` = Inter; rótulos de valor em mono.
- Eixos: linha em `--border`, `splitLine` bem discreto, sem molduras pesadas.
- Paleta de séries derivada do acento + neutros; **cor semântica** para
  acima/abaixo do mercado.
- Tooltip com fundo `--bg-elevated`, borda `--border`, cantos arredondados,
  padding confortável, valores formatados em pt-BR.
- Animações curtas e sóbrias; sem legendas poluídas; sem 3D, sem gradientes
  berrantes.
- Todo gráfico responsivo (`resize`), com **skeleton** enquanto carrega e
  **estado vazio** desenhado (não um espaço em branco).

### 10.6 Formatação (pt-BR) — sem exceção

- Moeda: `Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'})`
  → `R$ 7,86`.
- Números/percentuais com separador de milhar e vírgula decimal.
- Datas `dd/mm/aaaa` (e `dd/mm HH:mm` quando relevante).
- Nunca exibir número cru, `null`, `NaN`, JSON ou nome técnico de coluna na UI.

### 10.7 Estados, microinterações e detalhes que separam pro de amador

- **Loading:** skeletons (não spinners genéricos no meio da tela).
- **Vazio:** mensagem orientando o usuário ("sem dados para o período/CNPJ").
- **Erro:** mensagem amigável + ação de tentar de novo; nunca stack trace.
- Transições suaves em hover/foco; foco visível (acessibilidade).
- **Login premium porém minimalista:** a tela de login mostra **exclusivamente**
  campo de e-mail, campo de senha e botão **Entrar** (uma marca/logo discreta é
  aceitável, mas nada além disso). **Proibido** link de "esqueci a senha",
  cadastro ou login social. Acabamento à altura do tema, sem elementos extras.
- **404 estilizada** (coerente com o tema), favicon e `<title>` corretos, meta
  viewport, sem "flash" de tela não estilizada.
- Responsivo desktop-first, utilizável em tablet; a sidebar colapsa no mobile.
- Contraste AA no texto; alvos de clique confortáveis.
- **Zero emoji na UI**; ícones só via lucide.

### 10.8 Checklist "anti-amador" (o Claude Code deve autoavaliar antes de entregar)

- [ ] Nada com cara de template padrão (Bootstrap/admin genérico).
- [ ] Espaçamento e alinhamento consistentes em todas as telas.
- [ ] Todos os números formatados em pt-BR e em fonte mono.
- [ ] Gráficos usam o tema custom (não as cores default do ECharts).
- [ ] Skeletons + estados vazio/erro em toda tela que busca dados.
- [ ] Sem preto/branco puro; hierarquia de superfícies visível.
- [ ] Login, 404, favicon e título tratados.
- [ ] Nenhum dado técnico/cru vazando para a interface.

---

## 11. Deploy (GitHub Pages + domínio custom)

- **Domínio:** `marketprice.vemperformar.com.br` (subdomínio dedicado ao app).
  DNS: **CNAME** `marketprice` → `daniluamaro.github.io`. Arquivo `public/CNAME`
  com `marketprice.vemperformar.com.br`.
  - *Plano B:* servir em `vemperformar.com.br/dashboard` (então `base:
    '/dashboard/'` no Vite + `basename` no Router). Default é o subdomínio.
- **Vite:** `base: '/'` (subdomínio).
- **Roteamento SPA:** `BrowserRouter` + no build **copiar `dist/index.html` para
  `dist/404.html`** (evita 404 em deep-link). Fallback aceitável: `HashRouter`.
- **CI/CD:** GitHub Actions builda e publica no GitHub Pages a cada push na
  branch principal.
- **Supabase Auth → URL Configuration:** Site URL e Redirect URLs =
  `https://marketprice.vemperformar.com.br`.

---

## 12. Variáveis de ambiente / segredos

| Nome                        | Onde vive                          | Público? |
|-----------------------------|------------------------------------|----------|
| `VITE_SUPABASE_URL`         | build do frontend / GH Actions     | Sim      |
| `VITE_SUPABASE_ANON_KEY`    | build do frontend / GH Actions     | Sim      |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret da Edge Function** apenas | **NÃO**  |

Local: `.env.local` no `.gitignore`. **Nenhum segredo versionado.**

---

## 13. Regras de execução (governança por fases — peça aprovação ao fim de cada)

- **Fase 0 — Descoberta:** via MCP, **conectar e visualizar a tabela de fatos já
  existente** (não criar nada), confirmar nome, tipos e volume. Apresentar resumo
  + plano antes de codar.
- **Fase 1 — Banco (em cima do que já existe):** **não criar nem alterar a tabela
  de fatos (§4.1)** — apenas ler. Criar migrations de `profiles`,
  `current_cnpj()`, `rpc_confirmar_troca_senha()`, RLS, views e RPC. Tudo
  versionado; nada manual.
- **Fase 2 — Auth & Admin (sem e-mail):** login minimalista (só e-mail/senha/
  Entrar), gate `ativo`, **troca de senha forçada no 1º acesso** (`senha_provisoria`
  + `rpc_confirmar_troca_senha`), sessão/perfil, Edge Function `admin-users`
  (criar / resetar senha / ativar-desativar), tela de Administração.
- **Fase 3 — Design System:** tokens (Tailwind config + CSS vars), tema ECharts,
  componentes base (KPI, seção, tabela, estados) e **login + shell (sidebar +
  topbar)**. Só avance quando o shell já estiver no padrão da §10.
- **Fase 4 — Relatórios:** as 8 telas + filtros globais + export.
- **Fase 5 — Deploy:** Actions, CNAME, config do Supabase Auth.

Regras gerais: TypeScript strict (sem `any` solto); tratamento de
loading/erro/vazio em toda chamada; explicar o "porquê" nas mensagens de
progresso; não introduzir dependências/serviços fora da §2 sem aprovação;
**validar RLS com dois CNPJs distintos** antes de considerar pronto.

---

## 14. Definition of Done

- [ ] A tabela de fatos existente **não foi recriada nem alterada**; o app só lê.
- [ ] Usuário loga e vê **apenas** dados do seu CNPJ (testado com 2 tenants).
- [ ] Tela de login mostra **só** e-mail, senha e Entrar (sem recuperação/cadastro).
- [ ] Usuário `ativo = false` é bloqueado com tela explicativa e sem vazar dados.
- [ ] As 8 telas funcionam via views/RPC e **atualizam** quando a base cresce.
- [ ] Comparações por `cod_barras`, preço `preco_liquido`, vigência por `data_nf`,
      nome de exibição = mais frequente por EAN.
- [ ] Admin cria/edita/ativa/desativa acessos e **reseta senha** (via Edge
      Function), **sem depender de e-mail**; usuário é criado com senha provisória.
- [ ] 1º acesso **força a troca de senha**; após trocar, `senha_provisoria` vira
      false e o dashboard é liberado.
- [ ] Nenhum segredo sensível no frontend/repo; RLS ativa e testada (inclusive
      através de views/RPC).
- [ ] Publicado em `https://marketprice.vemperformar.com.br`; deep-links não dão 404.
- [ ] **Barra de qualidade visual (§10) cumprida** — checklist anti-amador
      todo marcado. Se parecer protótipo, não está pronto.

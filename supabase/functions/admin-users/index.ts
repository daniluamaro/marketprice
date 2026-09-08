/**
 * Edge Function `admin-users` — CLAUDE.md §7 e §8.
 *
 * Unico lugar do sistema onde a SUPABASE_SERVICE_ROLE_KEY e usada. Ela nunca
 * chega ao frontend, ao build ou ao repositorio: o runtime das Edge Functions
 * do Supabase injeta essa variavel automaticamente.
 *
 * REGRA DE OURO desta funcao: nada acontece antes de provar que quem chamou e
 * um admin ATIVO. A prova e feita em dois passos, e os dois importam:
 *   1. validar o JWT do chamador (quem voce diz que e?);
 *   2. reler o perfil desse usuario no banco com a service_role (voce
 *      realmente e admin, agora?).
 * Confiar em um claim de papel embutido no JWT seria um erro — o token dura
 * uma hora e continuaria valendo depois de um rebaixamento.
 *
 * Nao ha e-mail em lugar nenhum: senhas provisorias sao devolvidas UMA vez na
 * resposta, para o admin repassar ao cliente por fora (WhatsApp/telefone).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const URL_SUPABASE = Deno.env.get('SUPABASE_URL') ?? ''
const CHAVE_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const CHAVE_SERVICO = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

type Acao =
  | 'estado_seguranca'
  | 'definir_senha_admin'
  | 'desbloquear'
  | 'listar'
  | 'criar'
  | 'atualizar'
  | 'resetar_senha'
  | 'alternar_ativo'
  | 'excluir'

/** Acoes que NAO exigem a senha de administracao. Tudo o mais exige. */
const ACOES_SEM_SENHA: ReadonlySet<string> = new Set([
  'estado_seguranca',
  'definir_senha_admin', // valida a senha ATUAL por dentro, quando ja existe
])

interface Corpo {
  action: Acao
  id?: string
  email?: string
  cnpj_contratante?: string
  nome_contratante?: string | null
  role?: 'user' | 'admin'
  plano?: string | null
  ativo?: boolean
  /** Senha de administracao (§ segunda barreira). Nunca e persistida. */
  senha_admin?: string
  nova_senha_admin?: string
}

const MIN_SENHA_ADMIN = 10

function json(dados: unknown, status = 200): Response {
  return new Response(JSON.stringify(dados), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function erro(mensagem: string, status: number): Response {
  return json({ error: mensagem }, status)
}

/**
 * Senha provisoria legivel ao telefone: sem caracteres ambiguos (0/O, 1/l/I),
 * porque ela vai ser ditada por WhatsApp ou voz. 10 chars do alfabeto abaixo
 * dao ~51 bits de entropia, e ela e obrigatoriamente trocada no 1o acesso.
 */
function gerarSenhaProvisoria(): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = new Uint8Array(10)
  crypto.getRandomValues(bytes)
  let senha = ''
  for (const b of bytes) senha += alfabeto[b % alfabeto.length]
  // Garante um simbolo, para atender politicas de senha mais rigidas.
  return `${senha}@`
}

function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

/** SHA-256 em hexadecimal. A senha em si nunca e gravada em lugar nenhum. */
async function sha256(texto: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Comparacao em tempo constante.
 *
 * `a === b` em string sai no primeiro caractere diferente, e essa diferenca de
 * tempo — medida em muitas tentativas — revela o prefixo correto. Como aqui os
 * dois lados sao hashes de tamanho fixo, o XOR acumulado percorre tudo sempre.
 */
function iguaisEmTempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diferenca = 0
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diferenca === 0
}

/** Atraso fixo apos senha errada, para encarecer tentativa e erro. */
function esperar(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return erro('Método não permitido.', 405)

  if (URL_SUPABASE === '' || CHAVE_ANON === '' || CHAVE_SERVICO === '') {
    return erro('Função mal configurada no servidor.', 500)
  }

  // ---- 1. quem esta chamando? -------------------------------------------
  const autorizacao = req.headers.get('Authorization') ?? ''
  if (!autorizacao.startsWith('Bearer ')) return erro('Não autenticado.', 401)

  const clienteChamador = createClient(URL_SUPABASE, CHAVE_ANON, {
    global: { headers: { Authorization: autorizacao } },
    auth: { persistSession: false },
  })

  const { data: dadosUsuario, error: erroUsuario } =
    await clienteChamador.auth.getUser()
  if (erroUsuario || !dadosUsuario.user) return erro('Não autenticado.', 401)

  const admin = createClient(URL_SUPABASE, CHAVE_SERVICO, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // ---- 2. essa pessoa e admin ativo AGORA? -------------------------------
  const { data: perfilChamador, error: erroPerfil } = await admin
    .from('profiles')
    .select('role, ativo, cnpj_contratante')
    .eq('id', dadosUsuario.user.id)
    .maybeSingle()

  if (erroPerfil) return erro('Falha ao verificar permissões.', 500)
  if (!perfilChamador || perfilChamador.role !== 'admin' || !perfilChamador.ativo) {
    return erro('Acesso restrito a administradores.', 403)
  }

  let corpo: Corpo
  try {
    corpo = (await req.json()) as Corpo
  } catch {
    return erro('Requisição inválida.', 400)
  }

  const { action } = corpo

  // ---- 3. a SEGUNDA barreira: senha de administracao ---------------------
  // Ser admin autenticado nao basta. Esta verificacao roda AQUI, no servidor, e
  // nao na tela: o JavaScript do navegador e publico e qualquer pessoa remove
  // uma checagem feita la. Sem passar por este bloco, nenhuma acao privilegiada
  // acontece — nem chamando a funcao direto, fora da interface.
  const { data: seguranca, error: erroSeguranca } = await admin
    .from('admin_seguranca')
    .select('senha_hash')
    .eq('id', 1)
    .maybeSingle()

  if (erroSeguranca) return erro('Falha ao verificar a senha de administração.', 500)
  const hashGravado: string | null = seguranca?.senha_hash ?? null

  async function senhaConfere(): Promise<boolean> {
    if (hashGravado === null) return false
    const enviada = corpo.senha_admin ?? ''
    if (enviada === '') return false
    return iguaisEmTempoConstante(await sha256(enviada), hashGravado)
  }

  if (!ACOES_SEM_SENHA.has(action)) {
    // 428 (Precondition Required) e nao 403: o cliente precisa saber que o
    // caso e "ainda nao configurada", nao "voce errou a senha".
    if (hashGravado === null) {
      return erro('Senha de administração ainda não foi configurada.', 428)
    }
    if (!(await senhaConfere())) {
      await esperar(400)
      return erro('Senha de administração inválida.', 403)
    }
  }

  try {
    switch (action) {
      // ---------------------------------------------------------------
      // Diz a tela se ja existe senha configurada, para ela decidir entre
      // pedir a senha ou oferecer a definicao inicial. Nao revela nada:
      // so chega aqui quem ja provou ser admin ativo.
      case 'estado_seguranca':
        return json({ configurada: hashGravado !== null })

      // ---------------------------------------------------------------
      case 'desbloquear':
        // A senha ja foi conferida no bloco acima; chegar aqui e a prova.
        return json({ ok: true })

      // ---------------------------------------------------------------
      case 'definir_senha_admin': {
        const nova = corpo.nova_senha_admin ?? ''

        // Rotacao exige a senha atual. Na PRIMEIRA definicao nao ha o que
        // exigir — e por isso ela deve ser feita imediatamente apos o deploy.
        if (hashGravado !== null && !(await senhaConfere())) {
          await esperar(400)
          return erro('Senha de administração atual inválida.', 403)
        }

        if (nova.length < MIN_SENHA_ADMIN) {
          return erro(`A senha deve ter ao menos ${MIN_SENHA_ADMIN} caracteres.`, 400)
        }
        if (corpo.senha_admin !== undefined && nova === corpo.senha_admin) {
          return erro('A nova senha deve ser diferente da atual.', 400)
        }

        const { error } = await admin.from('admin_seguranca').upsert({
          id: 1,
          senha_hash: await sha256(nova),
          atualizado_em: new Date().toISOString(),
          atualizado_por: dadosUsuario.user.id,
        })
        if (error) return erro('Falha ao gravar a senha de administração.', 500)
        return json({ ok: true, primeira_definicao: hashGravado === null })
      }

      // ---------------------------------------------------------------
      case 'listar': {
        const { data, error } = await admin
          .from('profiles')
          .select(
            'id, email, cnpj_contratante, nome_contratante, role, ativo, plano, senha_provisoria, created_at',
          )
          .order('created_at', { ascending: true })

        if (error) return erro('Falha ao listar acessos.', 500)
        return json({ usuarios: data ?? [] })
      }

      // ---------------------------------------------------------------
      case 'criar': {
        const email = (corpo.email ?? '').trim().toLowerCase()
        const cnpj = apenasDigitos(corpo.cnpj_contratante ?? '')

        if (email === '') return erro('Informe o e-mail.', 400)
        if (cnpj.length !== 14) return erro('CNPJ deve ter 14 dígitos.', 400)

        const senhaProvisoria = gerarSenhaProvisoria()

        const { data: criado, error: erroCriar } = await admin.auth.admin.createUser({
          email,
          password: senhaProvisoria,
          email_confirm: true, // nao ha servidor de e-mail: ja nasce confirmado
        })

        if (erroCriar || !criado.user) {
          const jaExiste = (erroCriar?.message ?? '')
            .toLowerCase()
            .includes('already been registered')
          return erro(
            jaExiste ? 'Já existe um acesso com este e-mail.' : 'Falha ao criar o acesso.',
            jaExiste ? 409 : 500,
          )
        }

        const { error: erroInserir } = await admin.from('profiles').upsert({
          id: criado.user.id,
          email,
          cnpj_contratante: cnpj,
          nome_contratante: corpo.nome_contratante ?? null,
          role: corpo.role === 'admin' ? 'admin' : 'user',
          plano: corpo.plano ?? 'padrao',
          ativo: true,
          senha_provisoria: true,
        })

        if (erroInserir) {
          // Sem o perfil o usuario existiria no Auth e nao conseguiria entrar
          // em lugar nenhum — um fantasma. Desfaz.
          await admin.auth.admin.deleteUser(criado.user.id)
          return erro('Falha ao criar o perfil do acesso.', 500)
        }

        return json({ id: criado.user.id, email, senha_provisoria: senhaProvisoria })
      }

      // ---------------------------------------------------------------
      case 'atualizar': {
        const id = corpo.id ?? ''
        if (id === '') return erro('Informe o acesso a atualizar.', 400)

        const campos: Record<string, unknown> = {}
        if (corpo.cnpj_contratante !== undefined) {
          const cnpj = apenasDigitos(corpo.cnpj_contratante)
          if (cnpj.length !== 14) return erro('CNPJ deve ter 14 dígitos.', 400)
          campos.cnpj_contratante = cnpj
        }
        if (corpo.nome_contratante !== undefined)
          campos.nome_contratante = corpo.nome_contratante
        if (corpo.role !== undefined) campos.role = corpo.role
        if (corpo.plano !== undefined) campos.plano = corpo.plano

        if (Object.keys(campos).length === 0) return erro('Nada para atualizar.', 400)

        // Nao deixa o admin se rebaixar e trancar a Administracao para todos.
        if (campos.role === 'user' && id === dadosUsuario.user.id) {
          return erro('Você não pode remover o seu próprio papel de administrador.', 400)
        }

        const { error } = await admin.from('profiles').update(campos).eq('id', id)
        if (error) return erro('Falha ao atualizar o acesso.', 500)
        return json({ ok: true })
      }

      // ---------------------------------------------------------------
      case 'resetar_senha': {
        const id = corpo.id ?? ''
        if (id === '') return erro('Informe o acesso.', 400)

        const senhaProvisoria = gerarSenhaProvisoria()

        const { error: erroSenha } = await admin.auth.admin.updateUserById(id, {
          password: senhaProvisoria,
        })
        if (erroSenha) return erro('Falha ao redefinir a senha.', 500)

        const { error: erroFlag } = await admin
          .from('profiles')
          .update({ senha_provisoria: true })
          .eq('id', id)
        if (erroFlag) return erro('Senha redefinida, mas houve falha ao marcar o perfil.', 500)

        return json({ senha_provisoria: senhaProvisoria })
      }

      // ---------------------------------------------------------------
      case 'alternar_ativo': {
        const id = corpo.id ?? ''
        const ativo = corpo.ativo
        if (id === '' || typeof ativo !== 'boolean') return erro('Requisição inválida.', 400)

        // Um admin que se desativa perde o proprio acesso e nao consegue voltar.
        if (!ativo && id === dadosUsuario.user.id) {
          return erro('Você não pode desativar o seu próprio acesso.', 400)
        }

        const { error } = await admin.from('profiles').update({ ativo }).eq('id', id)
        if (error) return erro('Falha ao alterar o estado do acesso.', 500)
        return json({ ok: true })
      }

      // ---------------------------------------------------------------
      case 'excluir': {
        const id = corpo.id ?? ''
        if (id === '') return erro('Informe o acesso.', 400)
        if (id === dadosUsuario.user.id) {
          return erro('Você não pode excluir o seu próprio acesso.', 400)
        }

        // profiles.id tem on delete cascade para auth.users.
        const { error } = await admin.auth.admin.deleteUser(id)
        if (error) return erro('Falha ao excluir o acesso.', 500)
        return json({ ok: true })
      }

      // ---------------------------------------------------------------
      default:
        return erro('Ação desconhecida.', 400)
    }
  } catch {
    return erro('Erro inesperado ao processar a solicitação.', 500)
  }
})

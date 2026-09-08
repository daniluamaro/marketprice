/**
 * Formatacao pt-BR — CLAUDE.md §10.6.
 *
 * Regra sem excecao: nenhum numero, data ou percentual chega a tela sem passar
 * por aqui. Valores ausentes viram um travessao, nunca "null", "NaN" ou "0".
 */

const VAZIO = '—'

const moeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const inteiro = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

const decimal = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const dataCurta = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
})

const dataHora = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
})

type Numerico = number | string | null | undefined

/** Aceita o numeric do Postgres, que chega como string no JSON. */
function paraNumero(valor: Numerico): number | null {
  if (valor === null || valor === undefined || valor === '') return null
  const n = typeof valor === 'number' ? valor : Number(valor)
  return Number.isFinite(n) ? n : null
}

/**
 * Converte o `numeric` do Postgres (que chega como string) para number.
 * Devolve null quando nao ha valor — os graficos precisam distinguir "zero" de
 * "nao medido", e `Number(null)` daria 0 nos dois casos.
 */
export function num(valor: Numerico): number | null {
  return paraNumero(valor)
}

export function fmtMoeda(valor: Numerico): string {
  const n = paraNumero(valor)
  return n === null ? VAZIO : moeda.format(n)
}

export function fmtInteiro(valor: Numerico): string {
  const n = paraNumero(valor)
  return n === null ? VAZIO : inteiro.format(n)
}

export function fmtDecimal(valor: Numerico): string {
  const n = paraNumero(valor)
  return n === null ? VAZIO : decimal.format(n)
}

/** Percentual ja em escala de 0-100 (como as RPCs devolvem). */
export function fmtPercent(valor: Numerico, casas = 1): string {
  const n = paraNumero(valor)
  if (n === null) return VAZIO
  return `${n.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })}%`
}

/** Percentual com sinal explicito, para deltas. */
export function fmtDelta(valor: Numerico, casas = 1): string {
  const n = paraNumero(valor)
  if (n === null) return VAZIO
  const sinal = n > 0 ? '+' : ''
  return `${sinal}${fmtPercent(n, casas)}`
}

/** "2026-09-03" — uma data pura, sem hora e sem fuso. */
const SO_DATA = /^\d{4}-\d{2}-\d{2}$/

export function fmtData(valor: string | Date | null | undefined): string {
  if (!valor) return VAZIO

  // Uma data pura do Postgres (tipo `date`) NAO tem fuso. Passar por
  // `new Date("2026-09-03")` a interpreta como meia-noite UTC e, convertida
  // para America/Sao_Paulo (UTC-3), volta um dia: virava 02/09/2026.
  // Por isso ela e formatada a partir dos proprios digitos.
  if (typeof valor === 'string' && SO_DATA.test(valor)) {
    const [ano, mes, dia] = valor.split('-')
    return `${dia}/${mes}/${ano}`
  }

  const d = valor instanceof Date ? valor : new Date(valor)
  return Number.isNaN(d.getTime()) ? VAZIO : dataCurta.format(d)
}

export function fmtDataHora(valor: string | Date | null | undefined): string {
  if (!valor) return VAZIO
  const d = valor instanceof Date ? valor : new Date(valor)
  return Number.isNaN(d.getTime()) ? VAZIO : dataHora.format(d)
}

/**
 * Rotulo comercial do plano. O banco guarda o valor tecnico ("padrao"); a
 * interface nunca deve mostrar isso cru (§10.6).
 */
export function fmtPlano(plano: string | null | undefined): string {
  if (!plano || plano.trim() === '') return VAZIO
  const conhecidos: Record<string, string> = {
    padrao: 'Padrão',
    premium: 'Premium',
    trial: 'Avaliação',
  }
  const chave = plano.trim().toLowerCase()
  return conhecidos[chave] ?? chave.charAt(0).toUpperCase() + chave.slice(1)
}

/** 30580282000104 -> 30.580.282/0001-04 */
export function fmtCnpj(cnpj: string | null | undefined): string {
  if (!cnpj) return VAZIO
  const d = cnpj.replace(/\D/g, '').padStart(14, '0')
  if (d.length !== 14) return cnpj
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

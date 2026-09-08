/**
 * Export CSV — CLAUDE.md §9, tela Dados Detalhados.
 *
 * Decisoes que parecem detalhe e nao sao:
 *
 * - Separador `;`. O Excel em portugues do Brasil usa a virgula como separador
 *   DECIMAL, entao um CSV separado por virgula abre com tudo numa coluna so.
 * - Numeros com virgula decimal, pelo mesmo motivo: com ponto, o Excel pt-BR le
 *   "7.86" como texto (ou como 786) e nao soma nada.
 * - BOM UTF-8 no inicio. Sem ele o Excel abre "ATACADÃO" como "ATACADÃO".
 *
 * O resultado e um arquivo que abre certo com dois cliques — que e o unico
 * criterio que importa para quem vai usar.
 */

export interface ColunaCsv<L> {
  cabecalho: string
  valor: (linha: L) => string | number | null | undefined
}

function escapar(bruto: string): string {
  // Aspas duplas viram duas; qualquer separador, quebra de linha ou aspas
  // obrigam a envolver o campo.
  const texto = bruto.replace(/"/g, '""')
  return /[";\n\r]/.test(texto) ? `"${texto}"` : texto
}

function comoTexto(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') {
    return Number.isFinite(v) ? String(v).replace('.', ',') : ''
  }
  return v
}

export function gerarCsv<L>(colunas: ColunaCsv<L>[], linhas: L[]): string {
  const cabecalho = colunas.map((c) => escapar(c.cabecalho)).join(';')
  const corpo = linhas.map((l) =>
    colunas.map((c) => escapar(comoTexto(c.valor(l)))).join(';'),
  )
  return [cabecalho, ...corpo].join('\r\n')
}

/** Dispara o download no navegador e libera a URL temporaria em seguida. */
export function baixarCsv(nomeArquivo: string, conteudo: string): void {
  const blob = new Blob([`﻿${conteudo}`], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  // Revogar na hora corta o download em alguns navegadores; um tick basta.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** "precos-2026-09-07.csv" — data local, para o arquivo nao virar um enigma. */
export function nomeArquivoCsv(prefixo: string): string {
  const agora = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${prefixo}-${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}.csv`
}

import { Link } from 'react-router-dom'
import { Marca } from '@/components/Marca'

export default function NaoEncontrada() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-105 text-center">
        <div className="mb-9 flex justify-center">
          <Marca />
        </div>

        <p className="num text-[56px] font-bold leading-none text-gold">404</p>

        <h1 className="mt-4 font-display text-[17px] font-extrabold text-ink">
          Página não encontrada
        </h1>

        <p className="mx-auto mt-2.5 max-w-80 text-[12.5px] leading-relaxed text-ink-2">
          O endereço acessado não existe ou foi movido.
        </p>

        <Link
          to="/"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-card border border-line bg-elevated px-4 text-[13.5px] font-medium text-ink transition-colors hover:border-gold/40 hover:bg-hover"
        >
          Voltar ao início
        </Link>
      </div>
    </main>
  )
}

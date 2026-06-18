import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { USING_REAL_API } from '../api'

function navClass({ isActive }: { isActive: boolean }) {
  return `relative py-1 text-[0.8rem] font-semibold uppercase tracking-[0.12em] transition-colors ${
    isActive
      ? 'text-ink after:absolute after:-bottom-[3px] after:left-0 after:h-[2px] after:w-full after:bg-brand'
      : 'text-muted hover:text-ink'
  }`
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Deep-teal utility bar — FER heritage, modernized */}
      <div className="bg-brand-deep text-brand-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-1.5 text-[0.7rem] uppercase tracking-[0.14em]">
          <span className="text-brand-200">Sveučilište u Zagrebu — FER</span>
          <a
            href="https://www.fer.unizg.hr"
            target="_blank"
            rel="noreferrer"
            className="text-brand-100 transition-colors hover:text-white"
          >
            fer.unizg.hr
          </a>
        </div>
      </div>

      {/* Header — typographic wordmark, no boxed logo */}
      <header className="border-b border-hairline bg-paper">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-5 py-5 sm:flex-row sm:items-end sm:justify-between">
          <Link to="/" className="group leading-none">
            <span className="font-serif text-[1.7rem] font-semibold tracking-tightish text-ink">
              <span className="text-brand">FER</span>mentor
            </span>
            <span className="mt-1 block text-[0.72rem] uppercase tracking-[0.16em] text-muted">
              Fakultet elektrotehnike i računarstva
            </span>
          </Link>
          <nav className="flex items-center gap-6 sm:pb-1">
            <NavLink to="/" className={navClass} end>
              Pretraga
            </NavLink>
            <NavLink to="/izborni" className={navClass}>
              Izborni predmeti
            </NavLink>
            <NavLink to="/mentori" className={navClass}>
              Mentori
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:py-14">{children}</main>

      <footer className="border-t border-hairline bg-paper">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-3 px-5 py-6 text-xs text-muted sm:flex-row sm:items-center">
          <span className="font-serif text-sm text-ink">
            <span className="text-brand">FER</span>mentor
            <span className="ml-2 font-sans text-xs text-muted">
              preporuka mentora za završni i diplomski rad
            </span>
          </span>
          <span>
            {USING_REAL_API ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                Povezano s repozitorijem FER-a
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-ochre" />
                Demo podatci (mock)
              </span>
            )}
          </span>
        </div>
      </footer>
    </div>
  )
}

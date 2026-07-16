import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { USING_REAL_API } from '../api'
import { useSaved } from '../hooks/useSaved'
import { useTheme } from '../hooks/useTheme'

function navClass({ isActive }: { isActive: boolean }) {
  return `relative whitespace-nowrap py-1 text-[0.8rem] font-semibold uppercase tracking-[0.12em] transition-colors ${
    isActive
      ? 'text-ink after:absolute after:-bottom-[3px] after:left-0 after:h-[2px] after:w-full after:bg-brand'
      : 'text-muted hover:text-ink'
  }`
}

function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Uključi svijetlu temu' : 'Uključi tamnu temu'}
      aria-pressed={isDark}
      title={isDark ? 'Svijetla tema' : 'Tamna tema'}
      className="-my-1 rounded p-1.5 text-muted transition-colors hover:text-ink focus:outline-none focus:ring-2 focus:ring-brand-200"
    >
      {isDark ? (
        // Sun — switch back to light
        <svg className="h-[18px] w-[18px]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M10 3.5a1 1 0 0 1 1 1V5a1 1 0 1 1-2 0v-.5a1 1 0 0 1 1-1Zm0 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Zm0 1.5a1 1 0 0 1 1 1v.5a1 1 0 1 1-2 0V15a1 1 0 0 1 1-1Zm6-4a1 1 0 0 1-1 1h-.5a1 1 0 1 1 0-2h.5a1 1 0 0 1 1 1Zm-11 0a1 1 0 0 1-1 1H3.5a1 1 0 1 1 0-2H4a1 1 0 0 1 1 1Zm9.19-4.19a1 1 0 0 1 0 1.41l-.36.36a1 1 0 1 1-1.41-1.41l.35-.36a1 1 0 0 1 1.42 0Zm-7.07 7.07a1 1 0 0 1 0 1.41l-.36.36a1 1 0 0 1-1.41-1.42l.35-.35a1 1 0 0 1 1.42 0Zm7.07 1.41a1 1 0 0 1-1.42 0l-.35-.35a1 1 0 0 1 1.41-1.42l.36.36a1 1 0 0 1 0 1.41ZM7.05 6.46a1 1 0 0 1-1.42 0l-.35-.36A1 1 0 0 1 6.7 4.69l.35.36a1 1 0 0 1 0 1.41Z" />
        </svg>
      ) : (
        // Moon — switch to dark
        <svg className="h-[18px] w-[18px]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M9.5 2.75a.75.75 0 0 0-.86-.74 7.25 7.25 0 1 0 8.35 8.35.75.75 0 0 0-.98-.83 5.75 5.75 0 0 1-7.27-7.27.75.75 0 0 0 .76-.66Z" />
        </svg>
      )}
    </button>
  )
}

function SavedNavLink() {
  const { total } = useSaved()
  return (
    <NavLink to="/spremljeni" className={navClass}>
      Spremljeni
      {total > 0 && (
        <span className="tnum ml-1 text-[0.65rem] text-brand">{total}</span>
      )}
    </NavLink>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Deep-teal utility bar — FER heritage, modernized */}
      <div className="bg-brand-deep text-brand-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-1.5 text-[0.7rem] uppercase tracking-[0.14em]">
          <span className="whitespace-nowrap text-brand-200">
            <span className="hidden sm:inline">Sveučilište u Zagrebu — FER</span>
            <span className="sm:hidden">UNIZG — FER</span>
          </span>
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
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:gap-6 sm:pb-1">
            <NavLink to="/" className={navClass} end>
              Pretraga
            </NavLink>
            <NavLink to="/izborni" className={navClass}>
              Izborni predmeti
            </NavLink>
            <NavLink to="/mentori" className={navClass}>
              Mentori
            </NavLink>
            <SavedNavLink />
            <span className="h-4 w-px bg-line" aria-hidden="true" />
            <ThemeToggle />
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

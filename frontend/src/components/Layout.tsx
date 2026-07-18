import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { USING_REAL_API, useMeta } from '../api'
import { useSaved } from '../hooks/useSaved'
import { useTheme } from '../hooks/useTheme'
import { formatDate } from '../lib/format'

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

/** "Podaci ažurirani: …" from the newest successful ingest run; renders nothing until known. */
function DataFreshness() {
  const { data } = useMeta()
  const timestamps = (data?.sources ?? [])
    .map((s) => s.finished_at)
    .filter((t): t is string => t != null)
  if (timestamps.length === 0) return null
  const newest = timestamps.reduce((a, b) => (Date.parse(a) >= Date.parse(b) ? a : b))
  return <span>Podaci ažurirani: {formatDate(newest)}</span>
}

function mobileNavClass({ isActive }: { isActive: boolean }) {
  return `flex flex-col items-center gap-1 py-2 text-[0.6rem] font-semibold uppercase tracking-[0.08em] transition-colors ${
    isActive ? 'text-brand' : 'text-muted'
  }`
}

function MobileNav() {
  const { total } = useSaved()
  return (
    <nav
      aria-label="Glavna navigacija"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-paper pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <div className="grid grid-cols-4">
        <NavLink to="/" className={mobileNavClass} end>
          {/* Magnifier */}
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.45 4.39l3.08 3.08a.75.75 0 1 1-1.06 1.06l-3.08-3.08A7 7 0 0 1 2 9Z"
              clipRule="evenodd"
            />
          </svg>
          Pretraga
        </NavLink>
        <NavLink to="/izborni" className={mobileNavClass}>
          {/* Open book */}
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M10 4.06C8.72 3.11 6.95 2.5 4.75 2.5c-.98 0-1.92.12-2.78.35a.75.75 0 0 0-.57.73v10.5c0 .5.49.85.97.72a8.9 8.9 0 0 1 2.38-.3c2.09 0 3.68.66 4.5 1.4V4.06Z" />
            <path d="M11 15.9c.82-.74 2.41-1.4 4.5-1.4.85 0 1.65.11 2.38.3.48.13.97-.22.97-.72V3.58a.75.75 0 0 0-.57-.73 11.1 11.1 0 0 0-2.78-.35c-2.2 0-3.97.61-5.25 1.56V15.9Z" />
          </svg>
          Izborni
        </NavLink>
        <NavLink to="/mentori" className={mobileNavClass}>
          {/* Two people */}
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M7 8.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM1.75 16.5c-.41 0-.76-.34-.69-.75.4-2.55 2.94-4.5 5.94-4.5s5.53 1.95 5.94 4.5c.07.41-.28.75-.69.75H1.75Z" />
            <path d="M13.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM14.35 16.5h3.96c.39 0 .72-.32.66-.7-.3-1.98-2.05-3.55-4.34-3.77.9 1 1.53 2.24 1.75 3.62.05.29.03.58-.03.85Z" />
          </svg>
          Mentori
        </NavLink>
        <NavLink to="/spremljeni" className={mobileNavClass}>
          <span className="relative">
            {/* Bookmark */}
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M10 2c-1.72 0-3.4.14-5.06.4A1.5 1.5 0 0 0 3.75 3.9v13.36c0 .59.63.96 1.15.68L10 15.21l5.1 2.72c.52.28 1.15-.1 1.15-.68V3.89A1.5 1.5 0 0 0 15.06 2.4 31.7 31.7 0 0 0 10 2Z"
                clipRule="evenodd"
              />
            </svg>
            {total > 0 && (
              <span className="tnum absolute -right-2.5 -top-1 text-[0.6rem] text-brand">
                {total}
              </span>
            )}
          </span>
          Spremljeni
        </NavLink>
      </div>
    </nav>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] sm:pb-0">
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
        <div className="mx-auto flex max-w-5xl items-end justify-between gap-4 px-5 py-5">
          <Link to="/" className="group leading-none">
            <span className="font-serif text-[1.7rem] font-semibold tracking-tightish text-ink">
              <span className="text-brand">FER</span>mentor
            </span>
            <span className="mt-1 block text-[0.72rem] uppercase tracking-[0.16em] text-muted">
              Fakultet elektrotehnike i računarstva
            </span>
          </Link>
          <div className="self-start sm:hidden">
            <ThemeToggle />
          </div>
          <nav className="hidden items-center gap-6 sm:flex sm:pb-1">
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
          <span className="flex flex-col items-start gap-1 sm:items-end">
            {USING_REAL_API ? (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                  Povezano s repozitorijem FER-a
                </span>
                <DataFreshness />
              </>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-ochre" />
                Demo podatci (mock)
              </span>
            )}
          </span>
        </div>
      </footer>

      <MobileNav />
    </div>
  )
}

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'

export interface SelectOption {
  value: string
  label: string
  /** optional right-aligned secondary text, e.g. a count */
  hint?: string
  disabled?: boolean
}

export interface SelectGroup {
  label: string
  options: SelectOption[]
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  /** flat list of options (use this OR `groups`) */
  options?: SelectOption[]
  /** grouped options, rendered with sticky group headers */
  groups?: SelectGroup[]
  /** shown on the trigger when the current value matches no option */
  placeholder?: string
  id?: string
  disabled?: boolean
  /** wrapper classes — control width here (e.g. "w-full" or "w-56") */
  className?: string
  ariaLabel?: string
}

type Row =
  | { kind: 'group'; key: string; label: string }
  | { kind: 'option'; key: string; option: SelectOption; activeIndex: number }

/**
 * Modern, accessible custom <select> replacement (ARIA listbox pattern).
 * Supports flat or grouped options, keyboard navigation, type-ahead and
 * click-outside dismissal. Styled to the FERmentor design system.
 */
export function Select({
  value,
  onChange,
  options,
  groups,
  placeholder = 'Odaberi…',
  id,
  disabled = false,
  className = '',
  ariaLabel,
}: SelectProps) {
  const reactId = useId()
  const baseId = id ?? `select-${reactId}`
  const listId = `${baseId}-listbox`

  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)

  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const typeahead = useRef<{ buffer: string; timer: number | undefined }>({
    buffer: '',
    timer: undefined,
  })

  // Flatten to (a) selectable options in order and (b) render rows.
  const { flatOptions, rows } = useMemo(() => {
    const flat: SelectOption[] = []
    const rendered: Row[] = []
    const groupList: SelectGroup[] = groups ?? [{ label: '', options: options ?? [] }]
    for (const g of groupList) {
      if (g.label) rendered.push({ kind: 'group', key: `g-${g.label}`, label: g.label })
      for (const opt of g.options) {
        rendered.push({
          kind: 'option',
          key: `o-${opt.value}`,
          option: opt,
          activeIndex: flat.length,
        })
        flat.push(opt)
      }
    }
    return { flatOptions: flat, rows: rendered }
  }, [options, groups])

  const selected = flatOptions.find((o) => o.value === value)
  const selectedIndex = flatOptions.findIndex((o) => o.value === value)

  function optionDomId(i: number) {
    return `${baseId}-opt-${i}`
  }

  function openMenu(toIndex?: number) {
    if (disabled) return
    const start =
      toIndex ?? (selectedIndex >= 0 ? selectedIndex : firstEnabledFrom(0, 1))
    setActiveIndex(start)
    setOpen(true)
  }

  function closeMenu(focusButton = true) {
    setOpen(false)
    setActiveIndex(-1)
    if (focusButton) buttonRef.current?.focus()
  }

  function commit(i: number) {
    const opt = flatOptions[i]
    if (!opt || opt.disabled) return
    onChange(opt.value)
    closeMenu()
  }

  function firstEnabledFrom(start: number, dir: 1 | -1): number {
    const n = flatOptions.length
    for (let step = 0; step < n; step++) {
      const i = (start + dir * step + n) % n
      if (!flatOptions[i]?.disabled) return i
    }
    return -1
  }

  function move(dir: 1 | -1) {
    if (flatOptions.length === 0) return
    const from = activeIndex < 0 ? (dir === 1 ? -1 : 0) : activeIndex
    setActiveIndex(firstEnabledFrom(from + dir, dir))
  }

  function onTypeahead(char: string) {
    const ta = typeahead.current
    window.clearTimeout(ta.timer)
    ta.buffer += char.toLowerCase()
    ta.timer = window.setTimeout(() => (ta.buffer = ''), 600)
    const match = flatOptions.findIndex(
      (o) => !o.disabled && o.label.toLowerCase().startsWith(ta.buffer),
    )
    if (match >= 0) setActiveIndex(match)
  }

  // Close on outside pointer.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) closeMenu(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Move DOM focus into the list and keep the active option in view.
  useLayoutEffect(() => {
    if (!open) return
    listRef.current?.focus()
  }, [open])

  useLayoutEffect(() => {
    if (!open || activeIndex < 0) return
    const el = document.getElementById(optionDomId(activeIndex))
    el?.scrollIntoView({ block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeIndex])

  function onListKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        move(1)
        break
      case 'ArrowUp':
        e.preventDefault()
        move(-1)
        break
      case 'Home':
        e.preventDefault()
        setActiveIndex(firstEnabledFrom(0, 1))
        break
      case 'End':
        e.preventDefault()
        setActiveIndex(firstEnabledFrom(flatOptions.length - 1, -1))
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (activeIndex >= 0) commit(activeIndex)
        break
      case 'Escape':
        e.preventDefault()
        closeMenu()
        break
      case 'Tab':
        closeMenu(false)
        break
      default:
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
          onTypeahead(e.key)
        }
    }
  }

  function onButtonKeyDown(e: React.KeyboardEvent) {
    if (disabled) return
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openMenu()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      openMenu(firstEnabledFrom(flatOptions.length - 1, -1))
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        id={baseId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={onButtonKeyDown}
        className={`flex w-full items-center justify-between gap-2 rounded border bg-surface px-3 py-2.5 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-50 ${
          open ? 'border-brand ring-2 ring-brand-200' : 'border-line hover:border-brand-300'
        }`}
      >
        <span className={`truncate ${selected ? 'text-ink' : 'text-muted'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-muted transition-transform duration-150 ${
            open ? 'rotate-180 text-brand' : ''
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-labelledby={ariaLabel ? undefined : baseId}
          aria-label={ariaLabel}
          aria-activedescendant={activeIndex >= 0 ? optionDomId(activeIndex) : undefined}
          tabIndex={-1}
          onKeyDown={onListKeyDown}
          className="animate-pop-in absolute z-30 mt-1.5 max-h-72 w-full min-w-[12rem] overflow-auto rounded border border-line bg-surface p-1 shadow-lg shadow-ink/[0.08] focus:outline-none"
        >
          {rows.map((row) =>
            row.kind === 'group' ? (
              <li
                key={row.key}
                role="presentation"
                className="px-2.5 pb-1 pt-2.5 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted/80 first:pt-1"
              >
                {row.label}
              </li>
            ) : (
              <li
                key={row.key}
                id={optionDomId(row.activeIndex)}
                role="option"
                aria-selected={row.option.value === value}
                aria-disabled={row.option.disabled || undefined}
                onClick={() => commit(row.activeIndex)}
                onPointerMove={() =>
                  !row.option.disabled && setActiveIndex(row.activeIndex)
                }
                className={`flex cursor-pointer items-center justify-between gap-3 rounded px-2.5 py-2 text-sm ${
                  row.option.disabled
                    ? 'cursor-not-allowed text-muted/50'
                    : activeIndex === row.activeIndex
                      ? 'bg-brand-50 text-ink'
                      : 'text-ink'
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <svg
                    className={`h-4 w-4 shrink-0 text-brand ${
                      row.option.value === value ? 'opacity-100' : 'opacity-0'
                    }`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.79 6.8-6.79a1 1 0 0 1 1.4 0Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="truncate">{row.option.label}</span>
                </span>
                {row.option.hint && (
                  <span className="tnum shrink-0 font-mono text-[0.7rem] text-muted">
                    {row.option.hint}
                  </span>
                )}
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  )
}

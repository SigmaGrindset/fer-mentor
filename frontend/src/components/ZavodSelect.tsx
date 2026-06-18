import { useMemo } from 'react'
import { useZavodi } from '../api'
import { Select, type SelectOption } from './Select'

/** Reusable zavod (department) filter — modern custom select, real DB counts. */
export function ZavodSelect({
  value,
  onChange,
  id = 'zavod',
  includeAllLabel = 'Svi zavodi',
  className = 'w-52',
}: {
  value: string
  onChange: (value: string) => void
  id?: string
  includeAllLabel?: string
  className?: string
}) {
  const { data: zavodi } = useZavodi()

  const options: SelectOption[] = useMemo(() => {
    const opts: SelectOption[] = [{ value: '', label: includeAllLabel }]
    for (const z of zavodi ?? []) {
      opts.push({ value: z.code, label: z.code, hint: String(z.count) })
    }
    return opts
  }, [zavodi, includeAllLabel])

  return (
    <Select
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      ariaLabel="Filtriraj po zavodu"
      className={className}
    />
  )
}

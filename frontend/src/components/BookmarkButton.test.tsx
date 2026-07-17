import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { getSavedSnapshot } from '../lib/savedStore'
import { useSaved } from '../hooks/useSaved'
import { BookmarkButton } from './BookmarkButton'

/** BookmarkButton as its real call sites use it: wired to the saved store. */
function SaveMentor({ id, name }: { id: number; name: string }) {
  const { isMentorSaved, toggleMentor } = useSaved()
  return (
    <BookmarkButton
      saved={isMentorSaved(id)}
      onToggle={() => toggleMentor({ id, full_name: name, n_theses: 1 })}
      itemLabel={name}
    />
  )
}

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('BookmarkButton', () => {
  it('toggles the saved state and reflects it in aria attributes', async () => {
    const user = userEvent.setup()
    renderWithProviders(<SaveMentor id={201} name="Ivana Kovačević" />)

    const button = screen.getByRole('button', { name: /Spremi: Ivana Kovačević/ })
    expect(button).toHaveAttribute('aria-pressed', 'false')

    await user.click(button)
    expect(
      screen.getByRole('button', { name: /Ukloni iz spremljenih: Ivana Kovačević/ }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(getSavedSnapshot().mentors.some((m) => m.id === 201)).toBe(true)

    await user.click(button)
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(getSavedSnapshot().mentors.some((m) => m.id === 201)).toBe(false)
  })
})

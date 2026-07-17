import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { SearchPage } from './SearchPage'

/**
 * Interaction tests against the in-memory mock API layer (VITE_API_BASE_URL is
 * unset under vitest, so no network is involved).
 */
function renderSearchPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/']}>
        <SearchPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SearchPage', () => {
  it('shows the idle state before any search', () => {
    renderSearchPage()
    expect(screen.getByText('Spremni za pretragu')).toBeInTheDocument()
  })

  it('submit is disabled until a query is typed', async () => {
    const user = userEvent.setup()
    renderSearchPage()
    const submit = screen.getByRole('button', { name: /Pronađi mentore/ })
    expect(submit).toBeDisabled()
    await user.type(screen.getByLabelText('Opiši temu'), 'računalni vid')
    expect(submit).toBeEnabled()
  })

  it('search renders ranked mentors from the mock backend', async () => {
    const user = userEvent.setup()
    renderSearchPage()

    await user.type(screen.getByLabelText('Opiši temu'), 'računalni vid')
    await user.click(screen.getByRole('button', { name: /Pronađi mentore/ }))

    expect(
      await screen.findByRole('heading', { name: 'Predloženi mentori' }, { timeout: 4000 }),
    ).toBeInTheDocument()
    // The mock corpus has a computer-vision mentor; she must rank in results.
    expect(screen.getByRole('link', { name: 'Ivana Kovačević' })).toBeInTheDocument()
  })

  it('empty-ish results state appears for a nonsense query', async () => {
    const user = userEvent.setup()
    renderSearchPage()

    await user.type(screen.getByLabelText('Opiši temu'), 'xyzxyzxyz')
    await user.click(screen.getByRole('button', { name: /Pronađi mentore/ }))

    expect(
      await screen.findByText('Nema pronađenih mentora', undefined, { timeout: 4000 }),
    ).toBeInTheDocument()
  })
})

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ElectivesPage } from './ElectivesPage'

/**
 * Interaction tests against the in-memory mock API layer (VITE_API_BASE_URL is
 * unset under vitest, so no network is involved).
 */
function renderElectivesPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/izborni']}>
        <ElectivesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ElectivesPage', () => {
  it('shows the idle state before any search', () => {
    renderElectivesPage()
    expect(screen.getByText('Spremni za pretragu')).toBeInTheDocument()
  })

  it('submit is disabled until an interest is typed', async () => {
    const user = userEvent.setup()
    renderElectivesPage()
    const submit = screen.getByRole('button', { name: /Pronađi izborne/ })
    expect(submit).toBeDisabled()

    await user.type(screen.getByLabelText('Opiši svoj interes'), 'strojno učenje')
    // The catalogue auto-selects the first programme once loaded, so typing an
    // interest is the last missing precondition.
    expect(await screen.findByRole('button', { name: /Pronađi izborne/ })).toBeEnabled()
  })

  it('search renders ranked courses from the mock backend', async () => {
    const user = userEvent.setup()
    renderElectivesPage()

    await user.type(
      screen.getByLabelText('Opiši svoj interes'),
      'strojno učenje i obrada slike',
    )
    const submit = screen.getByRole('button', { name: /Pronađi izborne/ })
    await user.click(submit)

    expect(
      await screen.findByRole(
        'heading',
        { name: 'Predloženi izborni predmeti' },
        { timeout: 4000 },
      ),
    ).toBeInTheDocument()
    // The mock catalogue has a deep-learning course; it must rank in results.
    expect(screen.getByText('Duboko učenje')).toBeInTheDocument()
  })
})

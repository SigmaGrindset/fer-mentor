import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CharCounter } from './CharCounter'

describe('CharCounter', () => {
  it('shows the running count and no warning below the limit', () => {
    render(<CharCounter length={10} />)
    expect(screen.getByText('10/500')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('announces reaching the limit', () => {
    render(<CharCounter length={500} />)
    expect(screen.getByText('500/500')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Dosegnut je najveći broj znakova (500).',
    )
  })

  it('respects a custom max', () => {
    render(<CharCounter length={3} max={5} />)
    expect(screen.getByText('3/5')).toBeInTheDocument()
  })
})

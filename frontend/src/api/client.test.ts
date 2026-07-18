import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Error mapping and retry behavior of the real-API request path. BASE_URL is
 * read at module scope, so each test stubs VITE_API_BASE_URL and re-imports
 * the client. fetch is stubbed; no network is involved.
 */

type Client = typeof import('./client')

function fakeResponse(status: number, body?: unknown, statusText = '') {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => {
      if (body === undefined) throw new SyntaxError('not json')
      return body
    },
  } as Response
}

const fetchMock = vi.fn<(...args: Parameters<typeof fetch>) => Promise<Response>>()

async function loadClient(): Promise<Client> {
  vi.resetModules()
  return await import('./client')
}

beforeEach(() => {
  vi.stubEnv('VITE_API_BASE_URL', 'http://api.test')
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

/** Run a recommend() call to completion, advancing past the 1.5 s retry pause. */
async function recommendResult(client: Client) {
  const promise = client.recommend({ query: 'test' }).then(
    (value) => ({ ok: true as const, value }),
    (error) => ({ ok: false as const, error }),
  )
  await vi.advanceTimersByTimeAsync(2000)
  return await promise
}

async function recommendError(client: Client): Promise<InstanceType<Client['ApiError']>> {
  const settled = await recommendResult(client)
  if (settled.ok) throw new Error('expected recommend() to reject')
  return settled.error
}

describe('api client error mapping and retry', () => {
  it('talks to BASE_URL and returns parsed JSON on success', async () => {
    const client = await loadClient()
    fetchMock.mockResolvedValueOnce(fakeResponse(200, { query: 'test', results: [] }))

    const settled = await recommendResult(client)

    expect(settled.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/recommend')
  })

  it('429 maps to the rate-limit message and is never retried', async () => {
    const client = await loadClient()
    fetchMock.mockResolvedValue(fakeResponse(429, { detail: 'server detail ignored' }))

    const err = await recommendError(client)

    expect(err.message).toBe('Previše upita — pričekaj minutu.')
    expect(err.status).toBe(429)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('503 twice retries once, then reports the busy message', async () => {
    const client = await loadClient()
    fetchMock.mockResolvedValue(fakeResponse(503))

    const err = await recommendError(client)

    expect(err.message).toBe(
      'Trenutačno je gužva na poslužitelju. Pokušaj ponovno za koji trenutak.',
    )
    expect(err.status).toBe(503)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('503 then 200 succeeds on the retry', async () => {
    const client = await loadClient()
    fetchMock
      .mockResolvedValueOnce(fakeResponse(503))
      .mockResolvedValueOnce(fakeResponse(200, { query: 'test', results: [] }))

    const settled = await recommendResult(client)

    expect(settled.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('a timeout maps to the cold-start message with status 0, after one retry', async () => {
    const client = await loadClient()
    fetchMock.mockRejectedValue(new DOMException('timed out', 'TimeoutError'))

    const err = await recommendError(client)

    expect(err.message).toBe(
      'Poslužitelj se ne javlja — vjerojatno se tek budi. Pokušaj ponovno za minutu.',
    )
    expect(err.status).toBe(0)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('a network failure while offline maps to the offline message', async () => {
    const client = await loadClient()
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false)

    const err = await recommendError(client)

    expect(err.message).toBe('Nema internetske veze. Provjeri mrežu i pokušaj ponovno.')
    expect(err.status).toBe(0)
  })

  it('a network failure while online maps to the generic connect message', async () => {
    const client = await loadClient()
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const err = await recommendError(client)

    expect(err.message).toBe(
      'Ne mogu se spojiti na poslužitelj. Pokušaj ponovno za nekoliko trenutaka.',
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('422 without a usable detail falls back to the 500-char hint', async () => {
    const client = await loadClient()
    // FastAPI validation errors carry an array detail — not user-presentable.
    fetchMock.mockResolvedValue(
      fakeResponse(422, { detail: [{ loc: ['body', 'query'], msg: 'too long' }] }),
    )

    const err = await recommendError(client)

    expect(err.message).toBe(
      'Upit nije prošao provjeru — opis smije imati najviše 500 znakova.',
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('a string detail from the server is shown as-is', async () => {
    const client = await loadClient()
    fetchMock.mockResolvedValue(fakeResponse(400, { detail: 'Neispravan upit.' }))

    const err = await recommendError(client)

    expect(err.message).toBe('Neispravan upit.')
    expect(err.status).toBe(400)
  })

  it('other 5xx map to the generic server-error message', async () => {
    const client = await loadClient()
    fetchMock.mockResolvedValue(fakeResponse(500, {}))

    const err = await recommendError(client)

    expect(err.message).toBe(
      'Poslužitelj je javio pogrešku. Pokušaj ponovno za nekoliko trenutaka.',
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('a non-JSON error body falls back to the status text', async () => {
    const client = await loadClient()
    fetchMock.mockResolvedValue(fakeResponse(400, undefined, 'Bad Request'))

    const err = await recommendError(client)

    expect(err.message).toBe('Bad Request')
  })
})

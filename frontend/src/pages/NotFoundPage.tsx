import { Link } from 'react-router-dom'
import { StateMessage } from '../components/StateMessage'

export function NotFoundPage() {
  return (
    <StateMessage title="Stranica nije pronađena" description="Tražena stranica ne postoji.">
      <Link
        to="/"
        className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        Natrag na početnu
      </Link>
    </StateMessage>
  )
}

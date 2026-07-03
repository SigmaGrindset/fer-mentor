# FERmentor — frontend

React + TypeScript (Vite) sučelje za preporuku mentora. Korisnik opiše temu
slobodnim tekstom, a aplikacija prikaže rangiranu listu mentora s konkretnim
radovima kao dokazom podudaranja.

**Live:** https://fermentor.vercel.app

## Tehnologije

- **Vite** + **React 18** + **TypeScript** (strict)
- **TailwindCSS** za stiliziranje
- **TanStack Query** za dohvat podataka
- **React Router** za dvije glavne stranice
- Sve besplatno / open-source. Bez plaćenih servisa i fontova.

## Pokretanje

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

Bez postavljene `VITE_API_BASE_URL` aplikacija koristi ugrađeni **mock sloj**
(`src/api/mock.ts`) s realnim hrvatskim demo podatcima — radi i bez backenda.

## Spajanje na pravi backend

Postavi jednu varijablu okoline (vidi `.env.example`):

```bash
# frontend/.env
VITE_API_BASE_URL=http://localhost:8000
```

Klijent (`src/api/client.ts`) tada šalje zahtjeve na pravi FastAPI backend pod
`/api/...`. Restartaj `npm run dev` nakon izmjene `.env`.

## Skripte

- `npm run dev` — razvojni poslužitelj
- `npm run build` — TypeScript provjera + produkcijski build (`dist/`)
- `npm run preview` — lokalni pregled produkcijskog builda
- `npm run lint` — samo TypeScript provjera (`tsc --noEmit`)

## Struktura

```
src/
  api/
    types.ts      # TS preslika ugovora iz core/schemas.py
    client.ts     # mock <-> backend prekidač (VITE_API_BASE_URL)
    mock.ts       # mock implementacija + naivno rangiranje po ključnim riječima
    mockData.ts   # ~8 hrvatskih mentora i radova
    hooks.ts      # TanStack Query hookovi
    index.ts      # barrel export
  components/      # Layout, MentorCard, SearchForm, Badge, ScoreMeter, ...
  pages/          # SearchPage, MentorPage, MentorListPage, NotFoundPage
  lib/format.ts   # hrvatski prikazni helperi (množina, tipovi radova)
```

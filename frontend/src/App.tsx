import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ElectivesPage } from './pages/ElectivesPage'
import { MentorListPage } from './pages/MentorListPage'
import { MentorPage } from './pages/MentorPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { SavedPage } from './pages/SavedPage'
import { SearchPage } from './pages/SearchPage'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<SearchPage />} />
        <Route path="/izborni" element={<ElectivesPage />} />
        <Route path="/mentor/:id" element={<MentorPage />} />
        <Route path="/mentori" element={<MentorListPage />} />
        <Route path="/spremljeni" element={<SavedPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  )
}

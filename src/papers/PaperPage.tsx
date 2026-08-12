import { useParams } from 'react-router-dom'
import ChapterView from './ChapterView'
import { CHAPTER_BY_SLUG } from './chapters'
import NotFound from '../pages/NotFound'

export default function PaperPage() {
  const { slug } = useParams<{ slug: string }>()
  const chapter = slug ? CHAPTER_BY_SLUG[slug] : undefined

  if (!chapter) return <NotFound />
  return <ChapterView chapter={chapter} />
}

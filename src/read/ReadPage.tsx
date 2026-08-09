import { useParams } from 'react-router-dom'
import ComicView from './Comic'
import { COMIC_BY_SLUG } from './comics'
import NotFound from '../pages/NotFound'

export default function ReadPage() {
  const { slug } = useParams<{ slug: string }>()
  const comic = slug ? COMIC_BY_SLUG[slug] : undefined

  if (!comic) return <NotFound />
  return <ComicView comic={comic} />
}

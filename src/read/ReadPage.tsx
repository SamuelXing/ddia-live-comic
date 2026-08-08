import { useParams } from 'react-router-dom'
import { useEffect } from 'react'
import ComicView from './Comic'
import { COMIC_BY_SLUG } from './comics'
import NotFound from '../pages/NotFound'

export default function ReadPage() {
  const { slug } = useParams<{ slug: string }>()
  const comic = slug ? COMIC_BY_SLUG[slug] : undefined

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [slug])

  if (!comic) return <NotFound />
  return <ComicView comic={comic} />
}

import { Link } from 'react-router-dom'

export interface IdeaLink {
  slug: string
  label: string
}

/** A dark-skinned strip that links a component/simulation UP to the idea
 *  comics it embodies (Layer 2/3 → Layer 1). Styled via .idea-strip in global.css. */
export default function IdeaStrip({ label = 'Made of these ideas', ideas }: { label?: string; ideas: IdeaLink[] }) {
  return (
    <div className="idea-strip">
      <span className="idea-strip-l">{label}</span>
      <div className="idea-strip-links">
        {ideas.map((i) => (
          <Link key={i.slug} to={'/read/' + i.slug}>
            {i.label} →
          </Link>
        ))}
      </div>
    </div>
  )
}

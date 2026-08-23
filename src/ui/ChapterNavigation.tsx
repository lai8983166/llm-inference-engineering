import { Link } from 'react-router'

interface ChapterLink {
  number: string
  title: string
  to: string
}

interface ChapterNavigationProps {
  previous?: ChapterLink
  next?: ChapterLink
}

export function ChapterNavigation({ previous, next }: ChapterNavigationProps) {
  return (
    <nav className="chapter-navigation" aria-label="章节导航">
      {previous
        ? <Link className="chapter-previous" to={previous.to}><span>← 上一章 · {previous.number}</span><strong>{previous.title}</strong></Link>
        : <span aria-hidden="true" />}
      {next
        ? <Link className="chapter-next" to={next.to}><span>下一章 · {next.number} →</span><strong>{next.title}</strong></Link>
        : <span aria-hidden="true" />}
    </nav>
  )
}

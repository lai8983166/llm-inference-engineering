import { Link } from 'react-router'

export function NotFoundPage() {
  return <article className="not-found"><h1>这条路径还没有内容</h1><Link to="/">返回课程入口</Link></article>
}

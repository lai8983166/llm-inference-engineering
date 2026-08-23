import { Link, Outlet } from 'react-router'

export function AppLayout() {
  return (
    <>
      <a className="skip-link" href="#main-content">跳到正文</a>
      <header className="site-header">
        <Link className="site-brand" to="/">LLM Inference Engineering</Link>
        <span>问题驱动的推理系统课程</span>
      </header>
      <main id="main-content"><Outlet /></main>
    </>
  )
}

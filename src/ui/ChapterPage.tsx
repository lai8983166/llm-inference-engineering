import SingleRequestChapter from '@/content/chapters/single-request.mdx'

export function ChapterPage() {
  return (
    <article className="chapter-page">
      <header className="chapter-header">
        <p className="chapter-number">01 · SINGLE REQUEST</p>
        <h1>一次请求怎样活着</h1>
        <p>从一个 API 调用进入自回归执行，直到最后一项资源被释放。</p>
      </header>
      <nav className="chapter-toc" aria-label="本章内容">
        <a href="#one-call-many-steps">一次调用，多次执行</a>
        <a href="#two-shapes">同一循环的两种形状</a>
        <a href="#visible-output">生成不等于可见</a>
        <a href="#request-state">状态从哪里来</a>
        <a href="#termination">结束不是一个瞬间</a>
      </nav>
      <div className="chapter-prose"><SingleRequestChapter /></div>
    </article>
  )
}

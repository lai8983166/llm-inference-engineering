import SingleRequestChapter from '@/content/chapters/single-request.mdx'
import { RequestPulseHero } from '@/visuals/RequestPulseHero'
import { ChapterNavigation } from './ChapterNavigation'

export function ChapterPage() {
  return (
    <article className="chapter-page">
      <header className="chapter-header">
        <div className="chapter-intro">
          <p className="chapter-number">CHAPTER 01 · SINGLE REQUEST</p>
          <h1>一次请求<br />怎样活着</h1>
          <p>从一个 API 调用进入自回归执行，直到最后一项资源被释放。</p>
          <p className="reading-time">约 28 分钟 · 含 4 个动态推演</p>
        </div>
        <RequestPulseHero />
      </header>
      <div className="chapter-reading">
        <nav className="chapter-toc" aria-label="本章内容">
          <span>阅读路径</span>
          <a href="#one-call-many-steps"><b>01</b>一次调用，多次执行</a>
          <a href="#two-shapes"><b>02</b>同一循环的两种形状</a>
          <a href="#visible-output"><b>03</b>生成不等于可见</a>
          <a href="#request-state"><b>04</b>状态从哪里来</a>
          <a href="#termination"><b>05</b>结束不是一个瞬间</a>
        </nav>
        <div className="chapter-prose"><SingleRequestChapter /></div>
      </div>
      <ChapterNavigation previous={{ number: '00', title: '建立可相信的基线', to: '/chapters/trustworthy-baseline' }} />
    </article>
  )
}

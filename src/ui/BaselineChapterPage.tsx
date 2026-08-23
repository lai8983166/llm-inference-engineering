import TrustworthyBaselineChapter from '@/content/chapters/trustworthy-baseline.mdx'
import { ChapterNavigation } from './ChapterNavigation'

export function BaselineChapterPage() {
  return (
    <article className="chapter-page baseline-chapter-page">
      <header className="chapter-header baseline-chapter-header">
        <div className="chapter-intro">
          <p className="chapter-number">CHAPTER 00 · TRUSTWORTHY BASELINE</p>
          <h1>建立可相信的<br />基线</h1>
          <p>在优化系统以前，先学会判断一项性能主张有没有证据。</p>
          <p className="reading-time">约 24 分钟 · 先审查证据，再讨论优化</p>
        </div>
        <aside className="baseline-claim" aria-label="一项尚待审查的性能主张">
          <header><span>CLAIM / 00</span><b>UNVERIFIED</b></header>
          <div className="claim-value">
            <span>IMPLEMENTATION B</span>
            <strong>30%</strong>
            <em>FASTER</em>
          </div>
          <dl>
            <div><dt>observer</dt><dd>?</dd></div>
            <div><dt>finish event</dt><dd>?</dd></div>
            <div><dt>raw evidence</dt><dd>missing</dd></div>
          </dl>
          <p>现在只有结论，还没有足够的证据。</p>
        </aside>
      </header>
      <div className="chapter-reading baseline-chapter-reading">
        <nav className="chapter-toc" aria-label="本章内容">
          <span>审查路径</span>
          <a href="#same-work"><b>01</b>做的是同一件事吗</a>
          <a href="#observer-window"><b>02</b>秒表观察了谁</a>
          <a href="#async-completion"><b>03</b>返回是否等于完成</a>
          <a href="#cold-and-steady"><b>04</b>第一次为何不同</a>
          <a href="#evidence"><b>05</b>数字如何成为证据</a>
        </nav>
        <div className="chapter-prose"><TrustworthyBaselineChapter /></div>
      </div>
      <ChapterNavigation next={{ number: '01', title: '一次请求怎样活着', to: '/chapters/single-request' }} />
    </article>
  )
}

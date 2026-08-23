import TrustworthyBaselineChapter from '@/content/chapters/trustworthy-baseline.mdx'

export function BaselineChapterPage() {
  return (
    <article className="chapter-page baseline-chapter-page">
      <header className="chapter-header baseline-chapter-header">
        <div className="chapter-intro">
          <p className="chapter-number">CHAPTER 00 · TRUSTWORTHY BASELINE</p>
          <h1>建立可相信的<br />基线</h1>
          <p>在优化系统以前，先学会判断一项性能主张有没有证据。</p>
          <p className="reading-time">内容底座已建立 · 连续正文建设中</p>
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
      <div className="baseline-reading-shell">
        <div className="chapter-prose"><TrustworthyBaselineChapter /></div>
      </div>
    </article>
  )
}

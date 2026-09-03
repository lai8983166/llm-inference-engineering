import OptimizationChapter from '@/content/chapters/optimization.mdx'
import { ChapterNavigation } from './ChapterNavigation'

const optimizationInputs = [
  { field: '基线预算', value: '提交 2 · launch 8 · 同步 2 · 访存 6 · 计算 2' },
  { field: '合计', value: '20 单位（launch 40%）' },
  { field: '噪声样本', value: '固定记录两组，非生成' },
  { field: '单位', value: '预算单位（不是时间）' },
]

export function OptimizationChapterPage() {
  return (
    <article className="chapter-page optimization-chapter-page">
      <header className="chapter-header optimization-chapter-header">
        <div className="chapter-intro">
          <p className="chapter-number">CHAPTER 09 · OPTIMIZATION ATTRIBUTION</p>
          <h1>优化收益<br />去哪了</h1>
          <p>用一张预算表算清局部优化与端到端收益的关系：指纹、上限、噪声与归因链。</p>
          <p className="reading-time">约 24 分钟 · 从预算反例推到主线收束</p>
        </div>
        <aside className="kv-model-manifest optimization-manifest" aria-label="第 09 章固定预算输入">
          <header><span>TEACHING BUDGET / SIMULATED</span><b>单位：预算</b></header>
          <dl>
            {optimizationInputs.map((item, index) => (
              <div key={`${item.field}-${index}`}>
                <dt>{item.field}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
          <p>预算单位与样本读数不对应任何真实时间量纲；真实占比与收益必须实测。</p>
        </aside>
      </header>
      <div className="chapter-reading optimization-chapter-reading">
        <nav className="chapter-toc" aria-label="本章内容">
          <span>推导路径</span>
          <a href="#local-vs-system"><b>01</b>局部变快，端到端没动</a>
          <a href="#bottleneck-signatures"><b>02</b>五种瓶颈，五种指纹</a>
          <a href="#budget-ceiling"><b>03</b>预算表决定收益上限</a>
          <a href="#noise-controls"><b>04</b>噪声、对照与最小实验</a>
          <a href="#attribution-chain"><b>05</b>归因是证据链，不是直觉</a>
        </nav>
        <div className="chapter-prose"><OptimizationChapter /></div>
      </div>
      <ChapterNavigation
        previous={{ number: '08', title: '均值会说谎，事件不会', to: '/chapters/metrics' }}
        next={{ number: '10', title: '命中不是免费的', to: '/chapters/prefix-cache' }}
      />
    </article>
  )
}

import KvStateChapter from '@/content/chapters/kv-state.mdx'
import { ChapterNavigation } from './ChapterNavigation'

const modelDimensions = [
  { field: 'layers', value: '4' },
  { field: 'query heads', value: '8' },
  { field: 'kv heads', value: '2 (GQA)' },
  { field: 'head dim', value: '4' },
  { field: 'dtype', value: '2 bytes' },
]

export function KvStateChapterPage() {
  return (
    <article className="chapter-page kv-state-chapter-page">
      <header className="chapter-header kv-state-chapter-header">
        <div className="chapter-intro">
          <p className="chapter-number">CHAPTER 03 · KV STATE</p>
          <h1>KV 为什么<br />成为系统状态</h1>
          <p>从一次 Attention 的历史依赖出发，把 KV 的字节、所有权和连续布局的失败一步步逼出来。</p>
          <p className="reading-time">约 28 分钟 · 从历史依赖推到物理布局边界</p>
        </div>
        <aside className="kv-model-manifest" aria-label="第 03 章固定教学模型">
          <header><span>TEACHING MODEL / SIMULATED</span><b>128 B / TOKEN</b></header>
          <dl>
            {modelDimensions.map((item) => (
              <div key={item.field}>
                <dt>{item.field}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
            <div>
              <dt>pool</dt>
              <dd>24 units · 3072 B</dd>
            </div>
          </dl>
          <p>每 token 128 bytes 由上表原始维度复算，不是真实模型常数；请求沿用 `R-long`、`R-short`、`R-late`。</p>
        </aside>
      </header>
      <div className="chapter-reading kv-state-chapter-reading">
        <nav className="chapter-toc" aria-label="本章内容">
          <span>推导路径</span>
          <a href="#recompute-or-reuse"><b>01</b>下一 token 又要过去的什么</a>
          <a href="#kv-byte-ledger"><b>02</b>保存 K/V 不是免费的</a>
          <a href="#max-reservation"><b>03</b>最大预留把未知变成空占</a>
          <a href="#contiguous-growth"><b>04</b>按需增长把空间变成搬迁</a>
          <a href="#fragmentation-wall"><b>05</b>空闲总量够，连续空间仍不够</a>
        </nav>
        <div className="chapter-prose"><KvStateChapter /></div>
      </div>
      <ChapterNavigation previous={{ number: '02', title: '朴素并发为什么不够', to: '/chapters/naive-concurrency' }} />
    </article>
  )
}

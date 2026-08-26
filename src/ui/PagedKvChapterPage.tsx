import PagedKvChapter from '@/content/chapters/paged-kv.mdx'
import { ChapterNavigation } from './ChapterNavigation'

const poolDimensions = [
  { field: '池容量', value: '24 units · 3072 B' },
  { field: '块大小', value: '4 units · 512 B' },
  { field: '块数', value: '6 块' },
  { field: '每 token', value: '128 B (GQA)' },
]

export function PagedKvChapterPage() {
  return (
    <article className="chapter-page paged-kv-chapter-page">
      <header className="chapter-header paged-kv-chapter-header">
        <div className="chapter-intro">
          <p className="chapter-number">CHAPTER 04 · PAGED KV</p>
          <h1>分页 KV<br />怎样被逼出来</h1>
          <p>从第 03 章的四条布局合同出发，让离散分段、固定块、块表与块池一个个从矛盾里长出来。</p>
          <p className="reading-time">约 28 分钟 · 从布局合同推到仍未解决的准入问题</p>
        </div>
        <aside className="kv-model-manifest paged-kv-manifest" aria-label="第 04 章固定块池模型">
          <header><span>TEACHING POOL / SIMULATED</span><b>6 × 4 UNITS</b></header>
          <dl>
            {poolDimensions.map((item) => (
              <div key={item.field}>
                <dt>{item.field}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
          <p>模型、请求与物理池完全延续第 03 章：`R-long`、`R-short`、`R-late` 走进划分成 6 块的同一个 24-unit 池。</p>
        </aside>
      </header>
      <div className="chapter-reading paged-kv-chapter-reading">
        <nav className="chapter-toc" aria-label="本章内容">
          <span>推导路径</span>
          <a href="#split-intervals"><b>01</b>拆成几段，合同还在吗</a>
          <a href="#piece-granularity"><b>02</b>空位复用卡在粒度上</a>
          <a href="#block-table"><b>03</b>块表是显式的映射合同</a>
          <a href="#block-pool"><b>04</b>块池准入与独立回收</a>
          <a href="#block-size-tradeoff"><b>05</b>块大小把浪费换成间接</a>
        </nav>
        <div className="chapter-prose"><PagedKvChapter /></div>
      </div>
      <ChapterNavigation previous={{ number: '03', title: 'KV 为什么成为系统状态', to: '/chapters/kv-state' }} />
    </article>
  )
}

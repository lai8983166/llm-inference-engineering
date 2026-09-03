import PrefixCacheChapter from '@/content/chapters/prefix-cache.mdx'
import { ChapterNavigation } from './ChapterNavigation'

const cacheInputs = [
  { field: '块池', value: '5 块 × 4 unit' },
  { field: '共享前缀', value: 'S-a/S-b 共享 4 token（1 块）' },
  { field: '工作量', value: 'S-a/S-b/S-c/S-d' },
  { field: '指标', value: '命中率 1/2（simulated）' },
]

export function PrefixCacheChapterPage() {
  return (
    <article className="chapter-page prefix-cache-chapter-page">
      <header className="chapter-header prefix-cache-chapter-header">
        <div className="chapter-intro">
          <p className="chapter-number">CHAPTER 10 · PREFIX CACHE</p>
          <h1>命中不是<br />免费的</h1>
          <p>以前缀缓存为机制样本：块对齐命中、引用计数所有权、逐出拉锯与组合合同的重签。</p>
          <p className="reading-time">约 24 分钟 · 从重复计算推到组合合同</p>
        </div>
        <aside className="kv-model-manifest prefix-cache-manifest" aria-label="第 10 章固定缓存输入">
          <header><span>TEACHING POOL / SIMULATED</span><b>共享前缀 1 块</b></header>
          <dl>
            {cacheInputs.map((item, index) => (
              <div key={`${item.field}-${index}`}>
                <dt>{item.field}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
          <p>模型与拍内顺序延续前章；命中率与 rc 是教学记账，不换算为真实收益。</p>
        </aside>
      </header>
      <div className="chapter-reading prefix-cache-chapter-reading">
        <nav className="chapter-toc" aria-label="本章内容">
          <span>推导路径</span>
          <a href="#shared-prefix"><b>01</b>同一个前缀，两份计算</a>
          <a href="#hit-and-ledger"><b>02</b>命中改写准入账本</a>
          <a href="#shared-ownership"><b>03</b>共享改写所有权</a>
          <a href="#eviction-budget"><b>04</b>逐出与预算的拉锯</a>
          <a href="#combination-contract"><b>05</b>组合之前，先重签合同</a>
        </nav>
        <div className="chapter-prose"><PrefixCacheChapter /></div>
      </div>
      <ChapterNavigation previous={{ number: '09', title: '优化收益去哪了', to: '/chapters/optimization' }} />
    </article>
  )
}

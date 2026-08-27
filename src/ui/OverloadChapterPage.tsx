import OverloadChapter from '@/content/chapters/overload.mdx'
import { ChapterNavigation } from './ChapterNavigation'

const overloadInputs = [
  { field: '块池', value: '6 块 × 4 unit' },
  { field: '突发', value: 'P-a/P-b @t0 · P-c @t1 · P-d @t2' },
  { field: '需求', value: '2/2/2/1 块 prefill' },
  { field: 't1 末空闲', value: '0 块' },
]

export function OverloadChapterPage() {
  return (
    <article className="chapter-page overload-chapter-page">
      <header className="chapter-header overload-chapter-header">
        <div className="chapter-intro">
          <p className="chapter-number">CHAPTER 06 · OVERLOAD ADMISSION</p>
          <h1>过载的成本<br />由谁承担</h1>
          <p>让突发把块池打到见底，再沿排队、拒绝、水位与抢占四条轨迹看清每种准入分配了什么。</p>
          <p className="reading-time">约 26 分钟 · 从池见底推到四张账单</p>
        </div>
        <aside className="kv-model-manifest overload-manifest" aria-label="第 06 章固定过载输入">
          <header><span>TEACHING POOL / SIMULATED</span><b>池见底 @t1</b></header>
          <dl>
            {overloadInputs.map((item) => (
              <div key={item.field}>
                <dt>{item.field}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
          <p>模型与块池延续第 03—05 章；四条策略共用同一突发工作量，拍内顺序沿用 prefill 优先。</p>
        </aside>
      </header>
      <div className="chapter-reading overload-chapter-reading">
        <nav className="chapter-toc" aria-label="本章内容">
          <span>推导路径</span>
          <a href="#burst-arrives"><b>01</b>突发让池见底</a>
          <a href="#cost-bearer"><b>02</b>过载成本必有承担者</a>
          <a href="#preempt-recompute"><b>03</b>抢占：请一位在跑者让位</a>
          <a href="#priority-dial"><b>04</b>优先级把排队变成有向选择</a>
          <a href="#no-free-lunch"><b>05</b>没有免费方向，只有服务承诺</a>
        </nav>
        <div className="chapter-prose"><OverloadChapter /></div>
      </div>
      <ChapterNavigation previous={{ number: '05', title: '下一拍执行谁', to: '/chapters/scheduling' }} />
    </article>
  )
}

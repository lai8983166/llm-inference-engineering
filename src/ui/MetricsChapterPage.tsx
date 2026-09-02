import MetricsChapter from '@/content/chapters/metrics.mdx'
import { ChapterNavigation } from './ChapterNavigation'

const metricsInputs = [
  { field: '工作量', value: 'K-a…K-f · 6 块池' },
  { field: '注入', value: 'K-b 取消 @t4（生成中）' },
  { field: '注入', value: 'K-e 超时 @t4（排队中）' },
  { field: '指标单位', value: '逻辑拍（定义可迁移）' },
]

export function MetricsChapterPage() {
  return (
    <article className="chapter-page metrics-chapter-page">
      <header className="chapter-header metrics-chapter-header">
        <div className="chapter-intro">
          <p className="chapter-number">CHAPTER 08 · METRICS EVIDENCE</p>
          <h1>均值会说谎，<br />事件不会</h1>
          <p>从原始事件推导指标的定义、分布、环式与口径，让每一步聚合都能走回头路。</p>
          <p className="reading-time">约 26 分钟 · 从事件对推到归因指向</p>
        </div>
        <aside className="kv-model-manifest metrics-manifest" aria-label="第 08 章固定指标输入">
          <header><span>TEACHING METRICS / SIMULATED</span><b>单位：拍</b></header>
          <dl>
            {metricsInputs.map((item, index) => (
              <div key={`${item.field}-${index}`}>
                <dt>{item.field}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
          <p>事件底座延续第 07 章终止轨迹；指标是事件对的差值，拍数不换算为真实时间。</p>
        </aside>
      </header>
      <div className="chapter-reading metrics-chapter-reading">
        <nav className="chapter-toc" aria-label="本章内容">
          <span>推导路径</span>
          <a href="#event-pairs"><b>01</b>每个指标都是事件对的差</a>
          <a href="#distribution-not-mean"><b>02</b>分布先于均值</a>
          <a href="#open-closed-loop"><b>03</b>开放环与闭环测的不是同一件事</a>
          <a href="#goodput"><b>04</b>完成不等于有效</a>
          <a href="#aggregation-chain"><b>05</b>聚合链要能走回头路</a>
        </nav>
        <div className="chapter-prose"><MetricsChapter /></div>
      </div>
      <ChapterNavigation
        previous={{ number: '07', title: '一次请求怎样死去', to: '/chapters/termination' }}
        next={{ number: '09', title: '优化收益去哪了', to: '/chapters/optimization' }}
      />
    </article>
  )
}

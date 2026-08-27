import SchedulingChapter from '@/content/chapters/scheduling.mdx'
import { ChapterNavigation } from './ChapterNavigation'

const schedulingInputs = [
  { field: '到达且输入就绪', value: 'per request' },
  { field: 'phase 已知', value: 'prefill / decode' },
  { field: '块准入', value: '6 块 × 4 unit' },
  { field: '不在途 · 未结束', value: 'per request' },
]

export function SchedulingChapterPage() {
  return (
    <article className="chapter-page scheduling-chapter-page">
      <header className="chapter-header scheduling-chapter-header">
        <div className="chapter-intro">
          <p className="chapter-number">CHAPTER 05 · SCHEDULING LOOP</p>
          <h1>下一拍<br />执行谁</h1>
          <p>把第 02 章“下一次执行该选谁”拆成可推导的调度循环：可运行集合、逐拍成员重组与策略竞争。</p>
          <p className="reading-time">约 26 分钟 · 从执行边界推到调度合同</p>
        </div>
        <aside className="kv-model-manifest scheduling-manifest" aria-label="第 05 章固定调度输入">
          <header><span>TEACHING POOL / SIMULATED</span><b>每拍一份工作</b></header>
          <dl>
            {schedulingInputs.map((item) => (
              <div key={item.field}>
                <dt>{item.field}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
          <p>请求与块池延续第 03、04 章：`R-long`、`R-short`、`R-late` 在 6 块池上，按 prefill 优先或 decode 优先两种策略推进。</p>
        </aside>
      </header>
      <div className="chapter-reading scheduling-chapter-reading">
        <nav className="chapter-toc" aria-label="本章内容">
          <span>推导路径</span>
          <a href="#tick-decision"><b>01</b>执行边界是一个决定点</a>
          <a href="#runnable-set"><b>02</b>可运行集合由合同定义</a>
          <a href="#open-membership"><b>03</b>成员每拍重组，批次不再封闭</a>
          <a href="#prefill-decode-contention"><b>04</b>prefill 与 decode 竞争同一拍</a>
          <a href="#policy-contracts"><b>05</b>调度需要合同，而不是默认值</a>
        </nav>
        <div className="chapter-prose"><SchedulingChapter /></div>
      </div>
      <ChapterNavigation
        previous={{ number: '04', title: '分页 KV 怎样被逼出来', to: '/chapters/paged-kv' }}
        next={{ number: '06', title: '过载的成本由谁承担', to: '/chapters/overload' }}
      />
    </article>
  )
}

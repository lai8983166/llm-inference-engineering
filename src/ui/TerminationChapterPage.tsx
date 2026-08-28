import TerminationChapter from '@/content/chapters/termination.mdx'
import { ChapterNavigation } from './ChapterNavigation'

const terminationInputs = [
  { field: '块池', value: '6 块 × 4 unit' },
  { field: '突发', value: 'C-a/C-b @t0 · C-c @t1 · C-d @t2 · C-e @t3' },
  { field: '注入', value: 'C-b 取消 @t4（生成中）' },
  { field: '注入', value: 'C-e 超时 @t4（排队中）' },
]

export function TerminationChapterPage() {
  return (
    <article className="chapter-page termination-chapter-page">
      <header className="chapter-header termination-chapter-header">
        <div className="chapter-intro">
          <p className="chapter-number">CHAPTER 07 · TERMINATION SEMANTICS</p>
          <h1>一次请求<br />怎样死去</h1>
          <p>把取消、超时、断开与失败纳入状态机：六条终点路径、同一次清理、一份机器可校验的无泄漏合同。</p>
          <p className="reading-time">约 26 分钟 · 从任意状态取消推到可观测终点</p>
        </div>
        <aside className="kv-model-manifest termination-manifest" aria-label="第 07 章固定终止输入">
          <header><span>TEACHING POOL / SIMULATED</span><b>终止注入 ×2</b></header>
          <dl>
            {terminationInputs.map((item, index) => (
              <div key={`${item.field}-${index}`}>
                <dt>{item.field}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
          <p>池与拍内顺序延续第 05/06 章；终止在拍内最先处理，清理仪式在终态当拍一次走完。</p>
        </aside>
      </header>
      <div className="chapter-reading termination-chapter-reading">
        <nav className="chapter-toc" aria-label="本章内容">
          <span>推导路径</span>
          <a href="#cancel-any-state"><b>01</b>取消可以落在任何状态</a>
          <a href="#terminal-unification"><b>02</b>所有终点汇入同一次清理</a>
          <a href="#timeout-disconnect"><b>03</b>超时与断开：取消的两个隐式来源</a>
          <a href="#failure-isolation"><b>04</b>失败的爆炸半径</a>
          <a href="#no-leak-contract"><b>05</b>无泄漏合同与可观测的终点</a>
        </nav>
        <div className="chapter-prose"><TerminationChapter /></div>
      </div>
      <ChapterNavigation previous={{ number: '06', title: '过载的成本由谁承担', to: '/chapters/overload' }} />
    </article>
  )
}

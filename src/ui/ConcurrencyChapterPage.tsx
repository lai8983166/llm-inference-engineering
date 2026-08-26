import NaiveConcurrencyChapter from '@/content/chapters/naive-concurrency.mdx'
import { ChapterNavigation } from './ChapterNavigation'

const requests = [
  { id: 'R-long', arrival: 'step 0', shape: 'prompt 6 · output 4' },
  { id: 'R-short', arrival: 'step 1', shape: 'prompt 2 · output 1' },
  { id: 'R-late', arrival: 'step 3', shape: 'prompt 4 · output 2' },
]

export function ConcurrencyChapterPage() {
  return (
    <article className="chapter-page concurrency-chapter-page">
      <header className="chapter-header concurrency-chapter-header">
        <div className="chapter-intro">
          <p className="chapter-number">CHAPTER 02 · NAIVE CONCURRENCY</p>
          <h1>朴素并发<br />为什么不够</h1>
          <p>让多个长短请求同时进入服务，观察正确的单请求循环从哪里开始失效。</p>
          <p className="reading-time">约 26 分钟 · 从固定请求推到未解调度问题</p>
        </div>
        <aside className="arrival-manifest" aria-label="第 02 章固定请求清单">
          <header><span>ARRIVAL MANIFEST / SIMULATED</span><b>FIXED WORKLOAD</b></header>
          <ol>
            {requests.map((request) => (
              <li key={request.id}>
                <span>{request.arrival}</span>
                <strong>{request.id}</strong>
                <small>{request.shape}</small>
              </li>
            ))}
          </ol>
          <p>后续只改变执行组织，不更换请求工作量。</p>
        </aside>
      </header>
      <div className="chapter-reading concurrency-chapter-reading">
        <nav className="chapter-toc" aria-label="本章内容">
          <span>推导路径</span>
          <a href="#multiple-requests"><b>01</b>当第二个请求到达</a>
          <a href="#independent-loops"><b>02</b>两个循环不等于两份设备时间</a>
          <a href="#static-batch"><b>03</b>把等待请求放进一次执行</a>
          <a href="#batch-diverges"><b>04</b>同一批请求不会一起结束</a>
          <a href="#next-choice"><b>05</b>下一次执行该选谁</a>
        </nav>
        <div className="chapter-prose"><NaiveConcurrencyChapter /></div>
      </div>
      <ChapterNavigation
        previous={{ number: '01', title: '一次请求怎样活着', to: '/chapters/single-request' }}
        next={{ number: '03', title: 'KV 为什么成为系统状态', to: '/chapters/kv-state' }}
      />
    </article>
  )
}

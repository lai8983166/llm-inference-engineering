import { Link } from 'react-router'

export function HomePage() {
  return (
    <article className="landing-page">
      <div className="landing-hero">
        <div>
          <p className="chapter-number">LLM SYSTEMS · GUIDED ENGINEERING</p>
          <h1>不要背框架。<br />看系统怎样被逼出来。</h1>
          <p className="landing-intro">从一次生成请求开始，沿着依赖、状态、资源和失败一步步走进推理引擎。动画负责让过程可见，正文负责解释它为什么只能这样发生。</p>
          <Link className="start-link" to="/chapters/single-request">进入第 01 章 <span aria-hidden="true">→</span></Link>
        </div>
        <aside className="landing-signal" aria-label="第一章系统信号预览">
          <header><span>REQUEST / 01</span><b>LIVE</b></header>
          <div className="signal-flow" aria-hidden="true">
            <i>API</i><span /><i>MODEL</i><span /><i>STREAM</i>
          </div>
          <dl>
            <div><dt>API calls</dt><dd>1</dd></div>
            <div><dt>model runs</dt><dd>4</dd></div>
            <div><dt>state</dt><dd>growing</dd></div>
          </dl>
          <p>一个调用，并不是一次计算。</p>
        </aside>
      </div>
      <section className="scope-statement" aria-labelledby="scope-title">
        <h2 id="scope-title">第一条推导链</h2>
        <p>API 请求 → 自回归循环 → 两种执行形状 → 流式可见边界 → 终止与资源释放</p>
      </section>
    </article>
  )
}

import { Link } from 'react-router'

export function HomePage() {
  return (
    <article className="landing-page">
      <div className="landing-hero">
        <div>
          <p className="chapter-number">LLM SYSTEMS · GUIDED ENGINEERING</p>
          <h1>不要背框架。<br />看系统怎样被逼出来。</h1>
          <p className="landing-intro">先学会判断“正确”和“更快”有没有证据，再从一次生成请求沿着依赖、状态、资源和失败走进推理引擎。</p>
          <Link className="start-link" to="/chapters/trustworthy-baseline">从第 00 章开始 <span aria-hidden="true">→</span></Link>
        </div>
        <aside className="landing-signal" aria-label="第零章证据审查预览">
          <header><span>EVIDENCE / 00</span><b>UNVERIFIED</b></header>
          <div className="signal-flow" aria-hidden="true">
            <i>CLAIM</i><span /><i>EVENTS</i><span /><i>VERDICT</i>
          </div>
          <dl>
            <div><dt>observer</dt><dd>?</dd></div>
            <div><dt>window</dt><dd>?</dd></div>
            <div><dt>evidence</dt><dd>missing</dd></div>
          </dl>
          <p>一个更快的数字，还不是证据。</p>
        </aside>
      </div>
      <section className="chapter-index" aria-labelledby="chapter-index-title">
        <h2 id="chapter-index-title">从证据进入系统</h2>
        <ol>
          <li>
            <Link to="/chapters/trustworthy-baseline"><b>00</b><span><strong>建立可相信的基线</strong><small>判断“正确”和“更快”需要什么证据</small></span></Link>
          </li>
          <li>
            <Link to="/chapters/single-request"><b>01</b><span><strong>一次请求怎样活着</strong><small>从 API 合同进入执行、状态和资源生命周期</small></span></Link>
          </li>
          <li>
            <Link to="/chapters/naive-concurrency"><b>02</b><span><strong>朴素并发为什么不够</strong><small>让长短请求同时到达，寻找排队与执行组织的边界</small></span></Link>
          </li>
          <li>
            <Link to="/chapters/kv-state"><b>03</b><span><strong>KV 为什么成为系统状态</strong><small>从 Attention 历史依赖推出容量、所有权与连续布局的失败</small></span></Link>
          </li>
          <li>
            <Link to="/chapters/paged-kv"><b>04</b><span><strong>分页 KV 怎样被逼出来</strong><small>从布局合同推导离散分段、固定块、块表与块池</small></span></Link>
          </li>
          <li>
            <Link to="/chapters/scheduling"><b>05</b><span><strong>下一拍执行谁</strong><small>从执行边界推导可运行集合、连续批处理与策略合同</small></span></Link>
          </li>
          <li>
            <Link to="/chapters/overload"><b>06</b><span><strong>过载的成本由谁承担</strong><small>让池见底，比较排队、拒绝、水位与抢占四种成本分配</small></span></Link>
          </li>
          <li>
            <Link to="/chapters/termination"><b>07</b><span><strong>一次请求怎样死去</strong><small>把取消、超时、断开与失败纳入同一套清理与无泄漏合同</small></span></Link>
          </li>
        </ol>
      </section>
    </article>
  )
}

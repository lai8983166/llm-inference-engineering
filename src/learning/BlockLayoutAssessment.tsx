import { useState } from 'react'

type FatalGap = 'ledger-missing-costs' | 'block-numbering' | 'paper-citation'

const reviewDimensions = [
  {
    id: 'segment-semantics',
    title: '分段语义：拆开存改变了什么？',
    placeholder: '从四条布局合同逐条检查离散分段。',
    rubric: '应指出映射、追加、在途读取权威、独立回收四条合同全部保住；段落边界不进入 Attention 计算，错表项才是正确性问题。',
  },
  {
    id: 'fixed-block-derivation',
    title: '固定块与浪费归因：为什么定长，浪费去了哪？',
    placeholder: '从空位匹配失败推导定长，再算内部浪费。',
    rubric: '变长分段让空位匹配重生碎片；定长使任何空位服务任何增长。内部浪费按请求封顶于 B−1：K-p 4 unit、K-q 5 unit、K-r 4 unit，都不是外部碎片。',
  },
  {
    id: 'block-table-translation',
    title: '块表翻译：用新配置复算账本',
    placeholder: '用 2 层 × 2(K,V) × 2 KV heads × 6 dim × 4 bytes 复算每 token 与每块，再翻译位置 8。',
    rubric: '每 token 192 bytes，每块 6 × 192 = 1152 bytes；位置 8 → 逻辑块 ⌊8/6⌋ = 1 → 查表项 1 → 块内偏移 2。表项数 K-p/K-q/K-r 完成态各 2 项。',
  },
  {
    id: 'admission-and-reclaim',
    title: '准入与回收：第三个请求为什么进不来？',
    placeholder: '按空闲块数判断，并说明释放顺序。',
    rubric: '三请求完成态各需 2 块，同时在场共 6 块 > 4 块的池：第三个请求被拒是空闲块数不足（有效容量），不是碎片；归还只能在读取结束后整块进行，取消同样只动自己的块。',
  },
  {
    id: 'evidence-boundary',
    title: '证据边界：这份报告最多能说什么？',
    placeholder: '区分教学计数、可复算事实与不能声称的结论。',
    rubric: '可以说 192 bytes/token、6 块池、表项与浪费计数；不能声称“快 60%”或任何真实耗时、带宽、OOM 行为——块大小取舍的真实成本必须实测。',
  },
  {
    id: 'open-questions',
    title: '待解问题：块池之后还缺什么？',
    placeholder: '列出准入调度、共享与 kernel 访问等未决问题。',
    rubric: '至少包括：最后一个空闲块给谁（准入/调度）、前缀共享时块所有权与写时复制、kernel 沿表访问的实测成本；不要求给出方案或引用具体框架数据结构。',
  },
] as const

export function BlockLayoutAssessment() {
  const [fatalGap, setFatalGap] = useState<FatalGap>()
  const [checked, setChecked] = useState(false)

  return (
    <section className="concurrency-assessment block-assessment" aria-labelledby="block-assessment-title">
      <p className="practice-kicker">TRANSFER REVIEW · NEW POOL CONFIG</p>
      <h2 id="block-assessment-title">用新块池验收布局账本</h2>
      <p>新的教学模型是 2 层、4 个 query heads、2 个 KV heads、head dim 6、每元素 4 bytes；块池为 4 块 × 6 token unit。请求 `K-p`（prompt 4 + 输出 4）、`K-q`（5 + 2）、`K-r`（6 + 2）先后来到。一份报告宣称：“块大小取最大就好，无所谓；三个请求各要 2 块，4 块的池随便放；块表不占什么内存；实测块池让生成快了 60%。”</p>

      <fieldset>
        <legend>先处理哪一个使结论无法成立的错误？</legend>
        <label><input type="radio" name="block-fatal-gap" checked={fatalGap === 'ledger-missing-costs'} onChange={() => { setFatalGap('ledger-missing-costs'); setChecked(false) }} />没有把表元数据与内部浪费入账，也没有核算三请求并发需要的块数</label>
        <label><input type="radio" name="block-fatal-gap" checked={fatalGap === 'block-numbering'} onChange={() => { setFatalGap('block-numbering'); setChecked(false) }} />没有说明块编号从 0 还是从 1 开始</label>
        <label><input type="radio" name="block-fatal-gap" checked={fatalGap === 'paper-citation'} onChange={() => { setFatalGap('paper-citation'); setChecked(false) }} />没有引用块池设计的原始论文</label>
      </fieldset>
      <button type="button" disabled={!fatalGap} onClick={() => setChecked(true)}>检查审查起点</button>
      {checked && <div className="assessment-feedback" role="status">
        <strong>{fatalGap === 'ledger-missing-costs' ? '账本先于一切结论' : '这不是当前结论的致命缺口'}</strong>
        <p>{fatalGap === 'ledger-missing-costs'
          ? '三请求完成态各需 2 块，同时在场共 6 块，已经超过 4 块的池；“随便放”从容量上就不成立。表项与内部浪费还各自占着真实空间。'
          : '编号惯例与引用完整性都不能修复账本缺项；在并发块数已经超出池容量时，任何补充说明都无法支持“随便放”。'}</p>
      </div>}

      <ol className="assessment-dimensions">
        {reviewDimensions.map((dimension, index) => <li key={dimension.id} data-dimension={dimension.id}>
          <label htmlFor={dimension.id}>{index + 1}. {dimension.title}</label>
          <textarea id={dimension.id} rows={4} placeholder={dimension.placeholder} />
          <details><summary>展开检查边界</summary><p>{dimension.rubric}</p></details>
        </li>)}
      </ol>
      <p>自由文本只保存在当前页面，不上传、不自动评分，也不产生掌握状态。展开标准用于检查推理边界，不代表页面已经替你完成诊断。</p>
    </section>
  )
}

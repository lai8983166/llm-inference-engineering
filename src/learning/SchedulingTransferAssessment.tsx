import { useState } from 'react'

type FatalGap = 'ticks-as-latency' | 'missing-paper' | 'missing-implementation'

const reviewDimensions = [
  {
    id: 'decision-point',
    title: '决定点：这份报告把什么当成了调度？',
    placeholder: '从执行边界与每拍决定开始检查报告的推理。',
    rubric: '应指出报告只统计了完成拍数，没有展示任何一拍的到达、准入与选择记录；静态对照与连续对照的决定点语义也没有分开。',
  },
  {
    id: 'runnable-contract',
    title: '可运行合同：`U-x` 的等待原因是什么？',
    placeholder: '用六项输入与原因分类检查每个等待中的请求。',
    rubric: '新配置里 `U-x`（4+3）prefill 需 2 块、`U-y`（2+2）需 1 块、`U-z`（5+1）需 2 块；4 块池下 t0 两个请求先准入即可占满，第三个的等待应归因等待块而不是“不公平”。',
  },
  {
    id: 'membership-rebuild',
    title: '成员重组：连续组织改变了什么、没改变什么？',
    placeholder: '对照封闭批次的批外等待与逐拍重组。',
    rubric: '逐拍重组消除的是批外等待与非活跃槽；它不消除等待本身——容量不足的等待依旧存在，只是原因被正确登记。',
  },
  {
    id: 'contention-tradeoff',
    title: '竞争权衡：换 prefill 优先“立刻解决”了吗？',
    placeholder: '推演两种策略下三个请求的首执行拍迁移。',
    rubric: 'prefill 优先让新请求更早首执行，但 decode 组会间歇让位、在跑请求完成拍后移；任何策略都只是迁移等待，不存在“立刻解决”。“40% 尾延迟改善”无法由拍数推出。',
  },
  {
    id: 'evidence-boundary',
    title: '证据边界：8 拍压到 6 拍最多能说明什么？',
    placeholder: '区分事件计数与时间结论。',
    rubric: '只能说明该规则下事件顺序与完成拍数变化；拍不是时间，不能换算成延迟或百分比。真实 TTFT、尾延迟与吞吐必须在固定负载与环境下测量。',
  },
  {
    id: 'open-questions',
    title: '待解问题：容量压力下这批请求会怎样？',
    placeholder: '把准入上限、公平性与抢占登记为下一步问题。',
    rubric: '等待块累积时需要回答拒绝、排队还是抢占、等待多久、谁先让位——这些是下一章的准入与公平性问题，本章的合同清单只定义了输入。',
  },
] as const

export function SchedulingTransferAssessment() {
  const [fatalGap, setFatalGap] = useState<FatalGap>()
  const [checked, setChecked] = useState(false)

  return (
    <section className="concurrency-assessment scheduling-assessment" aria-labelledby="scheduling-assessment-title">
      <p className="practice-kicker">TRANSFER REVIEW · NEW WORKLOAD</p>
      <h2 id="scheduling-assessment-title">用新工作量验收调度账本</h2>
      <p>新的工作量是 `U-x`（prompt 4 + 输出 3）、`U-y`（2 + 2）、`U-z`（5 + 1），块池 4 块 × 4 unit，策略 decode 优先。一份报告宣称：“改成连续调度后总拍数从 8 拍压到 6 拍，尾延迟改善了 40%；`U-z` 排在最后是调度器不公平，换 prefill 优先立刻解决。”</p>

      <fieldset>
        <legend>先处理哪一个使核心结论无法成立的错误？</legend>
        <label><input type="radio" name="scheduling-fatal-gap" checked={fatalGap === 'ticks-as-latency'} onChange={() => { setFatalGap('ticks-as-latency'); setChecked(false) }} />把拍数差换算成了延迟百分比：拍不是时间，40% 无从谈起</label>
        <label><input type="radio" name="scheduling-fatal-gap" checked={fatalGap === 'missing-paper'} onChange={() => { setFatalGap('missing-paper'); setChecked(false) }} />没有引用连续批处理的原始论文</label>
        <label><input type="radio" name="scheduling-fatal-gap" checked={fatalGap === 'missing-implementation'} onChange={() => { setFatalGap('missing-implementation'); setChecked(false) }} />没有实现一个真实调度器作对照</label>
      </fieldset>
      <button type="button" disabled={!fatalGap} onClick={() => setChecked(true)}>检查审查起点</button>
      {checked && <div className="assessment-feedback" role="status">
        <strong>{fatalGap === 'ticks-as-latency' ? '先把时间结论退回去' : '这不是当前结论的致命缺口'}</strong>
        <p>{fatalGap === 'ticks-as-latency'
          ? '拍是离散事件刻度：8 拍与 6 拍只说明事件顺序与完成拍变化，任何延迟、百分比或尾延迟结论都需要真实测量。'
          : '引用与实现都不能修复量纲错误；在时间结论本身不成立时，补充论据只会加强一个无效推断。'}</p>
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

import { useState } from 'react'

type FatalGap = 'recompute-is-free' | 'missing-implementation' | 'missing-paper'

const reviewDimensions = [
  {
    id: 'decision-point',
    title: '决定点：过载发生在哪一拍？',
    placeholder: '从到达与空闲块数字重建报告宣称的场景。',
    rubric: '新配置（`R-1` 6+3、`R-2` 5+2 同拍，`R-3` 5+2、`R-4` 4+1 随后，5 块池）下，应指出 t0 两请求即占 4 块、t1 空闲仅 1 块——过载从到达序列与块数即可复算，不需要等“感觉变慢”。',
  },
  {
    id: 'bearer-attribution',
    title: '承担者：每个裁决把成本寄给了谁？',
    placeholder: '逐个检查被拒、排队与被抢占的请求。',
    rubric: '`R-3`（需 2 块）在 t1 无论排队还是拒绝都不能当拍执行；拒绝寄给调用方、排队寄给等待者、抢占寄给被抢占者——三种裁决在同一数字上分岔。',
  },
  {
    id: 'preempt-order',
    title: '抢占与重算：顺序与成本是什么？',
    placeholder: '写出抢占、释放、重准入与重算 prefill 的完整顺序。',
    rubric: '顺序为到达裁决 → 抢占受害者 → 释放其块 → 新请求准入 → 受害者重排队 → 块恢复后重新 prefill（prompt + 已生成 token）。重算不是免费：`R-2` 若在生成 1 token 后被抢占，恢复要重算 6 个 token 的投影。',
  },
  {
    id: 'watermark-tradeoff',
    title: '水位：W=2 拒绝了谁、保护了谁？',
    placeholder: '用 free − need ≥ W 逐个裁决新到达。',
    rubric: 'W=2 下 t1 的 `R-3`（free 1、need 2）与 `R-4`（free 1、need 1）都被拒——水位保护的是在跑者的增长余量，代价是边界申请全部让路；这不是公平性结论。',
  },
  {
    id: 'evidence-boundary',
    title: '证据边界：“吞吐提升 30%”从哪来？',
    placeholder: '区分教学计数与测量结论。',
    rubric: '拍数、被拒数与重计算量是教学规则内的记账；任何百分比、尾延迟或吞吐结论都需要固定负载与环境的测量，且“重算不花钱”与“KV 已算过所以免费”相矛盾——被抢占者的 KV 已被丢弃。',
  },
  {
    id: 'open-questions',
    title: '待解问题：等待者消失时会发生什么？',
    placeholder: '把客户端放弃、超时与取消登记为下一章问题。',
    rubric: '排队与被抢占的请求若被客户端放弃，占用的等待位置、重算投入与未来准入机会都成为浪费；正常路径之外的服务语义（取消、超时、断开）是下一章入口。',
  },
] as const

export function OverloadTransferAssessment() {
  const [fatalGap, setFatalGap] = useState<FatalGap>()
  const [checked, setChecked] = useState(false)

  return (
    <section className="concurrency-assessment overload-assessment" aria-labelledby="overload-assessment-title">
      <p className="practice-kicker">TRANSFER REVIEW · NEW BURST</p>
      <h2 id="overload-assessment-title">用新突发验收过载账本</h2>
      <p>新的突发是 `R-1`（6+3）与 `R-2`（5+2）同拍到达、`R-3`（5+2）与 `R-4`（4+1）相继进场，块池 5 块 × 4 unit。一份报告宣称：“我们把水位调到 2 拒绝了晚到的申请，吞吐提升了 30%；被抢占的请求重算不花钱——KV 本来就算过一遍。”</p>

      <fieldset>
        <legend>先处理哪一个使核心结论无法成立的错误？</legend>
        <label><input type="radio" name="overload-fatal-gap" checked={fatalGap === 'recompute-is-free'} onChange={() => { setFatalGap('recompute-is-free'); setChecked(false) }} />“重算不花钱”与 KV 已被丢弃矛盾，且 30% 没有测量来源</label>
        <label><input type="radio" name="overload-fatal-gap" checked={fatalGap === 'missing-implementation'} onChange={() => { setFatalGap('missing-implementation'); setChecked(false) }} />没有实现一个真实准入控制器作对照</label>
        <label><input type="radio" name="overload-fatal-gap" checked={fatalGap === 'missing-paper'} onChange={() => { setFatalGap('missing-paper'); setChecked(false) }} />没有引用水位机制的原始论文</label>
      </fieldset>
      <button type="button" disabled={!fatalGap} onClick={() => setChecked(true)}>检查审查起点</button>
      {checked && <div className="assessment-feedback" role="status">
        <strong>{fatalGap === 'recompute-is-free' ? '先把成本账退回来' : '这不是当前结论的致命缺口'}</strong>
        <p>{fatalGap === 'recompute-is-free'
          ? '被抢占者的 KV 已被释放，恢复必须重新 prefill prompt 加已生成 token——这正是第 03 章重算路径的成本重现；而吞吐百分比需要固定负载与环境的测量，拍数计数推不出它。'
          : '实现与引用都不能修复成本与量纲错误；在“重算免费”与“30%”都无依据时，补充材料只会强化无效推断。'}</p>
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

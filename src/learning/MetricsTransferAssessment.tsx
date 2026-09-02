import { useState } from 'react'

type FatalGap = 'loop-and-goodput' | 'missing-paper' | 'missing-tool'

const reviewDimensions = [
  {
    id: 'definition-audit',
    title: '定义：两个报告的数字为什么对不上？',
    placeholder: '用事件对边界检查每处声称值。',
    rubric: '新工作量（`Q-1`/`Q-2` 同拍占满 5 块池、`Q-3` 排队 3 拍后准入）下，从准入起算的首 token 恒为 0，从到达起算是 3——报告未声明边界即不可比；间隔与端到端同理。',
  },
  {
    id: 'distribution-audit',
    title: '分布：只有均值的报告漏了什么？',
    placeholder: '重算 p50/p99 并对照 SLO。',
    rubric: '间隔池 [1,1,1,2,6] 均值 2.2、p99 6：SLO ≤4@p99 违约而“平均 ≤4”达标——均值与分位回答不同问题，缺分布的报告无法核承诺。',
  },
  {
    id: 'loop-audit',
    title: '环式：零排队证明了什么？',
    placeholder: '检查负载生成器的到达过程。',
    rubric: '串行闭环（下一请求等上一完成）下队列恒空——零排队是环式的性质不是服务的能力；宣称“永不过载”混淆了负载生成器与服务。开放环才能暴露池见底动态。',
  },
  {
    id: 'goodput-audit',
    title: '口径：吞吐等于 goodput 吗？',
    placeholder: '按终态原因分列完成。',
    rubric: '新窗口 8 个终态含 2 个超时 1 个取消：吞吐 8/窗口、goodput 5/窗口——把吞吐当 goodput 等于把失败记成功；排除清单必须按原因列出。',
  },
  {
    id: 'evidence-audit',
    title: '证据边界：这份报告最多能说什么？',
    placeholder: '区分教学计数与真实结论。',
    rubric: '拍数、队列深度与分位是教学规则内的记账，不能换算为真实延迟或“永不过载”的可靠性结论；真实结论需要固定负载与环境测量。',
  },
  {
    id: 'attribution-audit',
    title: '归因指向：下一步查哪一层？',
    placeholder: '把异常指标映射到排队/prefill/decode/终止。',
    rubric: '首 token 分位正常而间隔 p99 劣化指向 decode 路径；排队拍暴涨而服务侧正常指向上游容量——归因指向是入口，定位要进第 09 章的 profiler。',
  },
] as const

export function MetricsTransferAssessment() {
  const [fatalGap, setFatalGap] = useState<FatalGap>()
  const [checked, setChecked] = useState(false)

  return (
    <section className="concurrency-assessment metrics-assessment" aria-labelledby="metrics-assessment-title">
      <p className="practice-kicker">TRANSFER REVIEW · NEW LOAD</p>
      <h2 id="metrics-assessment-title">用新负载验收指标口径</h2>
      <p>新的评估用一份报告收尾：“我们用串行客户端压测，队列全程为零，证明服务永不过载；窗口内 8 个请求全部到达终态，吞吐 8，服务健康；平均间隔 2.2 拍，满足平均 ≤4 的目标。”</p>

      <fieldset>
        <legend>先处理哪一个使核心结论无法成立的错误？</legend>
        <label><input type="radio" name="metrics-fatal-gap" checked={fatalGap === 'loop-and-goodput'} onChange={() => { setFatalGap('loop-and-goodput'); setChecked(false) }} />闭环的零排队是负载生成器的性质不是服务能力，且吞吐 8 里含 3 个无效终态（当 goodput 是 5）</label>
        <label><input type="radio" name="metrics-fatal-gap" checked={fatalGap === 'missing-paper'} onChange={() => { setFatalGap('missing-paper'); setChecked(false) }} />没有引用分位数方法的原始论文</label>
        <label><input type="radio" name="metrics-fatal-gap" checked={fatalGap === 'missing-tool'} onChange={() => { setFatalGap('missing-tool'); setChecked(false) }} />没有实现一个真实压测器作对照</label>
      </fieldset>
      <button type="button" disabled={!fatalGap} onClick={() => setChecked(true)}>检查审查起点</button>
      {checked && <div className="assessment-feedback" role="status">
        <strong>{fatalGap === 'loop-and-goodput' ? '先把环式与口径分开' : '这不是当前结论的致命缺口'}</strong>
        <p>{fatalGap === 'loop-and-goodput'
          ? '串行客户端让请求等到空闲才到达——零排队测的是环式不是服务；8 个终态里 2 个超时 1 个取消，goodput 是 5 不是 8。两个错误叠加，“永不过载、服务健康”全都不成立。'
          : '引用与工具都不能修复环式误读与口径错误；在测量条件与分母都错时，补充材料只会强化无效推断。'}</p>
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

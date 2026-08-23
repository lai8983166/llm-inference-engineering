import { useState } from 'react'

type FatalGap = 'device-evidence' | 'queue-delay' | 'batch-shape'

const reviewDimensions = [
  {
    id: 'event-reconstruction',
    title: '重建事件：现有记录能确定什么顺序？',
    placeholder: '只使用到达、ready、host-submit、device-start/complete 与结束事件。',
    rubric: '应明确 Q-B 已到达且主机提交过，但记录中没有 Q-B 的 device-start/complete；不能把缺失事件补成想象中的执行。',
  },
  {
    id: 'causal-attribution',
    title: '区分因果：协程活跃和设备执行是什么关系？',
    placeholder: '说明主机交错支持什么判断，还缺少什么设备证据。',
    rubric: '两个 host-submit 只能证明主机侧提交发生；GPU 是否串行、重叠或将请求合批，需要 stream、设备边界和执行组成员记录。',
  },
  {
    id: 'request-invariants',
    title: '保护请求：Q-C 已结束后哪些合同必须独立收束？',
    placeholder: '检查终止原因、输出许可、在途工作和 KV 使用权。',
    rubric: 'Q-C 的结束原因和输出关闭不能等待同批最长请求；KV 只能在其在途读取安全结束后释放一次，也不能因槽位仍存在而无条件持有。',
  },
  {
    id: 'evidence-boundary',
    title: '限定结论：当前报告最多能说什么？',
    placeholder: '区分已观察事实、模拟/缺失证据和不能声称的性能结论。',
    rubric: '可以说主机提交发生交错、某个静态槽位仍被保留；不能声称 GPU kernel 并行、队头阻塞消失、利用率为 100% 或端到端性能提高。',
  },
  {
    id: 'next-selection',
    title: '形成下一问：下一次执行选择还需要哪些状态？',
    placeholder: '从可运行、phase、形状、在途与资源合同组织答案。',
    rubric: '至少需要每个请求是否 ready、prefill/decode phase、有效 token 形状、在途设备工作、终止状态和 KV 使用权；不要求写出或命名某种调度算法。',
  },
] as const

export function ConcurrencyAssessment() {
  const [fatalGap, setFatalGap] = useState<FatalGap>()
  const [checked, setChecked] = useState(false)

  return (
    <section className="concurrency-assessment" aria-labelledby="concurrency-assessment-title">
      <p className="practice-kicker">TRANSFER REVIEW · NEW WORKLOAD</p>
      <h2 id="concurrency-assessment-title">审查一份“并发已经解决”的报告</h2>
      <p>新报告记录了 Q-A 与 Q-B 的两个 `host-submit`，却只保留 Q-A 的 `device-start/complete`；另一静态批次中，Q-C 已结束但槽位和 KV 仍保留到最长请求完成。报告据此宣称：“两个协程让 kernel 并行，队头阻塞已经消失，batch 始终 100% 利用。”</p>

      <fieldset>
        <legend>先处理哪一个使核心结论无法成立的缺口？</legend>
        <label><input type="radio" name="concurrency-fatal-gap" checked={fatalGap === 'device-evidence'} onChange={() => { setFatalGap('device-evidence'); setChecked(false) }} />没有 Q-B 的设备开始/完成或执行组证据</label>
        <label><input type="radio" name="concurrency-fatal-gap" checked={fatalGap === 'queue-delay'} onChange={() => { setFatalGap('queue-delay'); setChecked(false) }} />没有把等待换算成延迟分位数</label>
        <label><input type="radio" name="concurrency-fatal-gap" checked={fatalGap === 'batch-shape'} onChange={() => { setFatalGap('batch-shape'); setChecked(false) }} />没有选择更大的静态 batch size</label>
      </fieldset>
      <button type="button" disabled={!fatalGap} onClick={() => setChecked(true)}>检查审查起点</button>
      {checked && <div className="assessment-feedback" role="status">
        <strong>{fatalGap === 'device-evidence' ? '先恢复设备因果链' : '这不能修复当前的并行结论'}</strong>
        <p>{fatalGap === 'device-evidence' ? 'host-submit 只能证明主机发出了工作；Q-B 是否开始、是否与 Q-A 重叠、是否进入同一执行组都没有证据。' : '在设备执行边界缺失时，补聚合指标或扩大 batch 都无法证明报告声称的 kernel 并行。'}</p>
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

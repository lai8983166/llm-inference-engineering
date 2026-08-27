import { useState } from 'react'
import {
  admissionAnswer,
  admissionSteps,
  assessAdmissionOrder,
  assessRejectionMeaning,
  overloadFirstRejection,
  overloadPracticeBlockCount,
  overloadPracticeTrace,
  type AdmissionStepId,
  type RejectionMeaning,
} from './overloadPractice'

const eventCopy: Record<string, string> = {
  arrived: 'arrived',
  admitted: 'admitted (blocks)',
  queued: 'queued (needed/free)',
  rejected: 'rejected (needed/free/W)',
  preempted: 'preempted (blocks, generated)',
  'prefill-executed': 'prefill → y1',
  'recompute-prefill': 'recompute-prefill (tokens)',
  'decode-executed': 'decode (group)',
  completed: 'completed',
  'blocks-acquired': 'blocks-acquired (+)',
  'blocks-released': 'blocks-released (-)',
}

export function OverloadLedgerPractice() {
  const [prediction, setPrediction] = useState<RejectionMeaning>()
  const [predictionLocked, setPredictionLocked] = useState(false)
  const [order, setOrder] = useState<AdmissionStepId[]>([])
  const [orderChecked, setOrderChecked] = useState(false)
  const rejection = overloadFirstRejection
  const predictionResult = predictionLocked ? assessRejectionMeaning(prediction) : undefined
  const orderResult = orderChecked ? assessAdmissionOrder(order) : undefined

  return (
    <section className="concurrency-practice overload-practice" aria-labelledby="overload-practice-title">
      <p className="practice-kicker">OVERLOAD LEDGER REVIEW · SIMULATED</p>
      <h2 id="overload-practice-title">先归因拒绝，再重建裁决</h2>
      <p>换一份没有解释的过载账本：三个新请求 `Q-1`、`Q-2` 同拍到达，`Q-3` 随后进场，块池只有 {overloadPracticeBlockCount} 块。先解释第一个被拒的请求说明什么，再不看正文重建一次准入裁决的合法顺序。</p>

      <table className="raw-trace-table" aria-label="待审查的模拟过载事件">
        <thead><tr><th>事件</th><th>拍</th><th>请求</th><th>原始记录</th></tr></thead>
        <tbody>
          {overloadPracticeTrace.events.map((event) => (
            <tr key={event.sequence}>
              <td>e{event.sequence}</td>
              <td>t{event.tick}</td>
              <td>{event.requestId}</td>
              <td><code>{event.requestId} {eventCopy[event.kind] ?? event.kind}{event.blocks !== undefined ? `=${event.blocks}` : ''}{event.neededBlocks !== undefined ? ` need=${event.neededBlocks}` : ''}{event.freeBlocks !== undefined ? ` free=${event.freeBlocks}` : ''}{event.recomputeTokens !== undefined ? ` tokens=${event.recomputeTokens}` : ''}</code></td>
            </tr>
          ))}
        </tbody>
      </table>

      <p>首个被拒的申请：`{rejection.requestId}` 在 t{rejection.tick} 需要 {rejection.neededBlocks} 个块，池中空闲 {rejection.freeBlocks} 个块（水位 {rejection.watermark}）；它已到达且输入就绪。判定只能依据账本里的数字，不能依据汇总百分比。</p>

      <fieldset className="audit-prediction" disabled={predictionLocked}>
        <legend>这个拒绝首先说明什么？</legend>
        <label>
          <input type="radio" name="overload-rejection-meaning" checked={prediction === 'caller-bears-cost'} onChange={() => { setPrediction('caller-bears-cost'); setPredictionLocked(false) }} />
          调用方承担过载成本：池内请求不被打扰，失败来得早——这是准入策略的服务承诺
        </label>
        <label>
          <input type="radio" name="overload-rejection-meaning" checked={prediction === 'selection-order'} onChange={() => { setPrediction('selection-order'); setPredictionLocked(false) }} />
          调度器选择了别人：这是选择顺序问题，调整排序这一拍就能执行
        </label>
        <label>
          <input type="radio" name="overload-rejection-meaning" checked={prediction === 'not-arrived'} onChange={() => { setPrediction('not-arrived'); setPredictionLocked(false) }} />
          它还没有到达：拒绝与容量、选择都无关
        </label>
      </fieldset>
      {!predictionLocked && (
        <button
          className="practice-primary"
          type="button"
          disabled={!prediction}
          onClick={() => setPredictionLocked(true)}
        >锁定归因，查看依据</button>
      )}

      {predictionResult && (
        <div className={`prediction-feedback ${predictionResult.correct ? 'is-correct' : ''}`} role="status">
          <strong>{predictionResult.correct ? '归因与账本一致' : '再回到账本：正确归因是“调用方承担成本”'}</strong>
          <p>
            t1 时 `Q-1`、`Q-2` 各持 2 块，空闲 0；`Q-3` 需要 2 块，free − need = −2，小于 0，按满拒绝。这不是选择顺序问题——无论怎么排序，拿不到块的请求这一拍都执行不了；也不是水位问题——水位为 0。拒绝把失败当场寄给调用方，换来 `Q-1`、`Q-2` 不被打扰并在 t3 全部完成。
          </p>
          <p className="practice-evidence-note">simulated · 非真实延迟证据</p>
        </div>
      )}

      <div className="kv-order-exercise" role="group" aria-label="重建准入裁决顺序">
        <h3>重建一次准入裁决的合法顺序</h3>
        <p>每个到达都要走完这条链：先弄清身份与输入，再算裁决数字，然后裁决、登记，最后交棒。顺序错了，等待与拒绝就无处登记。按发生的先后点击下面的步骤。</p>
        <ol className="kv-order-selected" aria-label="你排出的顺序">
          {admissionAnswer.map((_, position) => (
            <li key={position} data-position={position}>
              <b>第 {position + 1} 步</b>
              <span>{order[position]
                ? admissionSteps.find((step) => step.id === order[position])!.label
                : '待选'}</span>
            </li>
          ))}
        </ol>
        <div className="kv-order-options">
          {admissionSteps.map((step) => (
            <button
              key={step.id}
              type="button"
              disabled={order.includes(step.id) || order.length >= admissionAnswer.length}
              onClick={() => { setOrder((current) => [...current, step.id]); setOrderChecked(false) }}
            >{step.label}</button>
          ))}
        </div>
        <div className="kv-order-controls">
          <button className="practice-primary" type="button" disabled={order.length !== admissionAnswer.length} onClick={() => setOrderChecked(true)}>检查顺序</button>
          <button type="button" onClick={() => { setOrder([]); setOrderChecked(false) }}>清空重排</button>
        </div>
        {orderResult && (
          <div className={`audit-result ${orderResult.correct === orderResult.total ? 'is-correct' : ''}`} role="status">
            <strong>{orderResult.correct} / {orderResult.total} 个位置正确</strong>
            <ul>
              {orderResult.positions.map((position, index) => (
                <li key={index}>
                  <b>第 {index + 1} 步</b>
                  <span>{position.correct ? '顺序一致' : `应为：${admissionSteps.find((step) => step.id === position.expectedStep)!.label}`}</span>
                  <small>simulated · 非真实延迟证据</small>
                </li>
              ))}
            </ul>
            <p>先裁决后登记会让等待与拒绝从账本上消失；不交棒就执行，选择就没有输入。这些规则只属于本教学模型，不能证明真实调度器行为。</p>
          </div>
        )}
      </div>
      <p>你的选择与文本只存在于当前页面，不写入存储，也不形成掌握状态。</p>
    </section>
  )
}

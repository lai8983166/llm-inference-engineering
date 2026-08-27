import { useState } from 'react'
import {
  assessTickOrder,
  assessWaitingCause,
  scheduleFirstWaiting,
  schedulePracticeBlockCount,
  schedulePracticeTrace,
  tickOrderAnswer,
  tickOrderSteps,
  type TickOrderStepId,
  type WaitingCause,
} from './schedulePractice'

const eventCopy: Record<string, string> = {
  arrived: 'arrived',
  admitted: 'admitted (blocks)',
  'admission-waiting': 'admission-waiting (needed blocks)',
  'prefill-executed': 'prefill → y1',
  'decode-executed': 'decode (group size)',
  completed: 'completed',
  'blocks-acquired': 'blocks-acquired (+)',
  'blocks-released': 'blocks-released (-)',
}

export function TickLedgerPractice() {
  const [prediction, setPrediction] = useState<WaitingCause>()
  const [predictionLocked, setPredictionLocked] = useState(false)
  const [order, setOrder] = useState<TickOrderStepId[]>([])
  const [orderChecked, setOrderChecked] = useState(false)
  const failure = scheduleFirstWaiting
  const predictionResult = predictionLocked ? assessWaitingCause(prediction) : undefined
  const orderResult = orderChecked ? assessTickOrder(order) : undefined

  return (
    <section className="concurrency-practice tick-practice" aria-labelledby="tick-practice-title">
      <p className="practice-kicker">TICK LEDGER REVIEW · SIMULATED</p>
      <h2 id="tick-practice-title">先归因等待，再重建一拍</h2>
      <p>换一份没有解释的逐拍账本：三个新请求 `T-a`、`T-b`、`T-c` 走进一个 {schedulePracticeBlockCount} 块的小池，策略是新请求优先。先解释第一个等待中的请求为什么等待，再不看正文重建一拍的合法顺序。</p>

      <table className="raw-trace-table" aria-label="待审查的模拟逐拍事件">
        <thead><tr><th>事件</th><th>拍</th><th>请求</th><th>原始记录</th></tr></thead>
        <tbody>
          {schedulePracticeTrace.events.map((event) => (
            <tr key={event.sequence}>
              <td>e{event.sequence}</td>
              <td>t{event.tick}</td>
              <td>{event.requestId}</td>
              <td><code>{event.requestId} {eventCopy[event.kind] ?? event.kind}{event.blocks !== undefined ? `=${event.blocks}` : ''}{event.groupSize !== undefined ? `=${event.groupSize}` : ''}</code></td>
            </tr>
          ))}
        </tbody>
      </table>

      <p>首个等待中的请求：`{failure.requestId}` 在 t{failure.tick} 需要 {failure.neededBlocks} 个块，池中空闲 {failure.freeBlocks} 个块；它已到达且输入就绪。判定只能依据账本里的块数与事件，不能依据汇总百分比。</p>

      <fieldset className="audit-prediction" disabled={predictionLocked}>
        <legend>这个等待首先说明什么？</legend>
        <label>
          <input type="radio" name="tick-waiting-cause" checked={prediction === 'not-enough-blocks'} onChange={() => { setPrediction('not-enough-blocks'); setPredictionLocked(false) }} />
          空闲块不足：容量问题，选择顺序怎么改都轮不到它
        </label>
        <label>
          <input type="radio" name="tick-waiting-cause" checked={prediction === 'not-selected'} onChange={() => { setPrediction('not-selected'); setPredictionLocked(false) }} />
          调度器没有选中它：换一种策略这一拍就能执行
        </label>
        <label>
          <input type="radio" name="tick-waiting-cause" checked={prediction === 'not-arrived'} onChange={() => { setPrediction('not-arrived'); setPredictionLocked(false) }} />
          它还没有到达：等待与容量、选择都无关
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
          <strong>{predictionResult.correct ? '归因与账本一致' : '再回到账本：正确归因是“空闲块不足”'}</strong>
          <p>
            t0 时 `T-a` 准入并预扣 2 块，池只剩 1 块；`T-b` 同拍到达、同样需要 2 块，只能登记等待块。这与选择无关——无论策略怎么排，`T-b` 的 prefill 都要等有请求归还块；账本里它直到 t4 `T-a` 完成释放后才准入，正是这条容量约束的轨迹。顺带注意：t1 到达的 `T-c` 只需要 1 块，所以能先于 `T-b` 执行——先来后到让位于容量可行性。
          </p>
          <p className="practice-evidence-note">simulated · 非真实延迟证据</p>
        </div>
      )}

      <div className="kv-order-exercise" role="group" aria-label="重建一拍的合法顺序">
        <h3>重建一拍的合法顺序</h3>
        <p>一拍内事件必须按固定顺序发生：先弄清谁在场、谁够格，再决定给谁、执行什么，最后处理离开。按发生的先后点击下面的步骤。</p>
        <ol className="kv-order-selected" aria-label="你排出的顺序">
          {tickOrderAnswer.map((_, position) => (
            <li key={position} data-position={position}>
              <b>第 {position + 1} 步</b>
              <span>{order[position]
                ? tickOrderSteps.find((step) => step.id === order[position])!.label
                : '待选'}</span>
            </li>
          ))}
        </ol>
        <div className="kv-order-options">
          {tickOrderSteps.map((step) => (
            <button
              key={step.id}
              type="button"
              disabled={order.includes(step.id) || order.length >= tickOrderAnswer.length}
              onClick={() => { setOrder((current) => [...current, step.id]); setOrderChecked(false) }}
            >{step.label}</button>
          ))}
        </div>
        <div className="kv-order-controls">
          <button className="practice-primary" type="button" disabled={order.length !== tickOrderAnswer.length} onClick={() => setOrderChecked(true)}>检查顺序</button>
          <button type="button" onClick={() => { setOrder([]); setOrderChecked(false) }}>清空重排</button>
        </div>
        {orderResult && (
          <div className={`audit-result ${orderResult.correct === orderResult.total ? 'is-correct' : ''}`} role="status">
            <strong>{orderResult.correct} / {orderResult.total} 个位置正确</strong>
            <ul>
              {orderResult.positions.map((position, index) => (
                <li key={index}>
                  <b>第 {index + 1} 步</b>
                  <span>{position.correct ? '顺序一致' : `应为：${tickOrderSteps.find((step) => step.id === position.expectedStep)!.label}`}</span>
                  <small>simulated · 非真实延迟证据</small>
                </li>
              ))}
            </ul>
            <p>顺序不是风格问题：不重算可运行集合就会执行已完成的请求；完成者不当拍离开，后来的请求就要继承不存在的等待。这些规则只属于本教学模型，不能证明真实调度器行为。</p>
          </div>
        )}
      </div>
      <p>你的选择与文本只存在于当前页面，不写入存储，也不形成掌握状态。</p>
    </section>
  )
}

import { useState } from 'react'
import {
  assessCleanupOrder,
  assessDisconnectRelease,
  cleanupAnswer,
  cleanupSteps,
  terminationPracticeTrace,
  type CleanupStepId,
  type DisconnectRelease,
} from './terminationPractice'

const eventCopy: Record<string, string> = {
  arrived: 'arrived',
  admitted: 'admitted (blocks)',
  queued: 'queued',
  terminated: 'terminated (cause)',
  'blocks-released': 'blocks-released (-)',
  'left-queue': 'left-queue',
  'stream-closed': 'stream-closed',
  'prefill-executed': 'prefill → y1',
  'decode-executed': 'decode (group)',
  completed: 'completed',
  'blocks-acquired': 'blocks-acquired (+)',
}

const causeCopy: Record<string, string> = {
  eos: 'eos',
  length: '长度上限',
  'client-cancel': '客户端取消',
  timeout: '超时',
  disconnect: '断开',
  error: '失败',
}

export function TerminationLedgerPractice() {
  const [prediction, setPrediction] = useState<DisconnectRelease>()
  const [predictionLocked, setPredictionLocked] = useState(false)
  const [order, setOrder] = useState<CleanupStepId[]>([])
  const [orderChecked, setOrderChecked] = useState(false)
  const predictionResult = predictionLocked ? assessDisconnectRelease(prediction) : undefined
  const orderResult = orderChecked ? assessCleanupOrder(order) : undefined

  return (
    <section className="concurrency-practice termination-practice" aria-labelledby="termination-practice-title">
      <p className="practice-kicker">TERMINATION LEDGER REVIEW · SIMULATED</p>
      <h2 id="termination-practice-title">先判断释放了什么，再重建清理</h2>
      <p>换一份没有解释的终止账本：`D-1` 与 `D-2` 同拍到达占满 4 块小池，`D-3`、`D-4` 相继排队；t3 同时发生两次终止——`D-2` 的客户端断开（它正在生成），`D-3` 越过首执行期限（它正在排队）。先判断生成中断开释放了什么，再不看正文重建清理顺序。</p>

      <table className="raw-trace-table" aria-label="待审查的模拟终止事件">
        <thead><tr><th>事件</th><th>拍</th><th>请求</th><th>原始记录</th></tr></thead>
        <tbody>
          {terminationPracticeTrace.events.map((event) => (
            <tr key={event.sequence}>
              <td>e{event.sequence}</td>
              <td>t{event.tick}</td>
              <td>{event.requestId}</td>
              <td><code>{event.requestId} {eventCopy[event.kind] ?? event.kind}{event.blocks !== undefined ? `=${event.blocks}` : ''}{event.cause !== undefined ? `（${causeCopy[event.cause] ?? event.cause}）` : ''}</code></td>
            </tr>
          ))}
        </tbody>
      </table>

      <p>两个终态都发生在 t3：`D-2` 断开前已生成 2 个 token、持有 2 块；`D-3` 从未执行、正在排队。判定只能依据账本里的事件，不能依据汇总百分比。</p>

      <fieldset className="audit-prediction" disabled={predictionLocked}>
        <legend>生成中断开的 `D-2` 释放了什么？</legend>
        <label>
          <input type="radio" name="disconnect-release" checked={prediction === 'blocks-and-stream'} onChange={() => { setPrediction('blocks-and-stream'); setPredictionLocked(false) }} />
          2 个块与输出流——队列位置与它无关（它不在队）
        </label>
        <label>
          <input type="radio" name="disconnect-release" checked={prediction === 'stream-only'} onChange={() => { setPrediction('stream-only'); setPredictionLocked(false) }} />
          只有输出流——块要等当前 decode 组结束才能释放
        </label>
        <label>
          <input type="radio" name="disconnect-release" checked={prediction === 'nothing'} onChange={() => { setPrediction('nothing'); setPredictionLocked(false) }} />
          什么都没有——断开只影响客户端，服务端无从得知
        </label>
      </fieldset>
      {!predictionLocked && (
        <button
          className="practice-primary"
          type="button"
          disabled={!prediction}
          onClick={() => setPredictionLocked(true)}
        >锁定判断，查看依据</button>
      )}

      {predictionResult && (
        <div className={`prediction-feedback ${predictionResult.correct ? 'is-correct' : ''}`} role="status">
          <strong>{predictionResult.correct ? '判断与账本一致' : '再回到账本：正确答案是“2 个块与输出流”'}</strong>
          <p>
            账本 t3 显示 `D-2` 先 `blocks-released=2`、再 `stream-closed`、最后 `terminated（断开）`——生成者的块在终态当拍释放，不需要等任何 decode 组；t4 `D-1` 独自 decode 完成即可对照。而排队的 `D-3` 释放的是队列位置：`left-queue`、`stream-closed`、`terminated（超时）`，一个块都没有——两类终态走同一套清理，释放物由状态决定。顺带注意 t3 的 `D-4`：`D-2` 释放的 2 块让它当拍准入并完成 prefill。
          </p>
          <p className="practice-evidence-note">simulated · 非真实延迟或可靠性证据</p>
        </div>
      )}

      <div className="kv-order-exercise" role="group" aria-label="重建清理顺序">
        <h3>重建一次清理仪式</h3>
        <p>无论终态原因是什么，清理都按固定顺序走完。顺序错了，等待与释放就会从账本上消失或迟到。按发生的先后点击下面的步骤。</p>
        <ol className="kv-order-selected" aria-label="你排出的顺序">
          {cleanupAnswer.map((_, position) => (
            <li key={position} data-position={position}>
              <b>第 {position + 1} 步</b>
              <span>{order[position]
                ? cleanupSteps.find((step) => step.id === order[position])!.label
                : '待选'}</span>
            </li>
          ))}
        </ol>
        <div className="kv-order-options">
          {cleanupSteps.map((step) => (
            <button
              key={step.id}
              type="button"
              disabled={order.includes(step.id) || order.length >= cleanupAnswer.length}
              onClick={() => { setOrder((current) => [...current, step.id]); setOrderChecked(false) }}
            >{step.label}</button>
          ))}
        </div>
        <div className="kv-order-controls">
          <button className="practice-primary" type="button" disabled={order.length !== cleanupAnswer.length} onClick={() => setOrderChecked(true)}>检查顺序</button>
          <button type="button" onClick={() => { setOrder([]); setOrderChecked(false) }}>清空重排</button>
        </div>
        {orderResult && (
          <div className={`audit-result ${orderResult.correct === orderResult.total ? 'is-correct' : ''}`} role="status">
            <strong>{orderResult.correct} / {orderResult.total} 个位置正确</strong>
            <ul>
              {orderResult.positions.map((position, index) => (
                <li key={index}>
                  <b>第 {index + 1} 步</b>
                  <span>{position.correct ? '顺序一致' : `应为：${cleanupSteps.find((step) => step.id === position.expectedStep)!.label}`}</span>
                  <small>simulated · 非真实延迟或可靠性证据</small>
                </li>
              ))}
            </ul>
            <p>先关流后裁决会把“已送达保持送达”的边界弄丢；先记录终态再释放，校验器就会看到终态时仍持有块。这些顺序只属于本教学模型，不能证明真实引擎行为。</p>
          </div>
        )}
      </div>
      <p>你的选择与文本只存在于当前页面，不写入存储，也不形成掌握状态。</p>
    </section>
  )
}

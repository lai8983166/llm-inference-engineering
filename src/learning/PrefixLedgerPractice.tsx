import { useState } from 'react'
import {
  assessLifecycleOrder,
  assessSharedRelease,
  lifecycleAnswer,
  lifecycleSteps,
  practiceEventSummary,
  sharedBlockRelease,
  type LifecycleStepId,
  type SharedReleaseMeaning,
} from './prefixCachePractice'

const kindLabels: Record<string, string> = {
  arrived: 'arrived',
  admitted: 'admitted (blocks)',
  'prefix-hit': 'prefix-hit (hitTokens)',
  'prefix-miss': 'prefix-miss (created)',
  'prefill-executed': 'prefill',
  'decode-executed': 'decode',
  'blocks-acquired': 'blocks-acquired',
  completed: 'completed',
  'blocks-released': 'released (freed/decremented/cached)',
  'block-evicted': 'block-evicted',
}

export function PrefixLedgerPractice() {
  const [prediction, setPrediction] = useState<SharedReleaseMeaning>()
  const [predictionLocked, setPredictionLocked] = useState(false)
  const [order, setOrder] = useState<LifecycleStepId[]>([])
  const [orderChecked, setOrderChecked] = useState(false)
  const predictionResult = predictionLocked ? assessSharedRelease(prediction) : undefined
  const orderResult = orderChecked ? assessLifecycleOrder(order) : undefined

  return (
    <section className="concurrency-practice prefix-practice" aria-labelledby="prefix-practice-title">
      <p className="practice-kicker">PREFIX LEDGER REVIEW · SIMULATED</p>
      <h2 id="prefix-practice-title">先判断共享块的归宿，再重建生命周期</h2>
      <p>换一份新账本：`T-a`/`T-b` 共享一段 5-token 毛边前缀（只有 1 块对齐可共享），`T-c` 无共享。先判断 `T-b` 完成时那个共享块发生了什么，再不看正文重建共享块的完整生命周期。</p>

      <table className="raw-trace-table" aria-label="待审查的模拟缓存事件">
        <thead><tr><th>事件</th><th>拍</th><th>请求</th><th>原始记录</th></tr></thead>
        <tbody>
          {practiceEventSummary.map((event) => (
            <tr key={event.sequence}>
              <td>e{event.sequence}</td>
              <td>t{event.tick}</td>
              <td>{event.requestId}</td>
              <td><code>{event.requestId} {kindLabels[event.kind] ?? event.kind}{event.blocks ? ` B${event.blocks.join(',B')}` : ''}{event.hitTokens !== undefined ? ` (${event.hitTokens})` : ''}</code></td>
            </tr>
          ))}
        </tbody>
      </table>

      <p>`T-b` 在 t{sharedBlockRelease.tick} 完成，释放事件把块分成三组：归还 {[...sharedBlockRelease.freedBlocks]}、递减 {[...sharedBlockRelease.decrementedBlocks]}、转缓存 {[...sharedBlockRelease.cachedBlocks]}。判定只能依据账本，不能依据"完成即释放"的直觉。</p>

      <fieldset className="audit-prediction" disabled={predictionLocked}>
        <legend>`T-b` 完成时，那个共享块（rc=2）发生了什么？</legend>
        <label>
          <input type="radio" name="shared-release" checked={prediction === 'decrement-not-free'} onChange={() => { setPrediction('decrement-not-free'); setPredictionLocked(false) }} />
          只递减 rc 到 1：`T-a` 还在用，块不归还、不转缓存
        </label>
        <label>
          <input type="radio" name="shared-release" checked={prediction === 'free-immediately'} onChange={() => { setPrediction('free-immediately'); setPredictionLocked(false) }} />
          立即归还空闲池：无泄漏合同要求终态当拍块归零
        </label>
        <label>
          <input type="radio" name="shared-release" checked={prediction === 'nothing'} onChange={() => { setPrediction('nothing'); setPredictionLocked(false) }} />
          什么都不做：共享块的生命周期由缓存管理器另行决定
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
          <strong>{predictionResult.correct ? '判断与账本一致' : '再回到账本：正确答案是“只递减不归还”'}</strong>
          <p>
            释放事件把 `T-b` 的块分成两组：私有块进 freed 列表归还空闲池；共享块进 decremented 列表，rc 2→1。无泄漏合同没有失效——它按共享语义重写为"终态后零**独占**块、共享引用全部递减"。"立即归还"会让还在读它的 `T-a` 悬空，是正确性事故；转缓存只发生在 rc 归零的拍，这里 `T-a` 还活着。毛边也在账本里：5-token 前缀只共享 1 块，`T-b` 的私有块里装着第 5 个 token 和自己的输出。
          </p>
          <p className="practice-evidence-note">simulated · rc 与拍数是教学记账</p>
        </div>
      )}

      <div className="kv-order-exercise" role="group" aria-label="重建共享块生命周期">
        <h3>重建一次共享块的完整生命周期</h3>
        <p>从首算到逐出，每一步只改变一个所有权事实。按发生的先后点击重建。</p>
        <ol className="kv-order-selected" aria-label="你排出的顺序">
          {lifecycleAnswer.map((_, position) => (
            <li key={position} data-position={position}>
              <b>第 {position + 1} 步</b>
              <span>{order[position]
                ? lifecycleSteps.find((step) => step.id === order[position])!.label
                : '待选'}</span>
            </li>
          ))}
        </ol>
        <div className="kv-order-options">
          {lifecycleSteps.map((step) => (
            <button
              key={step.id}
              type="button"
              disabled={order.includes(step.id) || order.length >= lifecycleAnswer.length}
              onClick={() => { setOrder((current) => [...current, step.id]); setOrderChecked(false) }}
            >{step.label}</button>
          ))}
        </div>
        <div className="kv-order-controls">
          <button className="practice-primary" type="button" disabled={order.length !== lifecycleAnswer.length} onClick={() => setOrderChecked(true)}>检查顺序</button>
          <button type="button" onClick={() => { setOrder([]); setOrderChecked(false) }}>清空重排</button>
        </div>
        {orderResult && (
          <div className={`audit-result ${orderResult.correct === orderResult.total ? 'is-correct' : ''}`} role="status">
            <strong>{orderResult.correct} / {orderResult.total} 个位置正确</strong>
            <ul>
              {orderResult.positions.map((position, index) => (
                <li key={index}>
                  <b>第 {index + 1} 步</b>
                  <span>{position.correct ? '顺序一致' : `应为：${lifecycleSteps.find((step) => step.id === position.expectedStep)!.label}`}</span>
                  <small>simulated · 教学记账</small>
                </li>
              ))}
            </ul>
            <p>把“转缓存”放在“递减”之前会让 rc=1 的活跃块被逐出；把“逐出”放在“转缓存”之前违反“rc 大于 0 永不逐出”。顺序错了不是风格问题，是所有权事故。这条链属于本教学模型，不能证明真实框架行为。</p>
          </div>
        )}
      </div>
      <p>你的选择与文本只存在于当前页面，不写入存储，也不形成掌握状态。</p>
    </section>
  )
}

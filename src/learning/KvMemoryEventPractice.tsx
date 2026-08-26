import { useState } from 'react'
import {
  assessKvFailurePrediction,
  assessKvMigrationOrder,
  kvFailureCategoryLabels,
  kvFirstFailureQuestion,
  kvMigrationAnswer,
  kvMigrationSteps,
  kvPracticeTrace,
  type KvCapacityFailureCategory,
  type KvMigrationStepId,
} from './kvPractice'

const eventCopy: Record<string, string> = {
  arrived: 'arrived',
  reserved: 'reserved [start+capacity]',
  appended: 'append → cached tokens',
  'grew-in-place': 'grow-in-place → cached tokens',
  'migration-start': 'migration-start [new+prev]',
  'copy-complete': 'copy-complete [new+prev]',
  'address-published': 'address-publish [new+prev]',
  'read-complete': 'read-complete [address]',
  released: 'release [start+capacity]',
  rejected: 'reject (demand tokens)',
}

export function KvMemoryEventPractice() {
  const [prediction, setPrediction] = useState<KvCapacityFailureCategory>()
  const [predictionLocked, setPredictionLocked] = useState(false)
  const [order, setOrder] = useState<KvMigrationStepId[]>([])
  const [orderChecked, setOrderChecked] = useState(false)
  const failure = kvFirstFailureQuestion
  const predictionResult = predictionLocked ? assessKvFailurePrediction(prediction) : undefined
  const orderResult = orderChecked ? assessKvMigrationOrder(order) : undefined

  return (
    <section className="concurrency-practice kv-practice" aria-labelledby="kv-practice-title">
      <p className="practice-kicker">MEMORY EVENT REVIEW · SIMULATED</p>
      <h2 id="kv-practice-title">先归因失败，再重建顺序</h2>
      <p>换一份没有解释的原始事件：三个新请求 `P-a`、`P-b`、`P-c` 走进一个 16 token unit 的物理池，分配按各自声明的最大上下文一次预留。先判断第一个被拒绝的申请属于哪类容量失败，再不看正文重建一次合法的搬迁顺序。</p>

      <table className="raw-trace-table" aria-label="待审查的模拟内存事件">
        <thead><tr><th>事件</th><th>逻辑步</th><th>请求</th><th>原始记录</th></tr></thead>
        <tbody>
          {kvPracticeTrace.events.map((event) => (
            <tr key={event.sequence}>
              <td>e{event.sequence}</td>
              <td>t{event.logicalStep}</td>
              <td>{event.requestId}</td>
              <td><code>{event.requestId} {eventCopy[event.kind] ?? event.kind}{event.start !== undefined ? ` start=${event.start}` : ''}{event.tokens !== undefined ? ` tokens=${event.tokens}` : ''}</code></td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="raw-trace-table" aria-label="首个拒绝申请时刻的原始区间">
        <thead><tr><th>区间</th><th>归属</th><th>有效 token</th><th>保留未用</th></tr></thead>
        <tbody>
          {failure.pool.intervals.map((interval) => (
            <tr key={interval.start}>
              <td>[{interval.start}, {interval.start + interval.capacityTokens})</td>
              <td>{interval.owner === null ? '空闲' : interval.owner}{interval.role === 'migration-source' ? '（搬迁旧区间）' : ''}</td>
              <td>{interval.usedTokens}</td>
              <td>{interval.owner === null ? '—' : interval.capacityTokens - interval.usedTokens}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>首个被拒绝的申请：`{failure.requestId}` 在 t{failure.logicalStep} 申请 {failure.demandTokens} 个连续 unit。判定只能依据上面这些原始区间，不能依据总占用百分比。</p>

      <fieldset className="audit-prediction" disabled={predictionLocked}>
        <legend>这个失败首先属于哪一类？</legend>
        {(Object.keys(kvFailureCategoryLabels) as KvCapacityFailureCategory[]).map((category) => (
          <label key={category}>
            <input
              type="radio"
              name="kv-failure-prediction"
              checked={prediction === category}
              onChange={() => { setPrediction(category); setPredictionLocked(false) }}
            />
            {kvFailureCategoryLabels[category]}
          </label>
        ))}
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
          <strong>{predictionResult.correct ? '归因与区间一致' : `再回到区间：正确类别是“${kvFailureCategoryLabels[predictionResult.expected]}”`}</strong>
          <p>
            拒绝发生时，`P-a` 有效 5、保留未用 9，空闲 2。申请 9 个连续 unit 失败的直接原因是未用的预留占了 9 个 unit——释放它们即可满足申请，而有效占用加需求并未超出 16 unit 的池。这不是有效 KV 装满，也不是空闲总量不足。
          </p>
          <p className="practice-evidence-note">simulated · 非真实 GPU 显存证据</p>
        </div>
      )}

      <div className="kv-order-exercise" role="group" aria-label="重建搬迁顺序">
        <h3>重建一次合法的搬迁顺序</h3>
        <p>请求尾部被邻居占住时，增长要走完五个事件。按发生的先后点击下面的步骤；发布之前的任何一步失败，旧地址仍是权威状态。</p>
        <ol className="kv-order-selected" aria-label="你排出的顺序">
          {kvMigrationAnswer.map((_, position) => (
            <li key={position} data-position={position}>
              <b>第 {position + 1} 步</b>
              <span>{order[position]
                ? kvMigrationSteps.find((step) => step.id === order[position])!.label
                : '待选'}</span>
            </li>
          ))}
        </ol>
        <div className="kv-order-options">
          {kvMigrationSteps.map((step) => (
            <button
              key={step.id}
              type="button"
              disabled={order.includes(step.id) || order.length >= kvMigrationAnswer.length}
              onClick={() => { setOrder((current) => [...current, step.id]); setOrderChecked(false) }}
            >{step.label}</button>
          ))}
        </div>
        <div className="kv-order-controls">
          <button className="practice-primary" type="button" disabled={order.length !== kvMigrationAnswer.length} onClick={() => setOrderChecked(true)}>检查顺序</button>
          <button type="button" onClick={() => { setOrder([]); setOrderChecked(false) }}>清空重排</button>
        </div>
        {orderResult && (
          <div className={`audit-result ${orderResult.correct === orderResult.total ? 'is-correct' : ''}`} role="status">
            <strong>{orderResult.correct} / {orderResult.total} 个位置正确</strong>
            <ul>
              {orderResult.positions.map((position, index) => (
                <li key={index}>
                  <b>第 {index + 1} 步</b>
                  <span>{position.correct ? '顺序一致' : `应为：${kvMigrationSteps.find((step) => step.id === position.expectedStep)!.label}`}</span>
                  <small>simulated · 非真实 GPU 显存证据</small>
                </li>
              ))}
            </ul>
            <p>旧区间只能在地址发布且在途读取结束后释放；取消只改变本请求的流程，不能提前回收仍被读取的区间。这些顺序只属于本教学模型，不能证明真实分配器的行为。</p>
          </div>
        )}
      </div>
      <p>你的选择与文本只存在于当前页面，不写入存储，也不形成掌握状态。</p>
    </section>
  )
}

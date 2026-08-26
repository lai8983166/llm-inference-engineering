import { useState } from 'react'
import {
  assessBlockLifecycleOrder,
  assessBlockRejectionCause,
  blockFirstRejection,
  blockLifecycleAnswer,
  blockLifecycleSteps,
  blockPracticeFixture,
  blockPracticeTrace,
  type BlockLifecycleStepId,
  type BlockRejectionCause,
} from './blockPractice'

const eventCopy: Record<string, string> = {
  arrived: 'arrived',
  'block-allocated': 'block-allocated B#',
  'table-entry': 'table-entry B#',
  appended: 'append → cached tokens @B#',
  'read-complete': 'read-complete',
  'block-released': 'block-release B#',
  rejected: 'reject (demand tokens)',
}

export function BlockEventPractice() {
  const [prediction, setPrediction] = useState<BlockRejectionCause>()
  const [predictionLocked, setPredictionLocked] = useState(false)
  const [order, setOrder] = useState<BlockLifecycleStepId[]>([])
  const [orderChecked, setOrderChecked] = useState(false)
  const failure = blockFirstRejection
  const predictionResult = predictionLocked ? assessBlockRejectionCause(prediction) : undefined
  const orderResult = orderChecked ? assessBlockLifecycleOrder(order) : undefined

  return (
    <section className="concurrency-practice block-practice" aria-labelledby="block-practice-title">
      <p className="practice-kicker">BLOCK EVENT REVIEW · SIMULATED</p>
      <h2 id="block-practice-title">先归因拒绝，再重建顺序</h2>
      <p>换一份没有解释的原始事件：三个新请求 `Q-a`、`Q-b`、`Q-c` 走进一个 {blockPracticeFixture.blockCount} 块 × {blockPracticeFixture.blockSizeTokens} unit 的块池。先解释第一个被拒绝的申请，再不看正文重建一次合法的块生命周期顺序。</p>

      <table className="raw-trace-table" aria-label="待审查的模拟块池事件">
        <thead><tr><th>事件</th><th>逻辑步</th><th>请求</th><th>原始记录</th></tr></thead>
        <tbody>
          {blockPracticeTrace.events.map((event) => (
            <tr key={event.sequence}>
              <td>e{event.sequence}</td>
              <td>t{event.logicalStep}</td>
              <td>{event.requestId}</td>
              <td><code>{event.requestId} {eventCopy[event.kind] ?? event.kind}{event.block !== undefined ? `=${event.block}` : ''}{event.tokens !== undefined ? ` tokens=${event.tokens}` : ''}</code></td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="raw-trace-table" aria-label="首个拒绝申请时刻的块池状态">
        <thead><tr><th>块</th><th>归属</th><th>用量</th></tr></thead>
        <tbody>
          {failure.pool.blocks.map((lease) => (
            <tr key={lease.block}>
              <td>B{lease.block}</td>
              <td>{lease.owner === null ? '空闲' : lease.owner}</td>
              <td>{lease.usedTokens}/{blockPracticeFixture.blockSizeTokens}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>首个被拒绝的申请：`{failure.requestId}` 在 t{failure.logicalStep} 需要 {failure.demandedBlocks} 个块，池中空闲 {failure.freeBlocks} 个块。判定只能依据上面的块状态，不能依据汇总百分比。</p>

      <fieldset className="audit-prediction" disabled={predictionLocked}>
        <legend>这个拒绝首先说明什么？</legend>
        <label>
          <input type="radio" name="block-rejection-cause" checked={prediction === 'not-enough-blocks'} onChange={() => { setPrediction('not-enough-blocks'); setPredictionLocked(false) }} />
          空闲块数不足：3 unit 空闲即使全部连起来也小于 9，不是碎片
        </label>
        <label>
          <input type="radio" name="block-rejection-cause" checked={prediction === 'table-too-long'} onChange={() => { setPrediction('table-too-long'); setPredictionLocked(false) }} />
          块表太长，登记新表项的开销挤掉了空间
        </label>
        <label>
          <input type="radio" name="block-rejection-cause" checked={prediction === 'waste-too-large'} onChange={() => { setPrediction('waste-too-large'); setPredictionLocked(false) }} />
          内部浪费太大，把空闲块填满了
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
          <strong>{predictionResult.correct ? '归因与块状态一致' : '再回到块状态：正确归因是“空闲块数不足”'}</strong>
          <p>
            拒绝发生时，`Q-a` 持有 2 块（5 unit 有效、1 unit 内部浪费），`Q-b` 持有 1 块（3 unit 全满），空闲只剩 1 块共 3 unit。`Q-c` 的 prefill 需要 9 unit：把全部空闲连成一体也放不下，即使 `Q-a`、`Q-b` 立刻归还所有块，8 unit 有效 KV 加 9 unit 需求也超出 12 unit 的池——这不是“空位太碎”的碎片问题，块粒度并没有产生用不上的小空位；这是容量不足。顺带注意：`Q-a` 的 1 unit 浪费真实存在，但它不是本次拒绝的原因。
          </p>
          <p className="practice-evidence-note">simulated · 非真实显存证据</p>
        </div>
      )}

      <div className="kv-order-exercise" role="group" aria-label="重建块生命周期顺序">
        <h3>重建一次合法的块生命周期</h3>
        <p>当前块已满、请求仍要增长时，事件必须按固定顺序发生；登记晚于分配、写入晚于登记，整块归还只在读取结束之后。按发生的先后点击下面的步骤。</p>
        <ol className="kv-order-selected" aria-label="你排出的顺序">
          {blockLifecycleAnswer.map((_, position) => (
            <li key={position} data-position={position}>
              <b>第 {position + 1} 步</b>
              <span>{order[position]
                ? blockLifecycleSteps.find((step) => step.id === order[position])!.label
                : '待选'}</span>
            </li>
          ))}
        </ol>
        <div className="kv-order-options">
          {blockLifecycleSteps.map((step) => (
            <button
              key={step.id}
              type="button"
              disabled={order.includes(step.id) || order.length >= blockLifecycleAnswer.length}
              onClick={() => { setOrder((current) => [...current, step.id]); setOrderChecked(false) }}
            >{step.label}</button>
          ))}
        </div>
        <div className="kv-order-controls">
          <button className="practice-primary" type="button" disabled={order.length !== blockLifecycleAnswer.length} onClick={() => setOrderChecked(true)}>检查顺序</button>
          <button type="button" onClick={() => { setOrder([]); setOrderChecked(false) }}>清空重排</button>
        </div>
        {orderResult && (
          <div className={`audit-result ${orderResult.correct === orderResult.total ? 'is-correct' : ''}`} role="status">
            <strong>{orderResult.correct} / {orderResult.total} 个位置正确</strong>
            <ul>
              {orderResult.positions.map((position, index) => (
                <li key={index}>
                  <b>第 {index + 1} 步</b>
                  <span>{position.correct ? '顺序一致' : `应为：${blockLifecycleSteps.find((step) => step.id === position.expectedStep)!.label}`}</span>
                  <small>simulated · 非真实显存证据</small>
                </li>
              ))}
            </ul>
            <p>顺序错了不是风格问题：先登记后分配会留下悬空表项，先归还后读取完成会回收仍被读的块。这些规则只属于本教学模型，不能证明真实分配器行为。</p>
          </div>
        )}
      </div>
      <p>你的选择与文本只存在于当前页面，不写入存储，也不形成掌握状态。</p>
    </section>
  )
}

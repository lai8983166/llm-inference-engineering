import { useState } from 'react'
import {
  assessChainOrder,
  assessHiddenByDefinition,
  chainAnswer,
  chainSteps,
  metricsPracticeTrace,
  practiceReport,
  trueTtfts,
  type ChainStepId,
  type HiddenByDefinition,
} from './metricsPractice'

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

export function MetricsReportPractice() {
  const [prediction, setPrediction] = useState<HiddenByDefinition>()
  const [predictionLocked, setPredictionLocked] = useState(false)
  const [order, setOrder] = useState<ChainStepId[]>([])
  const [orderChecked, setOrderChecked] = useState(false)
  const predictionResult = predictionLocked ? assessHiddenByDefinition(prediction) : undefined
  const orderResult = orderChecked ? assessChainOrder(order) : undefined

  return (
    <section className="concurrency-practice metrics-practice" aria-labelledby="metrics-practice-title">
      <p className="practice-kicker">METRICS REPORT REVIEW · SIMULATED</p>
      <h2 id="metrics-practice-title">先找出藏起来的指标，再重建聚合链</h2>
      <p>换一份新的工作量与配套原始事件：`N-a`/`N-b` 同拍占满 4 块小池，`N-c`、`N-d` 相继排队。一份报告宣称：“首 token 全员 0 拍、平均 {practiceReport.claimedMean} 拍，服务无需改进。”先判断报告把什么藏在了指标之外，再不看正文重建聚合链。</p>

      <table className="raw-trace-table" aria-label="待审查的模拟原始事件">
        <thead><tr><th>事件</th><th>拍</th><th>请求</th><th>原始记录</th></tr></thead>
        <tbody>
          {metricsPracticeTrace.events.map((event) => (
            <tr key={event.sequence}>
              <td>e{event.sequence}</td>
              <td>t{event.tick}</td>
              <td>{event.requestId}</td>
              <td><code>{event.requestId} {eventCopy[event.kind] ?? event.kind}{event.blocks !== undefined ? `=${event.blocks}` : ''}</code></td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="raw-trace-table" aria-label="报告声称值与事件流真实值对照">
        <thead><tr><th>请求</th><th>报告首 token（拍）</th><th>事件流：排队 / 真实首 token</th></tr></thead>
        <tbody>
          {trueTtfts.map((row, index) => (
            <tr key={row.requestId}>
              <td>{row.requestId}</td>
              <td>{practiceReport.claimedTtfts[index].claimed}</td>
              <td>{row.queueTicks} / {row.ttftTicks}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <fieldset className="audit-prediction" disabled={predictionLocked}>
        <legend>报告的平均 0 拍把什么藏在了指标之外？</legend>
        <label>
          <input type="radio" name="metrics-hidden" checked={prediction === 'queue-hidden'} onChange={() => { setPrediction('queue-hidden'); setPredictionLocked(false) }} />
          排队拍：首 token 从准入起算，`N-c` 的 3 拍与 `N-d` 的 2 拍被排除在指标外
        </label>
        <label>
          <input type="radio" name="metrics-hidden" checked={prediction === 'token-count'} onChange={() => { setPrediction('token-count'); setPredictionLocked(false) }} />
          token 数：报告按生成 token 数而不是拍数统计
        </label>
        <label>
          <input type="radio" name="metrics-hidden" checked={prediction === 'invalid-completions'} onChange={() => { setPrediction('invalid-completions'); setPredictionLocked(false) }} />
          无效完成：被取消的请求被算进了平均
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
          <strong>{predictionResult.correct ? '判断与事件流一致' : '再回到事件流：藏起来的是排队拍'}</strong>
          <p>
            对照表里报告与事件流的两列逐行对不上：`N-c` 到达 t1、准入 t4、首输出 t4——从到达起算首 token 是 3 拍，从准入起算是 0 拍；报告用的是后者，于是 5 拍排队（`N-c` 3 拍、`N-d` 2 拍）整个消失了。两个数字都没算错，但只有钉死边界（首 token = 首个输出事件拍 − 到达拍）才可比；同一份事件流按钉死的定义重算，平均是 1.75 拍而不是 0 拍。
          </p>
          <p className="practice-evidence-note">simulated · 拍是事件刻度，不是时间</p>
        </div>
      )}

      <div className="kv-order-exercise" role="group" aria-label="重建聚合链">
        <h3>重建一次聚合链</h3>
        <p>报告之所以能藏住排队，是因为它跳过了链的前两步。按固定顺序点击重建：每一步只做一件小事，才能反向走回头路。</p>
        <ol className="kv-order-selected" aria-label="你排出的顺序">
          {chainAnswer.map((_, position) => (
            <li key={position} data-position={position}>
              <b>第 {position + 1} 步</b>
              <span>{order[position]
                ? chainSteps.find((step) => step.id === order[position])!.label
                : '待选'}</span>
            </li>
          ))}
        </ol>
        <div className="kv-order-options">
          {chainSteps.map((step) => (
            <button
              key={step.id}
              type="button"
              disabled={order.includes(step.id) || order.length >= chainAnswer.length}
              onClick={() => { setOrder((current) => [...current, step.id]); setOrderChecked(false) }}
            >{step.label}</button>
          ))}
        </div>
        <div className="kv-order-controls">
          <button className="practice-primary" type="button" disabled={order.length !== chainAnswer.length} onClick={() => setOrderChecked(true)}>检查顺序</button>
          <button type="button" onClick={() => { setOrder([]); setOrderChecked(false) }}>清空重排</button>
        </div>
        {orderResult && (
          <div className={`audit-result ${orderResult.correct === orderResult.total ? 'is-correct' : ''}`} role="status">
            <strong>{orderResult.correct} / {orderResult.total} 个位置正确</strong>
            <ul>
              {orderResult.positions.map((position, index) => (
                <li key={index}>
                  <b>第 {index + 1} 步</b>
                  <span>{position.correct ? '顺序一致' : `应为：${chainSteps.find((step) => step.id === position.expectedStep)!.label}`}</span>
                  <small>simulated · 拍是事件刻度</small>
                </li>
              ))}
            </ul>
            <p>没有原始事件，定义无从核对；没有分布，单个均值可以任意裁剪。这些顺序属于本教学模型，不能证明真实工具行为。</p>
          </div>
        )}
      </div>
      <p>你的选择与文本只存在于当前页面，不写入存储，也不形成掌握状态。</p>
    </section>
  )
}

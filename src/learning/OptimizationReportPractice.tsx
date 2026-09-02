import { useState } from 'react'
import {
  assessAttributionOrder,
  assessGainMissReason,
  attributionAnswer,
  attributionSteps,
  practiceReport,
  type AttributionStepId,
  type GainMissReason,
} from './optimizationPractice'
import { baselineDecodeBudget, bottleneckKinds, bottleneckLabels } from './bottleneckLedger'

export function OptimizationReportPractice() {
  const [prediction, setPrediction] = useState<GainMissReason>()
  const [predictionLocked, setPredictionLocked] = useState(false)
  const [order, setOrder] = useState<AttributionStepId[]>([])
  const [orderChecked, setOrderChecked] = useState(false)
  const predictionResult = predictionLocked ? assessGainMissReason(prediction) : undefined
  const orderResult = orderChecked ? assessAttributionOrder(order) : undefined
  const report = practiceReport.kernelReport

  return (
    <section className="concurrency-practice optimization-practice" aria-labelledby="optimization-practice-title">
      <p className="practice-kicker">OPTIMIZATION REPORT REVIEW · SIMULATED</p>
      <h2 id="optimization-practice-title">先归因落空的收益，再重建归因链</h2>
      <p>一份优化报告宣称：“{practiceReport.claim}。”报告附了两样证据：现场的预算分解，和优化前后的重复测量样本。先判断收益为什么没兑现，再不看正文重建归因链。</p>

      <table className="raw-trace-table" aria-label="报告附带的预算分解">
        <thead><tr><th>部件</th><th>预算</th><th>占比</th></tr></thead>
        <tbody>
          {bottleneckKinds.map((kind) => (
            <tr key={kind}>
              <td>{bottleneckLabels[kind]}</td>
              <td>{baselineDecodeBudget[kind]}</td>
              <td>{Math.round((baselineDecodeBudget[kind] / 20) * 100)}%</td>
            </tr>
          ))}
          <tr><td><strong>合计</strong></td><td><strong>20</strong></td><td><strong>100%</strong></td></tr>
        </tbody>
      </table>

      <table className="raw-trace-table" aria-label="报告附带的测量样本">
        <thead><tr><th>组</th><th>样本</th><th>均值</th><th>范围</th></tr></thead>
        <tbody>
          <tr>
            <td>优化前</td>
            <td>{practiceReport.samples.before.join(', ')}</td>
            <td>{practiceReport.samples.beforeMean}</td>
            <td>[{practiceReport.samples.beforeRange.join(', ')}]</td>
          </tr>
          <tr>
            <td>优化后</td>
            <td>{practiceReport.samples.after.join(', ')}</td>
            <td>{practiceReport.samples.afterMean}</td>
            <td>[{practiceReport.samples.afterRange.join(', ')}]</td>
          </tr>
        </tbody>
      </table>

      <p>报告声称“收益显著”。判定只能依据预算占比与样本范围，不能依据优化本身听起来多好。</p>

      <fieldset className="audit-prediction" disabled={predictionLocked}>
        <legend>这份收益声称为什么首先就不成立？</legend>
        <label>
          <input type="radio" name="gain-miss-reason" checked={prediction === 'share-too-small'} onChange={() => { setPrediction('share-too-small'); setPredictionLocked(false) }} />
          计算只占一成：kernel 减半的收益上限 ×1.05，“显著”在算术上不可能
        </label>
        <label>
          <input type="radio" name="gain-miss-reason" checked={prediction === 'noise-overlap'} onChange={() => { setPrediction('noise-overlap'); setPredictionLocked(false) }} />
          样本范围重叠：证据不支持——但若占比够大，优化本身可能仍有效
        </label>
        <label>
          <input type="radio" name="gain-miss-reason" checked={prediction === 'wrong-target'} onChange={() => { setPrediction('wrong-target'); setPredictionLocked(false) }} />
          目标选错：应该优化访存而不是计算
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
          <strong>{predictionResult.correct ? '归因与算术一致' : '再回到预算表：首要问题是占比'}</strong>
          <p>
            报告有双重问题，但首要的、决定性的一个是占比：计算部件只占预算的十分之一，上限 ×{report.targetCeiling.toFixed(2)}——把 kernel 优化到零也换不来“显著”。样本范围重叠（均值同为 {practiceReport.samples.beforeMean}）是第二重问题：即便占比可观，这组证据也不支持声称。目标错选（访存占三成更值得做）是对下一步的正确建议，但不是“这份声称”失败的首要原因。
          </p>
          <p className="practice-evidence-note">simulated · 预算单位与固定样本，不是真实测量</p>
        </div>
      )}

      <div className="kv-order-exercise" role="group" aria-label="重建归因链">
        <h3>重建一次归因链</h3>
        <p>从指标异常到确认或推翻，每一步只做一件小事——顺序错了，要么优化错对象，要么用噪声当证据。按固定顺序点击重建。</p>
        <ol className="kv-order-selected" aria-label="你排出的顺序">
          {attributionAnswer.map((_, position) => (
            <li key={position} data-position={position}>
              <b>第 {position + 1} 步</b>
              <span>{order[position]
                ? attributionSteps.find((step) => step.id === order[position])!.label
                : '待选'}</span>
            </li>
          ))}
        </ol>
        <div className="kv-order-options">
          {attributionSteps.map((step) => (
            <button
              key={step.id}
              type="button"
              disabled={order.includes(step.id) || order.length >= attributionAnswer.length}
              onClick={() => { setOrder((current) => [...current, step.id]); setOrderChecked(false) }}
            >{step.label}</button>
          ))}
        </div>
        <div className="kv-order-controls">
          <button className="practice-primary" type="button" disabled={order.length !== attributionAnswer.length} onClick={() => setOrderChecked(true)}>检查顺序</button>
          <button type="button" onClick={() => { setOrder([]); setOrderChecked(false) }}>清空重排</button>
        </div>
        {orderResult && (
          <div className={`audit-result ${orderResult.correct === orderResult.total ? 'is-correct' : ''}`} role="status">
            <strong>{orderResult.correct} / {orderResult.total} 个位置正确</strong>
            <ul>
              {orderResult.positions.map((position, index) => (
                <li key={index}>
                  <b>第 {index + 1} 步</b>
                  <span>{position.correct ? '顺序一致' : `应为：${attributionSteps.find((step) => step.id === position.expectedStep)!.label}`}</span>
                  <small>simulated · 归因链是教学合同</small>
                </li>
              ))}
            </ul>
            <p>没有预算先做优化是闭眼开药；没有上限先宣称收益是忽略硬顶；没有实验先发布结论是把噪声当证据。这条链属于本教学模型，不能证明真实工程流程。</p>
          </div>
        )}
      </div>
      <p>你的选择与文本只存在于当前页面，不写入存储，也不形成掌握状态。</p>
    </section>
  )
}

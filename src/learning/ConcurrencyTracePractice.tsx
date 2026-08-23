import { useState } from 'react'
import {
  assessTraceAudit,
  traceAuditEvents,
  type TraceAuditCategory,
} from './concurrencyTrace'

type Prediction = 'E0' | 'E1' | 'E2' | 'E3'

const categoryLabels: Record<TraceAuditCategory, string> = {
  'not-runnable': '尚不可运行',
  'ready-not-selected': '可运行但未被选择',
  'valid-device-work': '有效设备工作',
  'padding-or-inactive': 'padding / 非活跃占位',
}

export function ConcurrencyTracePractice() {
  const [prediction, setPrediction] = useState<Prediction>()
  const [predictionLocked, setPredictionLocked] = useState(false)
  const [selections, setSelections] = useState<Partial<Record<string, TraceAuditCategory>>>({})
  const [checked, setChecked] = useState(false)
  const assessment = checked ? assessTraceAudit(selections) : undefined

  const selectCategory = (eventId: string, category: TraceAuditCategory) => {
    setSelections((current) => ({ ...current, [eventId]: category }))
    setChecked(false)
  }

  return (
    <section className="concurrency-practice" aria-labelledby="concurrency-practice-title">
      <p className="practice-kicker">TRACE AUDIT · SIMULATED</p>
      <h2 id="concurrency-practice-title">先判断等待，再给事件命名</h2>
      <p>两张图已经替既定案例标好了状态。这里换一份没有解释的原始记录：先预测最早由执行组织造成的等待或占位，再逐条重建每个事件在说什么。</p>

      <table className="raw-trace-table" aria-label="待审查的模拟原始事件">
        <thead><tr><th>事件</th><th>逻辑步</th><th>请求</th><th>原始记录</th></tr></thead>
        <tbody>{traceAuditEvents.map((event) => <tr key={event.id}><td>{event.id}</td><td>t{event.logicalStep}</td><td>{event.requestId}</td><td><code>{event.observation}</code></td></tr>)}</tbody>
      </table>

      <fieldset className="audit-prediction" disabled={predictionLocked}>
        <legend>哪条是最早由执行组织造成的等待或占位？</legend>
        {traceAuditEvents.map((event) => <label key={event.id}><input type="radio" name="audit-prediction" checked={prediction === event.id} onChange={() => setPrediction(event.id as Prediction)} />{event.id} · t{event.logicalStep}</label>)}
      </fieldset>
      {!predictionLocked && <button className="practice-primary" type="button" disabled={!prediction} onClick={() => setPredictionLocked(true)}>锁定预测，开始归类</button>}

      {predictionLocked && <>
        <div className={`prediction-feedback ${prediction === 'E1' ? 'is-correct' : ''}`} role="status">
          <strong>{prediction === 'E1' ? '找到了首个策略等待' : '先区分“不能运行”和“没有被选”'}</strong>
          <p>E0 的输入尚未准备好；E1 的 Q-alpha 已经可运行，却因当前设备组选择了别的请求而等待。E2、E3 的占用发生得更晚。</p>
        </div>

        <div className="audit-classification" role="group" aria-label="逐条归类事件">
          {traceAuditEvents.map((event) => (
            <fieldset key={event.id}>
              <legend>{event.id} · {event.requestId}</legend>
              {Object.entries(categoryLabels).map(([category, label]) => <label key={category}><input type="radio" name={`category-${event.id}`} checked={selections[event.id] === category} onChange={() => selectCategory(event.id, category as TraceAuditCategory)} />{label}</label>)}
            </fieldset>
          ))}
        </div>
        <button className="practice-primary" type="button" disabled={Object.keys(selections).length !== traceAuditEvents.length} onClick={() => setChecked(true)}>检查事件归类</button>
      </>}

      {assessment && <div className={`audit-result ${assessment.correct === assessment.total ? 'is-correct' : ''}`} role="status">
        <strong>{assessment.correct} / {assessment.total} 条因果边界已重建</strong>
        <ul>{assessment.results.map((result) => <li key={result.eventId}><b>{result.eventId}</b><span>{result.correct ? '归类一致' : `应检查：${categoryLabels[result.expected]}`}</span><small>simulated · 非真实 GPU 性能证据</small></li>)}</ul>
        <p>这些判断只来自 simulated logical trace；它们不能证明真实 GPU 的执行重叠、利用率或性能收益。</p>
      </div>}
    </section>
  )
}

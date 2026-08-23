import { useMemo, useState } from 'react'
import { measureWindow, type BenchmarkEvent, type BenchmarkEventName, type BenchmarkRun } from './benchmarkEvidence'

type RecordMode = 'complete' | 'missing-completion'
type Prediction = 'submission-only' | 'device-covered' | 'uncertain'

const completeEvents: readonly BenchmarkEvent[] = [
  { runId: 'practice-run', observer: 'host', name: 'host-submit', timestampMs: 0 },
  { runId: 'practice-run', observer: 'host', name: 'host-return', timestampMs: 2 },
  { runId: 'practice-run', observer: 'device', name: 'device-start', timestampMs: 3 },
  { runId: 'practice-run', observer: 'device', name: 'device-complete', timestampMs: 50 },
  { runId: 'practice-run', observer: 'host', name: 'result-readable', timestampMs: 53 },
]

const eventCopy: Record<BenchmarkEventName, string> = {
  'client-start': '客户端开始请求',
  'server-received': '服务端接收请求',
  'host-submit': '主机提交工作',
  'host-return': '提交函数返回',
  'device-start': '设备开始执行',
  'device-complete': '设备完成执行',
  'result-readable': '主机可读取结果',
  'request-complete': '请求完成',
}

function makeRun(events: readonly BenchmarkEvent[]): BenchmarkRun {
  return {
    id: 'practice-run', implementation: 'candidate', sequence: 1, phase: 'warm', status: 'succeeded', evidence: 'simulated',
    workload: { taskId: 'timing-window-practice', inputTokens: 128, outputLimit: 32, producedOutputTokens: 32, concurrency: 1 },
    environment: { modelId: 'teaching-model', modelRevision: 'r1', hardwareId: 'simulated-device', softwareStack: 'event-replay' },
    events,
  }
}

export function TimingWindowPractice() {
  const [prediction, setPrediction] = useState<Prediction>()
  const [predictionLocked, setPredictionLocked] = useState(false)
  const [mode, setMode] = useState<RecordMode>('complete')
  const [startEvent, setStartEvent] = useState<BenchmarkEventName>('host-submit')
  const [endEvent, setEndEvent] = useState<BenchmarkEventName>('host-return')
  const [checked, setChecked] = useState(false)

  const events = useMemo(() => mode === 'complete'
    ? completeEvents
    : completeEvents.filter((event) => event.name !== 'device-complete'), [mode])
  const measurement = checked ? measureWindow(makeRun(events), {
    id: 'learner-device-window', observer: 'device', startEvent, endEvent,
  }) : undefined

  const changeMode = (nextMode: RecordMode) => {
    setMode(nextMode)
    setChecked(false)
  }

  return (
    <section className="timing-practice" aria-labelledby="timing-practice-title">
      <p className="practice-kicker">EVIDENCE RECONSTRUCTION · SIMULATED</p>
      <h2 id="timing-practice-title">自己定义一次完成</h2>
      <p>这不是让你照抄计时模板。先预测一段“提交前后读主机时钟”的代码实际覆盖了什么，再从原始事件中为“设备执行耗时”选择合法边界。</p>

      <fieldset className="prediction-fieldset" disabled={predictionLocked}>
        <legend>提交函数两侧测得 2 ms，它最可能说明什么？</legend>
        <label><input type="radio" name="timing-prediction" value="submission-only" checked={prediction === 'submission-only'} onChange={() => setPrediction('submission-only')} />只覆盖了主机提交路径</label>
        <label><input type="radio" name="timing-prediction" value="device-covered" checked={prediction === 'device-covered'} onChange={() => setPrediction('device-covered')} />已经覆盖设备完整执行</label>
        <label><input type="radio" name="timing-prediction" value="uncertain" checked={prediction === 'uncertain'} onChange={() => setPrediction('uncertain')} />仅凭函数名无法判断</label>
      </fieldset>
      {!predictionLocked && <button className="practice-primary" type="button" disabled={!prediction} onClick={() => setPredictionLocked(true)}>锁定预测，查看事件</button>}

      {predictionLocked && (
        <div className="timing-workbench">
          <div className={`prediction-feedback ${prediction === 'submission-only' ? 'is-correct' : ''}`}>
            <strong>{prediction === 'submission-only' ? '预测抓住了边界' : '先不要让函数名替事件作证'}</strong>
            <p>主机在 2 ms 返回，而设备到 3 ms 才开始。接下来要从设备自己的事件中重建区间。</p>
          </div>

          <div className="record-mode" role="group" aria-label="选择原始记录">
            <button type="button" aria-pressed={mode === 'complete'} onClick={() => changeMode('complete')}>完整记录</button>
            <button type="button" aria-pressed={mode === 'missing-completion'} onClick={() => changeMode('missing-completion')}>缺失完成事件</button>
          </div>

          <table aria-label="模拟原始事件">
            <thead><tr><th>记录</th><th>观察者</th><th>事件</th><th>单调时间</th></tr></thead>
            <tbody>{events.map((event, index) => <tr key={`${event.name}-${index}`}><td>E{completeEvents.findIndex((item) => item.name === event.name) + 1}</td><td>{event.observer}</td><td>{eventCopy[event.name]}</td><td>{event.timestampMs} ms</td></tr>)}</tbody>
          </table>

          <div className="window-builder">
            <label>设备窗口起点<select aria-label="设备窗口起点" value={startEvent} onChange={(event) => { setStartEvent(event.target.value as BenchmarkEventName); setChecked(false) }}>{completeEvents.map((item, index) => <option key={`start-${item.name}`} value={item.name}>E{index + 1} · {eventCopy[item.name]}</option>)}</select></label>
            <span aria-hidden="true">→</span>
            <label>设备窗口终点<select aria-label="设备窗口终点" value={endEvent} onChange={(event) => { setEndEvent(event.target.value as BenchmarkEventName); setChecked(false) }}>{completeEvents.map((item, index) => <option key={`end-${item.name}`} value={item.name}>E{index + 1} · {eventCopy[item.name]}</option>)}</select></label>
            <button type="button" onClick={() => setChecked(true)}>验证窗口</button>
          </div>

          {measurement && <div className={`window-feedback ${measurement.ok ? 'is-valid' : 'is-invalid'}`} role="status">
            {measurement.ok
              ? <><strong>{measurement.durationMs} ms</strong><p>窗口来自同一设备观察者；它验证事件差值，不证明真实 GPU 性能。</p></>
              : <><strong>拒绝计算</strong><p>{measurement.message} 当前记录不能生成貌似精确的设备耗时。</p></>}
            <small>证据来源：simulated event replay</small>
          </div>}
        </div>
      )}
    </section>
  )
}

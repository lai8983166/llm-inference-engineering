import { useMemo, useState } from 'react'
import { initialTraceState, runTrace, type TraceScenario } from './requestTrace'

type Prediction = 'y1' | 'y1-y2'

const scenarioLabels: Record<TraceScenario, string> = {
  'cancel-first': '取消先取得终止权',
  'send-first': 'y2 先越过发送提交点',
}

export function TracePractice() {
  const [scenario, setScenario] = useState<TraceScenario>('cancel-first')
  const [prediction, setPrediction] = useState<Prediction>()
  const [cursor, setCursor] = useState(0)
  const frames = useMemo(() => runTrace(scenario), [scenario])
  const current = cursor === 0 ? initialTraceState() : frames[cursor - 1].state
  const finished = cursor === frames.length
  const actual: Prediction = current.visibleTokens.length === 1 ? 'y1' : 'y1-y2'

  function chooseScenario(value: TraceScenario) {
    setScenario(value)
    setPrediction(undefined)
    setCursor(0)
  }

  return (
    <section className="trace-practice" aria-labelledby="trace-title">
      <h2 id="trace-title">推演一次取消</h2>
      <p>正文已经给出规则。这里不再讲新概念：选定一个精确顺序，先预测客户端最终看到什么，再逐事件找出判断第一次受到影响的位置。</p>

      <div className="trace-choices">
        <fieldset>
          <legend>哪个事件先取得顺序？</legend>
          {(Object.keys(scenarioLabels) as TraceScenario[]).map((value) => (
            <label key={value}>
              <input type="radio" name="scenario" checked={scenario === value} onChange={() => chooseScenario(value)} />
              {scenarioLabels[value]}
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend>预测客户端最后可见的 token</legend>
          <label><input type="radio" name="prediction" checked={prediction === 'y1'} onChange={() => { setPrediction('y1'); setCursor(0) }} />只有 y1</label>
          <label><input type="radio" name="prediction" checked={prediction === 'y1-y2'} onChange={() => { setPrediction('y1-y2'); setCursor(0) }} />y1 和 y2</label>
        </fieldset>
      </div>

      <button type="button" disabled={!prediction || finished} onClick={() => setCursor((value) => Math.min(value + 1, frames.length))}>
        {cursor === 0 ? '核对第一个事件' : finished ? '轨迹已结束' : '推进下一个事件'}
      </button>

      <div className="trace-workbench">
        <dl className="trace-state" aria-label="当前请求状态">
          <div><dt>可见输出</dt><dd>{current.visibleTokens.join(', ')}</dd></div>
          <div><dt>终止原因</dt><dd>{current.terminalReason ?? '尚未终止'}</dd></div>
          <div><dt>设备工作</dt><dd>{current.inFlight ? '仍在执行' : '已到安全点'}</dd></div>
          <div><dt>KV / 输出流</dt><dd>{current.kv} / {current.stream}</dd></div>
        </dl>

        <ol className="trace-events" aria-live="polite">
          {cursor === 0
            ? <li className="trace-placeholder">提交预测后，从第一个原子事件开始。</li>
            : frames.slice(0, cursor).map((frame) => <li key={frame.event}><code>{frame.event}</code><span>{frame.explanation}</span></li>)}
        </ol>
      </div>

      {finished && prediction && (
        <p className="trace-feedback">
          {prediction === actual
            ? `预测与事件顺序一致：客户端最终看见 ${actual === 'y1' ? 'y1' : 'y1 和 y2'}。请再解释为什么 KV 都只能在最后释放。`
            : scenario === 'cancel-first'
              ? '第一处分歧在 cancel：终止权先被登记，随后完成的 decode 结果不能重新取得输出许可。'
              : '第一处分歧在 emit-y2：发送先越过提交点，后到的取消可以阻止未来输出，却不能撤回 y2。'}
        </p>
      )}
    </section>
  )
}

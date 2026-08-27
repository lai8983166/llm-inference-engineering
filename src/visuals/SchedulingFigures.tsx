import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { buildStrategyTrace } from '@/learning/concurrencyTrace'
import {
  buildScheduleTrace,
  scheduleOutcome,
  type SchedulePolicy,
  type RunnableState,
} from '@/learning/scheduleTrace'

function reducedMotionPreferred() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function useSteppedPlayback(maxIndex: number) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(() => !reducedMotionPreferred())

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => setIndex((current) => (current >= maxIndex ? 0 : current + 1)), 1600)
    return () => window.clearInterval(timer)
  }, [maxIndex, playing])

  return {
    index,
    playing,
    toggle: () => setPlaying((value) => !value),
    previous: () => { setIndex((current) => Math.max(0, current - 1)); setPlaying(false) },
    next: () => { setIndex((current) => Math.min(maxIndex, current + 1)); setPlaying(false) },
    reset: () => { setIndex(0); setPlaying(false) },
    select: (value: number) => { setIndex(value); setPlaying(false) },
  }
}

const runnableStateLabels: Record<RunnableState, string> = {
  'not-arrived': '未到达',
  'waiting-prefill': '待 prefill',
  'waiting-blocks': '等待块',
  runnable: '可运行',
  finished: '已完成',
}

const policyCopy: Record<SchedulePolicy, { label: string; detail: string }> = {
  'prefill-priority': {
    label: 'prefill 优先',
    detail: '新请求的 prefill 先于 decode 组：晚到者尽快开始，在跑请求让位。',
  },
  'decode-priority': {
    label: 'decode 优先',
    detail: 'decode 组先于等待中的 prefill：在跑请求尽快推进，新请求排队。',
  },
}

/** 逐拍账本：到达/准入行、请求状态芯片、本拍选择与待 prefill 队列，全部来自轨迹。 */
export function RunnableSetFigure() {
  const [policy, setPolicy] = useState<SchedulePolicy>('prefill-priority')
  const trace = useMemo(() => buildScheduleTrace(policy), [policy])
  const playback = useSteppedPlayback(trace.ticks.length - 1)
  const tickSnapshot = trace.ticks[playback.index]
  const arrivalEvents = trace.events.filter((event) =>
    event.tick === playback.index && (event.kind === 'arrived' || event.kind === 'admitted' || event.kind === 'admission-waiting'))
  const chosenLabel = tickSnapshot.chosen
    ? `${tickSnapshot.chosen.kind === 'prefill' ? 'prefill' : 'decode 组'} {${tickSnapshot.chosen.members.map((member) => member.requestId).join(' + ')}}`
    : '无（本拍没有可执行工作）'

  const selectPolicy = (value: SchedulePolicy) => {
    setPolicy(value)
    playback.reset()
  }

  return (
    <figure className="concurrency-figure runnable-set-figure" aria-labelledby="runnable-set-caption">
      <header className="concurrency-figure-header">
        <div><span>RUNNABLE SET · 05</span><strong>可运行集合怎样每拍重组</strong></div>
        <div className="concurrency-toolbar">
          <div role="group" aria-label="选择调度策略" className="strategy-switch">
            <button type="button" aria-pressed={policy === 'prefill-priority'} onClick={() => selectPolicy('prefill-priority')}>prefill 优先</button>
            <button type="button" aria-pressed={policy === 'decode-priority'} onClick={() => selectPolicy('decode-priority')}>decode 优先</button>
          </div>
          <div role="group" aria-label="控制逻辑拍" className="step-controls">
            <button type="button" onClick={playback.toggle}>{playback.playing ? '暂停动画' : '继续动画'}</button>
            <button type="button" onClick={playback.previous} disabled={playback.index === 0}>上一步</button>
            <button type="button" onClick={playback.next} disabled={playback.index === trace.ticks.length - 1}>下一步</button>
            <button type="button" onClick={playback.reset}>重置</button>
          </div>
        </div>
      </header>
      <div className="runnable-set-workbench">
        <ol className="logical-step-axis runnable-tick-axis" aria-label="选择逻辑拍">
          {trace.ticks.map((item) => (
            <li key={item.tick} className={item.tick < playback.index ? 'is-past' : ''}>
              <button type="button" aria-current={item.tick === playback.index ? 'step' : undefined} onClick={() => playback.select(item.tick)}>t{item.tick}</button>
            </li>
          ))}
        </ol>
        <div className="arrival-ledger" aria-label="本拍到达与准入">
          <strong>本拍到达 / 准入</strong>
          {arrivalEvents.length === 0
            ? <p>本拍没有新的到达或准入事件。</p>
            : <ul>{arrivalEvents.map((event) => (
              <li key={event.sequence}>
                <b>{event.requestId}</b>
                <span>{event.kind === 'arrived' ? '到达'
                  : event.kind === 'admitted' ? `准入通过，预扣 ${event.blocks} 块`
                  : `等待块：需要 ${event.blocks} 块，空闲不足`}</span>
              </li>
            ))}</ul>}
        </div>
        <div className="runnable-chips" data-request-count={trace.requests.length} aria-label="本拍可运行集合">
          {tickSnapshot.runnable.map((item) => (
            <div key={item.requestId} className={`runnable-chip state-${item.state}${item.state === 'runnable' ? ' is-runnable' : ''}`}>
              <b>{item.requestId}</b>
              <span>{runnableStateLabels[item.state]}</span>
              <small>{item.state === 'not-arrived' ? '—' : `${item.cachedTokens} token · ${item.heldBlocks} 块`}</small>
            </div>
          ))}
        </div>
        <div className="trace-readout runnable-set-readout" aria-live="polite">
          <span>t{playback.index}</span>
          <strong>{policyCopy[policy].label}</strong>
          <p>{policyCopy[policy].detail}</p>
          <dl>
            <div><dt>本拍选择</dt><dd>{chosenLabel}</dd></div>
            <div><dt>可运行</dt><dd>{tickSnapshot.runnable.filter((item) => item.state === 'runnable').length} 个</dd></div>
            <div><dt>待 prefill</dt><dd>{tickSnapshot.pendingPrefills.length > 0 ? tickSnapshot.pendingPrefills.join('、') : '无'}</dd></div>
            <div><dt>等待块</dt><dd>{tickSnapshot.runnable.filter((item) => item.state === 'waiting-blocks').length} 个</dd></div>
          </dl>
        </div>
      </div>
      <figcaption id="runnable-set-caption">状态芯片与选择全部来自 simulated 调度轨迹；“等待块”与“待 prefill”是不同原因，前者缺容量、后者缺执行机会。拍是离散事件刻度，不是时间。</figcaption>
    </figure>
  )
}

type TimelineMode = 'closed-batch' | 'prefill-priority' | 'decode-priority'

const timelineCopy: Record<TimelineMode, { label: string; detail: string }> = {
  'closed-batch': {
    label: '封闭批次',
    detail: '第 02 章静态 batch：成员在成批时冻结，晚到者在批外等待整批结束。',
  },
  'prefill-priority': {
    label: 'prefill 优先',
    detail: '每拍重组可运行集合，新请求的 prefill 优先；晚到者尽快开始，在跑请求让位。',
  },
  'decode-priority': {
    label: 'decode 优先',
    detail: '每拍重组可运行集合，decode 组优先；在跑请求尽快推进，新请求排队。',
  }
}

interface TimelineRow {
  requestId: string
  arrivalTick: number
  firstExecutionTick: number
  completionTick: number
}

/** 同一份请求工作量在三种执行组织下的生命周期泳道。 */
export function PolicyTimelineFigure() {
  const [mode, setMode] = useState<TimelineMode>('closed-batch')
  const closedBatch = useMemo(() => buildStrategyTrace('static-batch'), [])
  const prefillTrace = useMemo(() => buildScheduleTrace('prefill-priority'), [])
  const decodeTrace = useMemo(() => buildScheduleTrace('decode-priority'), [])

  const rowsAndTicks = useMemo((): { rows: TimelineRow[]; totalTicks: number } => {
    if (mode === 'closed-batch') {
      const rows = closedBatch.requests.map((request) => {
        const events = closedBatch.events.filter((event) => event.requestId === request.id)
        return {
          requestId: request.id,
          arrivalTick: request.arrivalStep,
          firstExecutionTick: events.find((event) => event.kind === 'device-start')?.logicalStep ?? 0,
          completionTick: events.find((event) => event.kind === 'request-complete')?.logicalStep ?? 0,
        }
      })
      return { rows, totalTicks: Math.max(...closedBatch.events.map((event) => event.logicalStep)) + 1 }
    }
    const trace = mode === 'prefill-priority' ? prefillTrace : decodeTrace
    const outcome = scheduleOutcome(trace)
    return {
      rows: trace.requests.map((request) => ({
        requestId: request.id,
        arrivalTick: request.arrivalStep,
        firstExecutionTick: outcome.find((item) => item.requestId === request.id)!.firstExecutionTick,
        completionTick: outcome.find((item) => item.requestId === request.id)!.completionTick,
      })),
      totalTicks: trace.ticks.length,
    }
  }, [mode, closedBatch, prefillTrace, decodeTrace])

  const playback = useSteppedPlayback(rowsAndTicks.totalTicks - 1)
  const currentTick = playback.index

  const selectMode = (value: TimelineMode) => {
    setMode(value)
    playback.reset()
  }

  return (
    <figure className="concurrency-figure policy-timeline-figure" aria-labelledby="policy-timeline-caption">
      <header className="concurrency-figure-header">
        <div><span>TIMELINE COMPARISON · 05</span><strong>同一份工作量的三种时间线</strong></div>
        <div className="concurrency-toolbar">
          <div role="group" aria-label="选择执行组织" className="strategy-switch">
            <button type="button" aria-pressed={mode === 'closed-batch'} onClick={() => selectMode('closed-batch')}>封闭批次</button>
            <button type="button" aria-pressed={mode === 'prefill-priority'} onClick={() => selectMode('prefill-priority')}>prefill 优先</button>
            <button type="button" aria-pressed={mode === 'decode-priority'} onClick={() => selectMode('decode-priority')}>decode 优先</button>
          </div>
          <div role="group" aria-label="控制观察拍" className="step-controls">
            <button type="button" onClick={playback.toggle}>{playback.playing ? '暂停动画' : '继续动画'}</button>
            <button type="button" onClick={playback.previous} disabled={playback.index === 0}>上一步</button>
            <button type="button" onClick={playback.next} disabled={playback.index >= rowsAndTicks.totalTicks - 1}>下一步</button>
            <button type="button" onClick={playback.reset}>重置</button>
          </div>
        </div>
      </header>
      <div className="policy-timeline-workbench">
        <div className="timeline-bands" style={{ '--timeline-columns': rowsAndTicks.totalTicks } as CSSProperties}>
          <span className="timeline-corner">请求</span>
          {Array.from({ length: rowsAndTicks.totalTicks }, (_, tick) => (
            <button type="button" key={`head-${tick}`} aria-current={tick === currentTick ? 'step' : undefined} onClick={() => playback.select(tick)}>t{tick}</button>
          ))}
          {rowsAndTicks.rows.map((row) => (
            <div className="timeline-row" key={row.requestId}>
              <strong>{row.requestId}</strong>
              {Array.from({ length: rowsAndTicks.totalTicks }, (_, tick) => {
                const phase = tick < row.arrivalTick ? 'not-arrived'
                  : tick < row.firstExecutionTick ? 'waiting'
                  : tick <= row.completionTick ? (tick === row.completionTick ? 'completing' : 'generating')
                  : 'done'
                return <span key={tick} data-phase={phase} className={tick === currentTick ? 'is-current' : ''}>{phase === 'waiting' ? '等' : phase === 'generating' ? '生' : phase === 'completing' ? '完' : ''}</span>
              })}
            </div>
          ))}
        </div>
        <div className="timeline-legend" aria-label="泳道图例">
          <span><i data-phase="waiting" />等待首执行（等）</span>
          <span><i data-phase="generating" />生成中（生）</span>
          <span><i data-phase="completing" />完成拍（完）</span>
          <span><i data-phase="not-arrived" />未到达</span>
        </div>
        <div className="trace-readout policy-timeline-readout" aria-live="polite">
          <span>t{currentTick}</span>
          <strong>{timelineCopy[mode].label}</strong>
          <p>{timelineCopy[mode].detail}</p>
          <dl>
            {rowsAndTicks.rows.map((row) => (
              <div key={row.requestId}><dt>{row.requestId}</dt>
                <dd>首执行 t{row.firstExecutionTick} · 完成 t{row.completionTick}</dd></div>
            ))}
            <div><dt>总拍数</dt><dd>{rowsAndTicks.totalTicks}</dd></div>
          </dl>
        </div>
      </div>
      <figcaption id="policy-timeline-caption">三种组织使用同一请求工作量与同一块池，泳道全部来自 simulated 轨迹。拍数与等待只是事件计数——比较的是谁在等，不是谁更快；真实延迟与吞吐必须测量。</figcaption>
    </figure>
  )
}

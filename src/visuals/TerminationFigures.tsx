import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  buildTerminationTrace,
  terminationOutcome,
  type TerminationCause,
} from '@/learning/terminationTrace'

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

const causeLabels: Record<TerminationCause, string> = {
  eos: 'eos',
  length: '长度',
  'client-cancel': '取消',
  timeout: '超时',
  disconnect: '断开',
  error: '失败',
}

/** 六条终点、同一次清理：生命周期泳道 + 终态原因编码 + 终点清理对勾。 */
export function TerminalCoverageFigure() {
  const trace = useMemo(() => buildTerminationTrace(), [])
  const outcomes = useMemo(() => terminationOutcome(trace), [trace])
  const playback = useSteppedPlayback(trace.ticks.length - 1)
  const tick = playback.index

  return (
    <figure className="concurrency-figure terminal-coverage-figure" aria-labelledby="terminal-coverage-caption">
      <header className="concurrency-figure-header">
        <div><span>TERMINAL COVERAGE · 07</span><strong>六条终点，同一次清理</strong></div>
        <div className="concurrency-toolbar">
          <div role="group" aria-label="控制观察拍" className="step-controls">
            <button type="button" onClick={playback.toggle}>{playback.playing ? '暂停动画' : '继续动画'}</button>
            <button type="button" onClick={playback.previous} disabled={tick === 0}>上一步</button>
            <button type="button" onClick={playback.next} disabled={tick >= trace.ticks.length - 1}>下一步</button>
            <button type="button" onClick={playback.reset}>重置</button>
          </div>
        </div>
      </header>
      <div className="terminal-coverage-workbench">
        <div className="terminal-bands" style={{ '--terminal-columns': trace.ticks.length } as CSSProperties}>
          <span className="timeline-corner">请求</span>
          {trace.ticks.map((item) => (
            <button type="button" key={`head-${item.tick}`} aria-current={item.tick === tick ? 'step' : undefined} onClick={() => playback.select(item.tick)}>t{item.tick}</button>
          ))}
          {trace.requests.map((request) => {
            const outcome = outcomes.find((item) => item.requestId === request.id)!
            const leftQueue = trace.events.find((event) => event.requestId === request.id && event.kind === 'left-queue')
            return (
              <div className="terminal-row" key={request.id}>
                <strong>{request.id}</strong>
                {trace.ticks.map((snapshot) => {
                  const state = snapshot.states.find((item) => item.requestId === request.id)!
                  const phase = state.state === 'terminated'
                    ? `terminal-${state.terminalCause}`
                    : state.state === 'not-arrived' ? 'not-arrived'
                    : state.state === 'queued-waiting-blocks' ? 'waiting'
                    : state.state === 'waiting-prefill' ? 'prefill-wait'
                    : 'generating'
                  const showCleanup = state.state === 'terminated' && outcome.terminalTick === snapshot.tick
                  return (
                    <span
                      key={snapshot.tick}
                      data-phase={phase}
                      className={snapshot.tick === tick ? 'is-current' : ''}
                    >
                      {showCleanup
                        ? `${causeLabels[state.terminalCause as TerminationCause]} 零块✓${leftQueue ? ' 离队✓' : ''} 关流✓`
                        : state.state === 'terminated' ? '·'
                        : phase === 'waiting' ? '等' : phase === 'generating' ? '生' : phase === 'prefill-wait' ? '备' : ''}
                    </span>
                  )
                })}
              </div>
            )
          })}
        </div>
        <div className="timeline-legend" aria-label="终态原因图例">
          <span><i data-phase="terminal-eos" />eos / 长度（自然完成）</span>
          <span><i data-phase="terminal-client-cancel" />取消</span>
          <span><i data-phase="terminal-timeout" />超时</span>
          <span><i data-phase="waiting" />等待块</span>
          <span><i data-phase="generating" />生成中</span>
        </div>
        <div className="trace-readout terminal-coverage-readout" aria-live="polite">
          <span>t{tick}</span>
          <strong>本拍终点</strong>
          <p>清理对勾（零块 / 离队 / 关流）只出现在终态当拍；离队对勾仅对终态时仍在队的请求出现。</p>
          <dl>
            {trace.events.filter((event) => event.tick === tick && event.kind === 'terminated').map((event) => (
              <div key={event.sequence}><dt>{event.requestId}</dt>
                <dd>{causeLabels[event.cause as TerminationCause]} · 清理当拍完成</dd></div>
            ))}
            {trace.events.filter((event) => event.tick === tick && event.kind === 'terminated').length === 0 && (
              <div><dt>本拍</dt><dd>没有请求进入终态</dd></div>
            )}
          </dl>
        </div>
      </div>
      <figcaption id="terminal-coverage-caption">终态原因与清理对勾全部来自 simulated 终止轨迹；每个请求恰好一个终态，清理在终态当拍一次走完。拍数与对勾是记账，不是真实延迟或可靠性。</figcaption>
    </figure>
  )
}

/** 终止也是容量回收：基线与注入终止的空闲块条带并排，标注拍差。 */
export function CapacityRecycleFigure() {
  const injected = useMemo(() => buildTerminationTrace(), [])
  const baseline = useMemo(() => buildTerminationTrace({ injections: [] }), [])
  const injectedOutcome = useMemo(() => terminationOutcome(injected), [injected])
  const baselineOutcome = useMemo(() => terminationOutcome(baseline), [baseline])
  const playback = useSteppedPlayback(Math.max(injected.ticks.length, baseline.ticks.length) - 1)
  const tick = playback.index

  return (
    <figure className="concurrency-figure capacity-recycle-figure" aria-labelledby="capacity-recycle-caption">
      <header className="concurrency-figure-header">
        <div><span>CAPACITY RECYCLE · 07</span><strong>终止也是容量回收</strong></div>
        <div className="concurrency-toolbar">
          <div role="group" aria-label="控制观察拍" className="step-controls">
            <button type="button" onClick={playback.toggle}>{playback.playing ? '暂停动画' : '继续动画'}</button>
            <button type="button" onClick={playback.previous} disabled={tick === 0}>上一步</button>
            <button type="button" onClick={playback.next} disabled={tick >= Math.max(injected.ticks.length, baseline.ticks.length) - 1}>下一步</button>
            <button type="button" onClick={playback.reset}>重置</button>
          </div>
        </div>
      </header>
      <div className="capacity-recycle-workbench">
        {[{ label: '基线（无终止注入）', trace: baseline }, { label: '注入终止（取消 + 超时）', trace: injected }].map((variant) => (
          <div className="recycle-strip-block" key={variant.label}>
            <strong>{variant.label}</strong>
            <div className="recycle-strip">
              {variant.trace.ticks.map((snapshot) => (
                <div key={snapshot.tick} className={`strip-cell${snapshot.tick === tick ? ' is-current' : ''}`}>
                  <span>{snapshot.freeBlocks}</span>
                  <i style={{ '--fill': snapshot.freeBlocks / variant.trace.blockCount } as CSSProperties} />
                  <small>t{snapshot.tick}</small>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="trace-readout capacity-recycle-readout" aria-live="polite">
          <span>t{tick}</span>
          <strong>t4：释放与准入同拍</strong>
          <p>`C-b` 取消当拍释放 2 块，`C-d` 同拍准入并 prefill——基线里它要等到 t5；`C-e` 超时离队，一个块都没占。</p>
          <dl>
            {injectedOutcome.map((injectedRow) => {
              const baselineRow = baselineOutcome.find((item) => item.requestId === injectedRow.requestId)!
              return (
                <div key={injectedRow.requestId}><dt>{injectedRow.requestId}</dt>
                  <dd>基线 {baselineRow.firstExecutionTick < 0 ? '未执行' : `t${baselineRow.firstExecutionTick}/t${baselineRow.terminalTick}`} → 注入 {injectedRow.firstExecutionTick < 0 ? '未执行' : `t${injectedRow.firstExecutionTick}/t${injectedRow.terminalTick}`}</dd>
                </div>
              )
            })}
          </dl>
        </div>
      </div>
      <figcaption id="capacity-recycle-caption">两条轨迹来自同一工作量与同一块池，空闲块条带逐拍并列。终止让总拍数从 8 到 6、`C-d` 提前一拍准入，也让幸存者晚一拍完成——计数不是收益结论，真实代价与回收必须测量。</figcaption>
    </figure>
  )
}

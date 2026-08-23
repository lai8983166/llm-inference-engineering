import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  buildStrategyTrace,
  type ConcurrencyStrategy,
  type RequestSnapshot,
  type StrategyTrace,
} from '@/learning/concurrencyTrace'

const statusLabels = {
  'not-arrived': '未到达',
  ready: '可运行',
  submitted: '已提交',
  'in-flight': '设备执行',
  done: '已结束',
} as const

function reducedMotionPreferred() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function useLogicalPlayback(maxStep: number) {
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(() => !reducedMotionPreferred())

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => setStep((current) => current >= maxStep ? 0 : current + 1), 1700)
    return () => window.clearInterval(timer)
  }, [maxStep, playing])

  return {
    step,
    playing,
    toggle: () => setPlaying((value) => !value),
    previous: () => { setStep((current) => Math.max(0, current - 1)); setPlaying(false) },
    next: () => { setStep((current) => Math.min(maxStep, current + 1)); setPlaying(false) },
    reset: () => { setStep(0); setPlaying(false) },
    select: (value: number) => { setStep(value); setPlaying(false) },
  }
}

function maxLogicalStep(trace: StrategyTrace) {
  return Math.max(...trace.events.map((event) => event.logicalStep))
}

function snapshotAt(trace: StrategyTrace, requestId: string, logicalStep: number): RequestSnapshot | undefined {
  return trace.snapshots
    .filter((snapshot) => snapshot.requestId === requestId && snapshot.logicalStep <= logicalStep)
    .at(-1)
}

function logicalSteps(trace: StrategyTrace) {
  return Array.from({ length: maxLogicalStep(trace) + 1 }, (_, index) => index)
}

const strategyCopy: Record<Exclude<ConcurrencyStrategy, 'static-batch'>, { label: string; detail: string }> = {
  serial: {
    label: '整请求串行',
    detail: 'R-short 已可运行，但 R-long 结束前不会得到设备执行。',
  },
  'independent-loops': {
    label: '独立请求循环',
    detail: '多个主机循环可以提交；这里的抽象设备仍逐项取工作，不据此假设 kernel 重叠。',
  },
}

export function RequestDeviceTraceFigure() {
  const [strategy, setStrategy] = useState<Exclude<ConcurrencyStrategy, 'static-batch'>>('serial')
  const trace = useMemo(() => buildStrategyTrace(strategy), [strategy])
  const steps = useMemo(() => logicalSteps(trace), [trace])
  const playback = useLogicalPlayback(steps.at(-1) ?? 0)
  const currentEvents = trace.events.filter((event) => event.logicalStep === playback.step)
  const hostSubmits = currentEvents.filter((event) => event.kind === 'host-submit').map((event) => event.requestId)
  const deviceGroup = trace.groups.find((group) => group.logicalStep === playback.step)

  const selectStrategy = (value: typeof strategy) => {
    setStrategy(value)
    playback.reset()
  }

  return (
    <figure className={`concurrency-figure request-device-figure${playback.playing ? '' : ' is-paused'}`} aria-labelledby="request-device-caption">
      <header className="concurrency-figure-header">
        <div><span>REQUEST / DEVICE TRACE · 01</span><strong>主机活跃，设备就并行了吗？</strong></div>
        <div className="concurrency-toolbar">
          <div role="group" aria-label="选择执行组织" className="strategy-switch">
            <button type="button" aria-pressed={strategy === 'serial'} onClick={() => selectStrategy('serial')}>整请求串行</button>
            <button type="button" aria-pressed={strategy === 'independent-loops'} onClick={() => selectStrategy('independent-loops')}>独立循环</button>
          </div>
          <div role="group" aria-label="控制请求设备轨迹" className="step-controls">
            <button type="button" onClick={playback.toggle}>{playback.playing ? '暂停动画' : '继续动画'}</button>
            <button type="button" onClick={playback.previous} disabled={playback.step === 0}>上一步</button>
            <button type="button" onClick={playback.next} disabled={playback.step === steps.at(-1)}>下一步</button>
            <button type="button" onClick={playback.reset}>重置</button>
          </div>
        </div>
      </header>
      <div className="request-device-workbench">
        <ol className="logical-step-axis" aria-label="选择逻辑步">
          {steps.map((step) => (
            <li key={step} className={step < playback.step ? 'is-past' : ''}>
              <button type="button" aria-current={step === playback.step ? 'step' : undefined} onClick={() => playback.select(step)}>t{step}</button>
            </li>
          ))}
        </ol>
        <div className="request-state-lanes" data-request-count={trace.requests.length}>
          {trace.requests.map((request) => (
            <div className="request-state-lane" key={request.id}>
              <strong>{request.id}</strong>
              {steps.map((step) => {
                const snapshot = snapshotAt(trace, request.id, step)
                const status = snapshot?.status ?? 'not-arrived'
                return <span key={step} className={`state-${status}${step === playback.step ? ' is-current' : ''}`}>{statusLabels[status]}</span>
              })}
            </div>
          ))}
          <div className="request-state-lane host-submit-lane">
            <strong>HOST</strong>
            {steps.map((step) => {
              const submitted = trace.events.filter((event) => event.logicalStep === step && event.kind === 'host-submit').map((event) => event.requestId)
              return <span key={step} className={step === playback.step ? 'is-current' : ''}>{submitted.length > 0 ? submitted.join(' + ') : '—'}</span>
            })}
          </div>
          <div className="request-state-lane device-execution-lane">
            <strong>DEVICE</strong>
            {steps.map((step) => {
              const group = trace.groups.find((item) => item.logicalStep === step)
              return <span key={step} className={step === playback.step ? 'is-current' : ''}>{group ? `${group.members.filter((member) => member.slotState === 'active').map((member) => member.requestId).join(' + ')} · ${group.phase}` : 'idle'}</span>
            })}
          </div>
        </div>
        <div className="trace-readout" aria-live="polite">
          <span>t{playback.step}</span>
          <strong>{strategyCopy[strategy].label}</strong>
          <p>{strategyCopy[strategy].detail}</p>
          <dl>
            <div><dt>主机提交</dt><dd>{hostSubmits.length > 0 ? hostSubmits.join('、') : '无'}</dd></div>
            <div><dt>设备执行组</dt><dd>{deviceGroup ? deviceGroup.members.filter((member) => member.slotState === 'active').map((member) => member.requestId).join('、') : '无'}</dd></div>
          </dl>
        </div>
      </div>
      <figcaption id="request-device-caption">相同请求、相同到达、相同逻辑工作；切换只改变执行组织。逻辑步来自 simulated 事件，不能证明真实 GPU 上的 kernel 重叠或性能收益。</figcaption>
    </figure>
  )
}

type OccupancyKind = 'future' | 'waiting' | 'prefill' | 'prefill-padding' | 'decode' | 'inactive' | 'done'

function occupancyAt(trace: StrategyTrace, requestId: string, logicalStep: number): { kind: OccupancyKind; label: string } {
  const request = trace.requests.find((item) => item.id === requestId)!
  if (logicalStep < request.arrivalStep) return { kind: 'future', label: '未到达' }
  const group = trace.groups.find((item) => item.logicalStep === logicalStep)
  const member = group?.members.find((item) => item.requestId === requestId)
  if (member?.slotState === 'inactive') return { kind: 'inactive', label: '非活跃槽' }
  if (member && group?.phase === 'prefill') {
    return member.paddingTokens > 0
      ? { kind: 'prefill-padding', label: `${member.validTokens} 有效 + ${member.paddingTokens} pad` }
      : { kind: 'prefill', label: `${member.validTokens} 有效` }
  }
  if (member && group?.phase === 'decode') return { kind: 'decode', label: '1 token' }

  const completion = trace.events.find((event) => event.requestId === requestId && event.kind === 'request-complete')
  if (completion && completion.logicalStep < logicalStep) return { kind: 'done', label: '已结束' }
  return { kind: 'waiting', label: '批外等待' }
}

export function StaticBatchOccupancyFigure() {
  const trace = useMemo(() => buildStrategyTrace('static-batch'), [])
  const steps = useMemo(() => logicalSteps(trace), [trace])
  const playback = useLogicalPlayback(steps.at(-1) ?? 0)
  const currentGroup = trace.groups.find((group) => group.logicalStep === playback.step)
  const activeMembers = currentGroup?.members.filter((member) => member.slotState === 'active') ?? []
  const padding = currentGroup?.members.reduce((total, member) => total + member.paddingTokens, 0) ?? 0

  return (
    <figure className={`concurrency-figure batch-occupancy-figure${playback.playing ? '' : ' is-paused'}`} aria-labelledby="batch-occupancy-caption">
      <header className="concurrency-figure-header">
        <div><span>STATIC BATCH OCCUPANCY · 02</span><strong>成员固定，生命周期却在分开</strong></div>
        <div role="group" aria-label="控制静态批次轨迹" className="step-controls">
          <button type="button" onClick={playback.toggle}>{playback.playing ? '暂停动画' : '继续动画'}</button>
          <button type="button" onClick={playback.previous} disabled={playback.step === 0}>上一步</button>
          <button type="button" onClick={playback.next} disabled={playback.step === steps.at(-1)}>下一步</button>
          <button type="button" onClick={playback.reset}>重置</button>
        </div>
      </header>
      <div className="batch-occupancy-workbench">
        <div className="occupancy-grid" style={{ '--occupancy-columns': steps.length } as CSSProperties} data-request-count={trace.requests.length}>
          <span className="occupancy-corner">REQUEST</span>
          {steps.map((step) => <button type="button" key={`head-${step}`} aria-current={step === playback.step ? 'step' : undefined} onClick={() => playback.select(step)}>t{step}</button>)}
          {trace.requests.map((request) => (
            <div className="occupancy-row" key={request.id}>
              <strong>{request.id}</strong>
              {steps.map((step) => {
                const cell = occupancyAt(trace, request.id, step)
                return <span key={step} data-kind={cell.kind} className={step === playback.step ? 'is-current' : ''}>{cell.label}</span>
              })}
            </div>
          ))}
        </div>
        <div className="occupancy-legend" aria-label="占用状态图例">
          <span><i data-kind="prefill" />有效工作</span>
          <span><i data-kind="prefill-padding" />含 padding</span>
          <span><i data-kind="inactive" />非活跃槽</span>
          <span><i data-kind="waiting" />批外等待</span>
        </div>
        <div className="occupancy-readout" aria-live="polite">
          <span>t{playback.step}</span>
          <strong>{currentGroup ? currentGroup.phase : '等待形成批次'}</strong>
          <p>{currentGroup ? `本次执行推进 ${activeMembers.length} 个请求；${padding > 0 ? `另有 ${padding} 个对齐位置。` : '没有新增 padding 位置。'}` : '请求已经到达，但当前策略尚未形成执行组。'}</p>
          <small>证据：simulated logical trace</small>
        </div>
      </div>
      <figcaption id="batch-occupancy-caption">文字标签与颜色共同区分有效工作、padding、非活跃槽和批外等待。逻辑占用不等于真实 kernel 成本，也不能证明 GPU 利用率。</figcaption>
    </figure>
  )
}

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  buildOverloadTrace,
  overloadSummary,
  type OverloadPolicy,
  type OverloadTrace,
  type OverloadEventKind,
} from '@/learning/overloadTrace'

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

type OverloadMode = 'queue' | 'reject-full' | 'reject-watermark' | 'preempt'

const modeConfig: Record<OverloadMode, { policy: OverloadPolicy; watermarkBlocks: number; label: string; detail: string; bearer: string }> = {
  queue: {
    policy: 'queue',
    watermarkBlocks: 0,
    label: '无界排队',
    detail: '到达照单全收：块不够就排队重试，等待没有上限。',
    bearer: '等待者',
  },
  'reject-full': {
    policy: 'reject',
    watermarkBlocks: 0,
    label: '按满拒绝',
    detail: 'free − need < 0 即拒绝：调用方当场收到失败。',
    bearer: '调用方',
  },
  'reject-watermark': {
    policy: 'reject',
    watermarkBlocks: 1,
    label: '水位 W=1',
    detail: 'free − need < 1 即拒绝：给在跑者的增长留出余量。',
    bearer: '调用方（边界大申请）',
  },
  preempt: {
    policy: 'preempt-recompute',
    watermarkBlocks: 0,
    label: '抢占重计算',
    detail: '空闲不足时请最近开始生成者让位，受害者以重算恢复。',
    bearer: '被抢占者',
  },
}

const eventLabels: Record<OverloadEventKind, string> = {
  arrived: '到达',
  admitted: '准入',
  queued: '排队',
  rejected: '拒绝',
  preempted: '被抢占',
  'prefill-executed': 'prefill',
  'recompute-prefill': '重算 prefill',
  'decode-executed': 'decode',
  completed: '完成',
  'blocks-acquired': '取块',
  'blocks-released': '还块',
}

function traceFor(mode: OverloadMode): OverloadTrace {
  return buildOverloadTrace(modeConfig[mode].policy, { watermarkBlocks: modeConfig[mode].watermarkBlocks })
}

/** 逐拍双条带：空闲块数与排队深度并列，事件账本同步，策略可切换。 */
export function OverloadPoolFigure() {
  const [mode, setMode] = useState<OverloadMode>('queue')
  const trace = useMemo(() => traceFor(mode), [mode])
  const playback = useSteppedPlayback(trace.ticks.length - 1)
  const tick = Math.min(playback.index, trace.ticks.length - 1)
  const snapshot = trace.ticks[tick]

  const selectMode = (value: OverloadMode) => {
    setMode(value)
    playback.reset()
  }

  return (
    <figure className="concurrency-figure overload-pool-figure" aria-labelledby="overload-pool-caption">
      <header className="concurrency-figure-header">
        <div><span>OVERLOAD POOL · 06</span><strong>过载时的池与队伍</strong></div>
        <div className="concurrency-toolbar">
          <div role="group" aria-label="选择过载策略" className="strategy-switch">
            {(Object.keys(modeConfig) as OverloadMode[]).map((value) => (
              <button key={value} type="button" aria-pressed={mode === value} onClick={() => selectMode(value)}>
                {modeConfig[value].label}
              </button>
            ))}
          </div>
          <div role="group" aria-label="控制观察拍" className="step-controls">
            <button type="button" onClick={playback.toggle}>{playback.playing ? '暂停动画' : '继续动画'}</button>
            <button type="button" onClick={playback.previous} disabled={tick === 0}>上一步</button>
            <button type="button" onClick={playback.next} disabled={tick >= trace.ticks.length - 1}>下一步</button>
            <button type="button" onClick={playback.reset}>重置</button>
          </div>
        </div>
      </header>
      <div className="overload-pool-workbench">
        <div className="dual-strip-scroll" style={{ '--dual-columns': trace.ticks.length } as CSSProperties}>
          <div className="dual-strip-head">
            {trace.ticks.map((item) => (
              <button key={item.tick} type="button" aria-current={item.tick === tick ? 'step' : undefined} onClick={() => playback.select(item.tick)}>t{item.tick}</button>
            ))}
          </div>
          <div className="dual-strip-row">
            <strong>空闲块</strong>
            {trace.ticks.map((item) => (
              <div key={item.tick} className={`strip-cell${item.tick === tick ? ' is-current' : ''}`}>
                <span data-level={item.freeBlocks}>{item.freeBlocks}</span>
                <i style={{ '--fill': item.freeBlocks / trace.blockCount } as CSSProperties} />
              </div>
            ))}
          </div>
          <div className="dual-strip-row">
            <strong>排队</strong>
            {trace.ticks.map((item) => (
              <div key={item.tick} className={`strip-cell${item.tick === tick ? ' is-current' : ''}`}>
                <span data-level={item.queueDepth}>{item.queueDepth}</span>
                <i data-empty={item.queueDepth === 0 ? 'true' : undefined} style={{ '--fill': item.queueDepth / trace.requests.length } as CSSProperties} />
              </div>
            ))}
          </div>
        </div>
        <div className="trace-readout overload-pool-readout" aria-live="polite">
          <span>t{tick}</span>
          <strong>{modeConfig[mode].label}</strong>
          <p>{modeConfig[mode].detail}成本承担者：{modeConfig[mode].bearer}。</p>
          <dl>
            <div><dt>本拍事件</dt>
              <dd>{trace.events.filter((event) => event.tick === tick).map((event) =>
                `${event.requestId} ${eventLabels[event.kind]}${event.recomputeTokens !== undefined ? `(${event.recomputeTokens})` : ''}`,
              ).join(' · ') || '无'}</dd></div>
            <div><dt>本拍执行</dt>
              <dd>{snapshot.chosen
                ? `${snapshot.chosen.kind === 'prefill' ? 'prefill' : 'decode 组'} {${snapshot.chosen.members.join(' + ')}}`
                : '无'}</dd></div>
          </dl>
        </div>
        <ol className="event-ledger" aria-label="过载事件账本">
          {trace.events.map((event) => (
            <li key={event.sequence} className={event.tick === tick ? 'is-current' : event.tick < tick ? 'is-past' : ''}>
              <button type="button" onClick={() => { playback.select(event.tick) }}>
                <span>e{event.sequence} t{event.tick}</span>
                <b>{event.requestId}</b>
                <em className={event.kind === 'recompute-prefill' ? 'is-recompute' : ''}>{eventLabels[event.kind]}{event.recomputeTokens !== undefined ? ` ${event.recomputeTokens}` : ''}</em>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <figcaption id="overload-pool-caption">双条带与事件账本来自同一 simulated 过载轨迹；重算 prefill 以文字加标记双编码。拍数、块数与排队深度是计数，不是时间或真实排队论。</figcaption>
    </figure>
  )
}

/** 四种策略的成本账单：计数全部来自 overloadSummary，承担者逐行高亮。 */
export function CostBillsFigure() {
  const [selected, setSelected] = useState<OverloadMode>('queue')
  const summaries = useMemo(() => {
    const entries = (Object.keys(modeConfig) as OverloadMode[]).map((mode) => {
      const trace = traceFor(mode)
      return { mode, summary: overloadSummary(trace) }
    })
    return Object.fromEntries(entries.map((item) => [item.mode, item.summary]))
  }, [])
  const current = summaries[selected]

  return (
    <figure className="concurrency-figure cost-bills-figure" aria-labelledby="cost-bills-caption">
      <header className="concurrency-figure-header">
        <div><span>COST BILLS · 06</span><strong>四种策略，四张账单</strong></div>
        <div className="concurrency-toolbar">
          <div role="group" aria-label="选择查看的策略" className="strategy-switch">
            {(Object.keys(modeConfig) as OverloadMode[]).map((value) => (
              <button key={value} type="button" aria-pressed={selected === value} onClick={() => setSelected(value)}>
                {modeConfig[value].label}
              </button>
            ))}
          </div>
        </div>
      </header>
      <div className="cost-bills-workbench">
        <table className="cost-bills-table" aria-label="四策略成本对照">
          <thead>
            <tr><th>策略</th><th>总拍数</th><th>被拒</th><th>被抢占</th><th>重计算</th><th>最大排队</th><th>成本承担者</th></tr>
          </thead>
          <tbody>
            {(Object.keys(modeConfig) as OverloadMode[]).map((mode) => {
              const summary = summaries[mode]
              return (
                <tr key={mode} className={mode === selected ? 'is-selected' : ''}>
                  <th scope="row"><button type="button" onClick={() => setSelected(mode)}>{modeConfig[mode].label}</button></th>
                  <td>{summary.totalTicks}</td>
                  <td>{summary.rejected.length > 0 ? summary.rejected.join('、') : '0'}</td>
                  <td>{summary.preempted.length > 0 ? summary.preempted.join('、') : '0'}</td>
                  <td>{summary.recomputeTokenUnits} unit</td>
                  <td>{summary.maxQueueDepth}</td>
                  <td className="bearer-cell">{modeConfig[mode].bearer}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="trace-readout cost-bills-readout" aria-live="polite">
          <span>{modeConfig[selected].label}</span>
          <strong>{modeConfig[selected].bearer} 承担过载成本</strong>
          <p>{modeConfig[selected].detail}策略没有全优解：每张账单都是一份服务承诺的取舍。</p>
          <dl>
            {current.outcomes.map((outcome) => (
              <div key={outcome.requestId}><dt>{outcome.requestId}</dt>
                <dd>{outcome.firstExecutionTick < 0 ? '被拒，从未执行' : `首执行 t${outcome.firstExecutionTick} · 完成 t${outcome.completionTick}`}</dd></div>
            ))}
          </dl>
        </div>
      </div>
      <figcaption id="cost-bills-caption">全部计数来自 overloadSummary 的 simulated 轨迹。没有一行全优：读表的方式是问“寄给谁”，不是找最小值；真实延迟与吞吐必须测量。</figcaption>
    </figure>
  )
}

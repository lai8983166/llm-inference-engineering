import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  closedLoopTrace,
  distribution,
  loopComparison,
  meanTailCounterexample,
  metricsTrace,
  requestMetrics,
} from '@/learning/metricsLayer'

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

type MetricKind = 'queue' | 'ttft' | 'itl' | 'e2e'

const metricCopy: Record<MetricKind, { label: string; definition: string }> = {
  queue: { label: '排队', definition: '准入拍 − 到达拍（从未准入者不进分布）' },
  ttft: { label: '首 token', definition: '首个输出事件拍 − 到达拍（从未执行者不进分布）' },
  itl: { label: '间隔', definition: '相邻两个输出事件拍之差（全部间隔入池）' },
  e2e: { label: '端到端', definition: '终态拍 − 到达拍（含被取消与超时者）' },
}

function metricValues(rows: ReturnType<typeof requestMetrics>, kind: MetricKind): number[] {
  if (kind === 'itl') return rows.flatMap((row) => row.itlTicks)
  if (kind === 'queue') return rows.filter((row) => row.queueTicks !== null).map((row) => row.queueTicks as number)
  if (kind === 'ttft') return rows.filter((row) => row.ttftTicks !== null).map((row) => row.ttftTicks as number)
  return rows.map((row) => row.e2eTicks)
}

/** 聚合链图：单请求事件尺 + 指标切换 + 全体取值排序条带与分位标记，A/B 反例可切换。 */
export function EventToDistributionFigure() {
  const trace = useMemo(() => metricsTrace, [])
  const rows = useMemo(() => requestMetrics(trace), [trace])
  const [metric, setMetric] = useState<MetricKind>('ttft')
  const [requestId, setRequestId] = useState('K-d')
  const [showCounterexample, setShowCounterexample] = useState(false)
  const counterexample = useMemo(() => meanTailCounterexample(), [])

  const workloadValues = useMemo(() => metricValues(rows, metric), [rows, metric])
  const stats = useMemo(() => distribution(workloadValues), [workloadValues])
  const activeRow = rows.find((row) => row.requestId === requestId)

  return (
    <figure className="concurrency-figure aggregation-chain-figure" aria-labelledby="aggregation-chain-caption">
      <header className="concurrency-figure-header">
        <div><span>AGGREGATION CHAIN · 08</span><strong>从事件到分布</strong></div>
        <div className="concurrency-toolbar">
          <div role="group" aria-label="选择指标" className="strategy-switch">
            {(Object.keys(metricCopy) as MetricKind[]).map((kind) => (
              <button key={kind} type="button" aria-pressed={metric === kind && !showCounterexample} onClick={() => { setMetric(kind); setShowCounterexample(false) }}>
                {metricCopy[kind].label}
              </button>
            ))}
            <button type="button" aria-pressed={showCounterexample} onClick={() => setShowCounterexample(true)}>A/B 反例</button>
          </div>
        </div>
      </header>
      <div className="aggregation-chain-workbench">
        <div className="event-ruler-block">
          <div role="group" aria-label="选择请求" className="request-switch">
            {rows.map((row) => (
              <button key={row.requestId} type="button" aria-pressed={requestId === row.requestId} onClick={() => setRequestId(row.requestId)}>
                {row.requestId}
              </button>
            ))}
          </div>
          <div className="event-ruler" aria-label="单请求事件尺">
            {trace.ticks.map((snapshot) => {
              const events = trace.events.filter((event) => event.requestId === requestId && event.tick === snapshot.tick)
              const marks = events.map((event) => event.kind === 'arrived' ? '到'
                : event.kind === 'admitted' ? '准'
                : event.kind === 'prefill-executed' || event.kind === 'decode-executed' ? '出'
                : event.kind === 'terminated' ? '终'
                : event.kind === 'blocks-released' ? '释'
                : event.kind === 'queued' ? '队'
                : '').filter(Boolean)
              return <span key={snapshot.tick} className={marks.length > 0 ? 'has-event' : ''}>t{snapshot.tick}<b>{marks.join(' ')}</b></span>
            })}
          </div>
          <p className="event-ruler-note">当前指标：<strong>{metricCopy[metric].label}</strong> = {metricCopy[metric].definition}。`{requestId}` 的取值参与分布。</p>
        </div>
        <div className="distribution-panel" data-mode={showCounterexample ? 'counterexample' : 'workload'}>
          {showCounterexample ? (
            <>
              {[
                { label: '系统 A：[1,1,1,1,5]', system: counterexample.systemA },
                { label: '系统 B：[2,2,2,2,2]', system: counterexample.systemB },
              ].map(({ label, system }) => (
                <div key={label} className="distribution-row">
                  <strong>{label}</strong>
                  <ol className="sorted-strip">
                    {system.summary.sorted.map((value, index) => (
                      <li key={index} data-breach={value > counterexample.slo.threshold ? 'true' : undefined}>{value}</li>
                    ))}
                  </ol>
                  <small>均值 {system.summary.mean} · p99 {system.summary.p99} · SLO ≤{counterexample.slo.threshold}@p99：{system.verdict.passes ? '达标' : '违约'}</small>
                </div>
              ))}
              <p className="distribution-note">A 的均值更好（1.8 &lt; 2.0），B 的承诺兑现——均值与分位回答不同的问题。</p>
            </>
          ) : (
            <>
              <div className="distribution-row">
                <strong>全体取值（排序）</strong>
                <ol className="sorted-strip">
                  {stats.sorted.map((value, index) => (
                    <li key={index} data-role={value === stats.p99 ? 'p99' : value === stats.p50 ? 'p50' : undefined}>{value}</li>
                  ))}
                </ol>
                <small>均值 {stats.mean.toFixed(2)} · p50 {stats.p50} · p99 {stats.p99} · 最大 {stats.max}</small>
              </div>
              <p className="distribution-note">最近邻秩分位；拍是事件刻度，不是时间。p99 能沿链指回产生它的请求。</p>
            </>
          )}
        </div>
        <div className="trace-readout aggregation-readout" aria-live="polite">
          <span>{showCounterexample ? '反例' : metricCopy[metric].label}</span>
          <strong>{showCounterexample ? '均值会说谎' : `${stats.count} 个样本`}</strong>
          <p>{showCounterexample
            ? '两组间隔分布的均值几乎相同、尾部天壤之别——SLO 判定跟着分位走。'
            : `定义：${metricCopy[metric].definition}。任何分位都可回溯到具体请求的事件对。`}</p>
          <dl>
            {showCounterexample ? (
              <>
                <div><dt>A 均值 / p99</dt><dd>{counterexample.systemA.summary.mean} / {counterexample.systemA.summary.p99}（违约）</dd></div>
                <div><dt>B 均值 / p99</dt><dd>{counterexample.systemB.summary.mean} / {counterexample.systemB.summary.p99}（达标）</dd></div>
              </>
            ) : (
              <>
                <div><dt>{requestId} 的取值</dt><dd>{metric === 'itl' ? `[${activeRow?.itlTicks.join(', ')}]` : metric === 'queue' ? `${activeRow?.queueTicks ?? '未定义'}` : metric === 'ttft' ? `${activeRow?.ttftTicks ?? '未定义'}` : `${activeRow?.e2eTicks}`} 拍</dd></div>
                <div><dt>分布 p50 / p99</dt><dd>{stats.p50} / {stats.p99} 拍</dd></div>
              </>
            )}
          </dl>
        </div>
      </div>
      <figcaption id="aggregation-chain-caption">事件尺、取值与分位全部来自 simulated 指标层；单位是拍，不是时间。分位用最近邻秩；A/B 反例是登记的教学分布，不冒充真实测量。</figcaption>
    </figure>
  )
}

/** 环式对照图：同一服务在开环与串行闭环下的到达标记与队列深度条带并排。 */
export function LoopComparisonFigure() {
  const openTrace = useMemo(() => metricsTrace, [])
  const closedTrace = useMemo(() => closedLoopTrace(), [])
  const comparison = useMemo(() => loopComparison(), [])
  const [loop, setLoop] = useState<'open' | 'closed'>('open')
  const active = loop === 'open' ? openTrace : closedTrace
  const totalTicks = active.ticks.length
  const playback = useSteppedPlayback(Math.max(comparison.openTicks, comparison.closedTicks) - 1)

  return (
    <figure className="concurrency-figure loop-comparison-figure" aria-labelledby="loop-comparison-caption">
      <header className="concurrency-figure-header">
        <div><span>OPEN VS CLOSED · 08</span><strong>开放环与闭环测的不是同一件事</strong></div>
        <div className="concurrency-toolbar">
          <div role="group" aria-label="选择环式" className="strategy-switch">
            <button type="button" aria-pressed={loop === 'open'} onClick={() => { setLoop('open'); playback.reset() }}>开放环</button>
            <button type="button" aria-pressed={loop === 'closed'} onClick={() => { setLoop('closed'); playback.reset() }}>闭环</button>
          </div>
          <div role="group" aria-label="控制观察拍" className="step-controls">
            <button type="button" onClick={playback.toggle}>{playback.playing ? '暂停动画' : '继续动画'}</button>
            <button type="button" onClick={playback.previous} disabled={playback.index === 0}>上一步</button>
            <button type="button" onClick={playback.next} disabled={playback.index >= Math.max(comparison.openTicks, comparison.closedTicks) - 1}>下一步</button>
            <button type="button" onClick={playback.reset}>重置</button>
          </div>
        </div>
      </header>
      <div className="loop-comparison-workbench">
        <div className="loop-strip-scroll">
          <div className="loop-strip-head" style={{ '--loop-columns': totalTicks } as CSSProperties}>
            {active.ticks.map((snapshot) => (
              <button key={snapshot.tick} type="button" aria-current={snapshot.tick === playback.index ? 'step' : undefined} onClick={() => playback.select(snapshot.tick)}>t{snapshot.tick}</button>
            ))}
          </div>
          <div className="loop-strip-row">
            <strong>到达</strong>
            {active.ticks.map((snapshot) => {
              const arrivals = active.requests.filter((request) => request.arrivalStep === snapshot.tick)
              return <span key={snapshot.tick}>{arrivals.length > 0 ? arrivals.map((request) => `${request.id} 到`).join(' ') : '·'}</span>
            })}
          </div>
          <div className="loop-strip-row loop-queue-row">
            <strong>队列</strong>
            {active.ticks.map((snapshot) => (
              <div key={snapshot.tick} className={`strip-cell${snapshot.tick === playback.index ? ' is-current' : ''}`}>
                <span data-level={snapshot.queueDepth}>{snapshot.queueDepth}</span>
                <i data-empty={snapshot.queueDepth === 0 ? 'true' : undefined} style={{ '--fill': snapshot.queueDepth / active.requests.length } as CSSProperties} />
              </div>
            ))}
          </div>
        </div>
        <div className="trace-readout loop-readout" aria-live="polite">
          <span>{loop === 'open' ? '开环' : '闭环'}</span>
          <strong>{loop === 'open' ? `最大队列 ${comparison.openMaxQueueDepth}` : `最大队列 ${comparison.closedMaxQueueDepth}`}</strong>
          <p>{loop === 'open'
            ? '到达预先固定（0,0,1,2,3,6）：服务再慢请求照样到，排队现形。'
            : '串行客户端（0,3,6,9,11,15）：下一请求等上一个完成，排队被客户端节奏吸收。'}</p>
          <dl>
            {comparison.rows.map((row) => (
              <div key={row.requestId}><dt>{row.requestId}</dt>
                <dd>排队 {loop === 'open' ? (row.openQueueTicks ?? '未准入') : row.closedQueueTicks} 拍</dd></div>
            ))}
            <div><dt>总拍数</dt><dd>{loop === 'open' ? comparison.openTicks : comparison.closedTicks}</dd></div>
          </dl>
        </div>
      </div>
      <figcaption id="loop-comparison-caption">两条时间线来自同一服务与请求集合的 simulated 轨迹。闭环隐藏排队，测不出过载行为；拍数与队列深度是计数，不是时间或真实排队论。</figcaption>
    </figure>
  )
}

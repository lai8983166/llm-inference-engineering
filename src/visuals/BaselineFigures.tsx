import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  boundaryEvents,
  boundaryWindows,
  distributionRuns,
  mean,
  median,
  nearestRankPercentile,
  warmupRuns,
} from '@/learning/baselineCase'
import { measureWindow, type BenchmarkRun } from '@/learning/benchmarkEvidence'

const observerLabels = {
  client: '客户端',
  server: '服务端',
  host: '主机提交',
  device: '设备执行',
} as const

const eventLabels = {
  'client-start': '开始请求',
  'server-received': '服务端接收',
  'host-submit': '提交工作',
  'host-return': '提交返回',
  'device-start': '设备开始',
  'device-complete': '设备完成',
  'result-readable': '结果可读',
  'request-complete': '请求完成',
} as const

const boundaryRun: BenchmarkRun = {
  id: 'boundary-demo',
  implementation: 'B',
  sequence: 1,
  phase: 'warm',
  status: 'succeeded',
  evidence: 'simulated',
  workload: { taskId: 'chapter-00-case', inputTokens: 128, outputLimit: 32, producedOutputTokens: 32, concurrency: 1 },
  environment: { modelId: 'teaching-model', modelRevision: 'r1', hardwareId: 'simulated-device', softwareStack: 'event-replay' },
  events: boundaryEvents,
}

export function ObservationBoundaryFigure() {
  const [windowId, setWindowId] = useState(boundaryWindows[0].id)
  const activeWindow = boundaryWindows.find((window) => window.id === windowId) ?? boundaryWindows[0]
  const measurement = measureWindow(boundaryRun, activeWindow)

  return (
    <figure className="evidence-figure boundary-figure" aria-labelledby="boundary-caption">
      <header className="evidence-header">
        <div><span>MEASUREMENT WINDOW · 01</span><strong>同一条事件线，四个合法答案</strong></div>
        <div className="evidence-switch" role="group" aria-label="选择观察者">
          {boundaryWindows.map((window) => (
            <button key={window.id} type="button" aria-pressed={window.id === windowId} onClick={() => setWindowId(window.id)}>
              {observerLabels[window.observer]}
            </button>
          ))}
        </div>
      </header>
      <div className="boundary-workbench">
        <div className="boundary-ruler" data-event-count={boundaryEvents.length}>
          <span className="ruler-line" aria-hidden="true" />
          {boundaryEvents.map((event, index) => {
            const active = event.observer === activeWindow.observer
              && (event.name === activeWindow.startEvent || event.name === activeWindow.endEvent)
            return (
              <div
                className={`ruler-event${active ? ' is-boundary' : ''}`}
                key={`${event.observer}-${event.name}-${index}`}
                style={{ '--event-position': `${(event.timestampMs / 80) * 100}%`, '--event-row': index % 3 } as CSSProperties}
              >
                <i aria-hidden="true" />
                <span>{event.timestampMs} ms</span>
                <small>{eventLabels[event.name]}</small>
              </div>
            )
          })}
        </div>
        <div className="window-readout" aria-live="polite">
          <span>{observerLabels[activeWindow.observer]}</span>
          <strong>{measurement.ok ? `${measurement.durationMs} ms` : '无法计算'}</strong>
          <p>{eventLabels[activeWindow.startEvent]} → {eventLabels[activeWindow.endEvent]}</p>
        </div>
      </div>
      <figcaption id="boundary-caption">切换观察者只会改变起止事件和派生区间；九个原始事件始终保留。数据来源：simulated。</figcaption>
    </figure>
  )
}

const asyncSteps = [
  { time: 18, lane: 'host', title: '主机提交工作', detail: '工作进入设备执行序列，主机不需要原地等待。' },
  { time: 20, lane: 'host', title: '提交函数返回', detail: '错误计时在这里结束，只得到 2 ms；设备工作尚未开始。' },
  { time: 21, lane: 'device', title: '设备开始执行', detail: '主机已经继续运行，设备现在才消费被提交的工作。' },
  { time: 68, lane: 'device', title: '设备完成执行', detail: '与本次工作关联的完成事件到达，设备区间为 47 ms。' },
  { time: 70, lane: 'host', title: '结果可以读取', detail: '完成信息回到主机；这仍不等于客户端已经收到响应。' },
] as const

export function AsyncCompletionFigure() {
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(() => typeof window.matchMedia !== 'function' || !window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => setStep((current) => (current + 1) % asyncSteps.length), 1900)
    return () => window.clearInterval(timer)
  }, [playing])

  const current = asyncSteps[step]
  const hostReturned = step >= 1
  const deviceComplete = step >= 3

  return (
    <figure className={`evidence-figure async-figure${playing ? '' : ' is-paused'}`} aria-labelledby="async-caption">
      <header className="evidence-header">
        <div><span>COMPLETION TRACE · 02</span><strong>返回之后，还有工作在路上</strong></div>
        <div className="async-controls">
          <button type="button" onClick={() => setPlaying((value) => !value)}>{playing ? '暂停动画' : '继续动画'}</button>
          <button type="button" onClick={() => { setStep((value) => (value + 1) % asyncSteps.length); setPlaying(false) }}>下一事件</button>
        </div>
      </header>
      <div className="async-workbench">
        <div className="async-lanes" aria-label="主机和设备事件轨迹">
          <div className="async-lane"><strong>HOST</strong><span className={hostReturned ? 'is-finished' : 'is-active'}>submit 18 → return 20</span></div>
          <div className="async-lane"><strong>DEVICE</strong><span className={deviceComplete ? 'is-finished' : step >= 2 ? 'is-active' : 'is-pending'}>start 21 → complete 68</span></div>
          <i className="async-cursor" style={{ '--cursor-position': `${(current.time / 70) * 100}%` } as CSSProperties} aria-hidden="true" />
        </div>
        <div className="async-status" aria-live="polite">
          <span>t = {current.time} ms · {current.lane.toUpperCase()}</span>
          <strong>{current.title}</strong>
          <p>{current.detail}</p>
          <dl><div><dt>主机窗口</dt><dd>{hostReturned ? '已结束：2 ms' : '进行中'}</dd></div><div><dt>设备工作</dt><dd>{deviceComplete ? '已完成' : '仍在途'}</dd></div></dl>
        </div>
      </div>
      <figcaption id="async-caption">逐个事件推进。暂停不会改变事件顺序；它只给你时间检查“函数返回”和“工作完成”之间的空隙。数据来源：simulated。</figcaption>
    </figure>
  )
}

type WarmupQuestion = 'cold' | 'steady' | 'undeclared'

const warmupQuestionCopy = {
  cold: { title: '冷启动问题：保留首轮', detail: '若目标是新实例的首个请求，第一次运行不能被预热规则抹掉。' },
  steady: { title: '稳态问题：声明预热边界', detail: '前两轮仍保留在原始记录中，但不进入这次稳态汇总。' },
  undeclared: { title: '事后删样本：结论不可复核', detail: '看到慢点后再隐藏它，没有说明系统状态或排除规则。' },
} as const

export function WarmupSequenceFigure() {
  const [question, setQuestion] = useState<WarmupQuestion>('cold')
  const copy = warmupQuestionCopy[question]

  return (
    <figure className="evidence-figure warmup-figure" aria-labelledby="warmup-caption">
      <header className="evidence-header">
        <div><span>RUN HISTORY · 03</span><strong>同一组原始运行，三个不同处理</strong></div>
        <div className="evidence-switch" role="group" aria-label="选择运行阶段问题">
          <button type="button" aria-pressed={question === 'cold'} onClick={() => setQuestion('cold')}>冷启动</button>
          <button type="button" aria-pressed={question === 'steady'} onClick={() => setQuestion('steady')}>稳态</button>
          <button type="button" aria-pressed={question === 'undeclared'} onClick={() => setQuestion('undeclared')}>事后删除</button>
        </div>
      </header>
      <div className="warmup-workbench">
        {(['A', 'B'] as const).map((implementation) => (
          <div className="run-strip" key={implementation} data-sample-count={warmupRuns[implementation].length}>
            <strong>{implementation}</strong>
            <ol>
              {warmupRuns[implementation].map((duration, index) => {
                const excluded = question === 'steady' && index < 2
                const undeclared = question === 'undeclared' && index === 0
                return <li key={index} className={`${excluded ? 'is-warmup ' : ''}${undeclared ? 'is-undisclosed' : ''}`} style={{ '--run-height': `${(duration / 240) * 100}%` } as CSSProperties}><i /><span>#{index + 1}</span><b>{duration}</b></li>
              })}
            </ol>
          </div>
        ))}
        <div className="warmup-decision" aria-live="polite"><strong>{copy.title}</strong><p>{copy.detail}</p><small>原始样本：12 / 12 可见</small></div>
      </div>
      <figcaption id="warmup-caption">切换问题时，原始点不会消失；只改变哪些样本进入当前结论，以及排除是否有事先声明。数据来源：simulated。</figcaption>
    </figure>
  )
}

type SummaryMetric = 'mean' | 'median' | 'p90'

const metricLabels: Record<SummaryMetric, string> = { mean: 'Mean', median: 'Median', p90: 'P90' }

function summarize(values: readonly number[], metric: SummaryMetric) {
  if (metric === 'mean') return mean(values)
  if (metric === 'median') return median(values)
  return nearestRankPercentile(values, 90)
}

export function DistributionFigure() {
  const [metric, setMetric] = useState<SummaryMetric>('mean')
  const summaries = useMemo(() => ({
    A: summarize(distributionRuns.A, metric),
    B: summarize(distributionRuns.B, metric),
  }), [metric])
  const winner = summaries.A <= summaries.B ? 'A' : 'B'

  return (
    <figure className="evidence-figure distribution-figure" aria-labelledby="distribution-caption">
      <header className="evidence-header">
        <div><span>SAMPLE DISTRIBUTION · 04</span><strong>换一个汇总问题，答案会翻转</strong></div>
        <div className="evidence-switch" role="group" aria-label="选择汇总方法">
          {(['mean', 'median', 'p90'] as const).map((item) => <button type="button" key={item} aria-pressed={metric === item} onClick={() => setMetric(item)}>{metricLabels[item]}</button>)}
        </div>
      </header>
      <div className="distribution-workbench">
        {(['A', 'B'] as const).map((implementation) => (
          <div className="sample-row" key={implementation} data-sample-count={distributionRuns[implementation].length}>
            <strong>{implementation}</strong>
            <div className="sample-scale" aria-label={`实现 ${implementation} 的十个原始样本`}>
              {distributionRuns[implementation].map((duration, index) => <i key={index} title={`${duration} ms`} style={{ '--sample-position': `${((duration - 75) / 90) * 100}%` } as CSSProperties}><span>{duration}</span></i>)}
            </div>
            <output className={winner === implementation ? 'is-lower' : ''}>{summaries[implementation].toFixed(1)} ms</output>
          </div>
        ))}
        <div className="distribution-verdict" aria-live="polite"><span>{metricLabels[metric]} 更低</span><strong>{winner}</strong><p>{metric === 'p90' ? '慢端判断翻转：B 的两个慢样本不能被中心值隐藏。' : '中心位置偏向 B，但原始点仍显示它的慢端风险。'}</p><small>n = 10 / 实现 · 失败数 = 0</small></div>
      </div>
      <figcaption id="distribution-caption">所有视图都保留二十个原始点。汇总值回答被选择的问题，不能代替样本分布。数据来源：simulated。</figcaption>
    </figure>
  )
}

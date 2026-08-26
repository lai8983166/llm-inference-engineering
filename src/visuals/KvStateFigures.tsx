import { useEffect, useMemo, useState } from 'react'
import {
  buildKvTrace,
  kvBytesForTokens,
  kvChapterRequests,
  kvTeachingModel,
  type KvAllocationStrategy,
  type KvMemoryEventKind,
  type KvPoolInterval,
} from '@/learning/kvStateTrace'

function reducedMotionPreferred() {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function useSteppedPlayback(maxIndex: number) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(() => !reducedMotionPreferred())

  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => setIndex((current) => (current >= maxIndex ? 0 : current + 1)), 1500)
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

type HistoryMode = 'recompute' | 'reuse'

const historyModeCopy: Record<HistoryMode, { label: string; detail: string }> = {
  recompute: {
    label: '重算历史',
    detail: '不保存任何 K/V：每一步把全部历史位置重新送入投影。算出的仍是同一批值，但用完即抛。',
  },
  reuse: {
    label: '复用历史',
    detail: '读取已保存的历史 K/V，本步只计算当前 token 的投影并追加。省下的是重复计算，不是任何被测量的时间。',
  },
}

const phaseLabels = ['当前输入', '历史 K/V', '本步中间量', '缓存写入'] as const
const phaseHints: Record<HistoryMode, readonly string[]> = {
  recompute: [
    '输入 token 进入模型，本步为它计算 query 投影。',
    '把全部历史位置重新送入各层投影，重算这批 K/V。',
    '注意力分数、context、logits：本步产生、本步消费，不跨步保留。',
    '不保存任何 K/V；下一步仍要重算更长的一段历史。',
  ],
  reuse: [
    '输入 token 进入模型，本步为它计算 query 投影。',
    '读取缓存中全部历史位置的 K/V，不重新计算它们。',
    '注意力分数、context、logits：本步产生、本步消费，不跨步保留。',
    '把本步产出 token 的 K/V 追加进缓存，供下一步读取。',
  ],
}

/** 固定 `R-long` 的三个 decode 步；每步分四个阶段展示同一次 Attention 在两条路径下的取数。 */
export function AttentionHistoryFigure() {
  const request = kvChapterRequests[0]
  const decodeCount = request.outputTokens - 1
  const [mode, setMode] = useState<HistoryMode>('recompute')
  const playback = useSteppedPlayback(decodeCount * phaseLabels.length - 1)
  const decodeIndex = Math.floor(playback.index / phaseLabels.length) + 1
  const phase = playback.index % phaseLabels.length
  const historyTokens = request.promptTokens + decodeIndex
  const cachedAfter = historyTokens + 1

  const selectMode = (value: HistoryMode) => {
    setMode(value)
    playback.reset()
  }

  return (
    <figure className="concurrency-figure kv-dependency-figure" aria-labelledby="kv-dependency-caption">
      <header className="concurrency-figure-header">
        <div><span>KV DEPENDENCY · 03</span><strong>同一步，重算历史还是复用历史</strong></div>
        <div className="concurrency-toolbar">
          <div role="group" aria-label="选择历史取数路径" className="strategy-switch">
            <button type="button" aria-pressed={mode === 'recompute'} onClick={() => selectMode('recompute')}>重算历史</button>
            <button type="button" aria-pressed={mode === 'reuse'} onClick={() => selectMode('reuse')}>复用历史</button>
          </div>
          <div role="group" aria-label="控制 decode 步与阶段" className="step-controls">
            <button type="button" onClick={playback.toggle}>{playback.playing ? '暂停动画' : '继续动画'}</button>
            <button type="button" onClick={playback.previous} disabled={playback.index === 0}>上一步</button>
            <button type="button" onClick={playback.next} disabled={playback.index === decodeCount * phaseLabels.length - 1}>下一步</button>
            <button type="button" onClick={playback.reset}>重置</button>
          </div>
        </div>
      </header>
      <div className="kv-dependency-workbench">
        <ol className="logical-step-axis kv-decode-axis" aria-label="选择 decode 步">
          {Array.from({ length: decodeCount }, (_, index) => (
            <li key={index} className={index < decodeIndex - 1 ? 'is-past' : ''}>
              <button
                type="button"
                aria-current={index === decodeIndex - 1 ? 'step' : undefined}
                onClick={() => playback.select(index * phaseLabels.length)}
              >decode {index + 1}</button>
            </li>
          ))}
        </ol>
        <div className="kv-phase-list" data-mode={mode}>
          {phaseLabels.map((label, phaseIndex) => (
            <div
              key={label}
              className={`kv-phase-row${phaseIndex <= phase ? ' is-revealed' : ''}${phaseIndex === phase ? ' is-current' : ''}`}
              data-phase={phaseIndex}
            >
              <strong>{phaseLabels[phaseIndex]}</strong>
              <p>{phaseHints[mode][phaseIndex]}</p>
            </div>
          ))}
        </div>
        <div className="trace-readout kv-dependency-readout" aria-live="polite">
          <span>decode {decodeIndex} · {phaseLabels[phase]}</span>
          <strong>{historyModeCopy[mode].label}</strong>
          <p>{historyModeCopy[mode].detail}</p>
          <dl>
            <div><dt>读取的历史位置</dt><dd>0…{historyTokens - 1}，共 {historyTokens} 个</dd></div>
            <div><dt>本步中间量</dt><dd>scores · context · logits（即抛）</dd></div>
            <div><dt>本步产出</dt><dd>y{decodeIndex + 1} 的 K/V</dd></div>
            <div><dt>复用后的缓存</dt><dd>{cachedAfter} 个 token · {kvBytesForTokens(kvTeachingModel, cachedAfter)} bytes</dd></div>
          </dl>
        </div>
      </div>
      <figcaption id="kv-dependency-caption">两条路径读取同一批位置、同一份因果可见范围，产出同一个 token：语义等价，差别只在“重算还是读取”。本图不据此声称任何速度差异——收益需要按第 00 章的合同测量。</figcaption>
    </figure>
  )
}

const eventKindLabels: Record<KvMemoryEventKind, string> = {
  arrived: '到达',
  reserved: '预留',
  appended: '追加',
  'grew-in-place': '原地扩展',
  'migration-start': '搬迁开始',
  'copy-complete': '复制完成',
  'address-published': '地址发布',
  'read-complete': '读取完成',
  released: '释放',
  rejected: '拒绝',
}

const strategyCopy: Record<KvAllocationStrategy, { label: string; detail: string }> = {
  'max-reservation': {
    label: '最大预留',
    detail: '按声明上限一次预留连续区间：地址稳定，但未用预留会挡住新请求的准入。',
  },
  'on-demand-growth': {
    label: '按需增长',
    detail: '只申请当前长度：节省预留，但尾部被占住时要走完另址申请到释放旧区间的链条。',
  },
}

const ownerMarks: Record<string, string> = { 'R-long': '长', 'R-short': '短', 'R-late': '晚' }

function cellMark(interval: KvPoolInterval, offset: number): { mark: string; role: string } {
  if (interval.role === 'free') return { mark: '空', role: 'free' }
  const owner = ownerMarks[interval.owner ?? ''] ?? '?'
  if (interval.role === 'migration-source') return { mark: `${owner}旧`, role: 'migration-source' }
  return offset < interval.usedTokens
    ? { mark: `${owner}用`, role: 'used' }
    : { mark: `${owner}留`, role: 'reserved-unused' }
}

/** 同一 24-unit 池、同一请求工作量下的两种连续分配：地址带与事件账本同步推进。 */
export function PoolIntervalFigure() {
  const [strategy, setStrategy] = useState<KvAllocationStrategy>('max-reservation')
  const trace = useMemo(() => buildKvTrace(strategy), [strategy])
  const playback = useSteppedPlayback(trace.events.length - 1)
  const event = trace.events[playback.index]
  const pool = trace.poolSnapshots[playback.index]

  const selectStrategy = (value: KvAllocationStrategy) => {
    setStrategy(value)
    playback.reset()
  }

  const cells: Array<{ address: number; mark: string; role: string; isEvent: boolean }> = []
  for (const interval of pool.intervals) {
    for (let offset = 0; offset < interval.capacityTokens; offset += 1) {
      const address = interval.start + offset
      const { mark, role } = cellMark(interval, offset)
      cells.push({
        address,
        mark,
        role,
        isEvent: event.start !== undefined && address === event.start,
      })
    }
  }

  return (
    <figure className="concurrency-figure kv-pool-figure" aria-labelledby="kv-pool-caption">
      <header className="concurrency-figure-header">
        <div><span>KV POOL INTERVALS · 03</span><strong>连续区间怎样被逼到搬迁</strong></div>
        <div className="concurrency-toolbar">
          <div role="group" aria-label="选择分配方案" className="strategy-switch">
            <button type="button" aria-pressed={strategy === 'max-reservation'} onClick={() => selectStrategy('max-reservation')}>最大预留</button>
            <button type="button" aria-pressed={strategy === 'on-demand-growth'} onClick={() => selectStrategy('on-demand-growth')}>按需增长</button>
          </div>
          <div role="group" aria-label="控制内存事件" className="step-controls">
            <button type="button" onClick={playback.toggle}>{playback.playing ? '暂停动画' : '继续动画'}</button>
            <button type="button" onClick={playback.previous} disabled={playback.index === 0}>上一步</button>
            <button type="button" onClick={playback.next} disabled={playback.index === trace.events.length - 1}>下一步</button>
            <button type="button" onClick={playback.reset}>重置</button>
          </div>
        </div>
      </header>
      <div className="kv-pool-workbench">
        <div className="address-band-scroll">
          <div className="address-ruler" aria-hidden="true">
            {cells.map((cell) => <span key={`ruler-${cell.address}`}>{cell.address}</span>)}
          </div>
          <ol className="address-band" aria-label="物理池地址带">
            {cells.map((cell) => (
              <li key={cell.address} data-role={cell.role} className={cell.isEvent ? 'is-event' : ''}>
                <span aria-hidden="true">{cell.mark}</span>
                <small>{cell.address}</small>
              </li>
            ))}
          </ol>
        </div>
        <div className="kv-pool-legend" aria-label="地址带图例">
          <span><i data-role="used" />有效 KV（用）</span>
          <span><i data-role="reserved-unused" />保留未用（留）</span>
          <span><i data-role="migration-source" />搬迁旧区间（旧）</span>
          <span><i data-role="free" />空闲（空）</span>
        </div>
        <div className="trace-readout kv-pool-readout" aria-live="polite">
          <span>e{playback.index}</span>
          <strong>{strategyCopy[strategy].label}</strong>
          <p>{strategyCopy[strategy].detail}</p>
          <dl>
            <div><dt>当前事件</dt><dd>{event.requestId} · {eventKindLabels[event.kind]}{event.start !== undefined ? ` · [${event.start}${event.tokens !== undefined ? `+${event.tokens}` : ''}]` : ''}</dd></div>
            <div><dt>池空闲</dt><dd>{pool.freeTokens} / 24 units · 最大连续 {pool.maxContiguousFreeTokens}</dd></div>
          </dl>
        </div>
        <ol className="event-ledger" aria-label="内存事件账本">
          {trace.events.map((item, index) => (
            <li key={item.sequence} className={index === playback.index ? 'is-current' : index < playback.index ? 'is-past' : ''}>
              <button type="button" aria-current={index === playback.index ? 'step' : undefined} onClick={() => playback.select(index)}>
                <span>e{item.sequence} t{item.logicalStep}</span>
                <b>{item.requestId}</b>
                <em>{eventKindLabels[item.kind]}</em>
                {item.start !== undefined && <small>[{item.start}{item.tokens !== undefined ? `+${item.tokens}` : ''}]</small>}
              </button>
            </li>
          ))}
        </ol>
      </div>
      <figcaption id="kv-pool-caption">地址带与事件账本来自同一 simulated 轨迹。unit 编址是整数教学单位，不是 CUDA 地址；释放与拒绝只说明这些规则下的容量事实，不能证明真实显存布局或性能。</figcaption>
    </figure>
  )
}

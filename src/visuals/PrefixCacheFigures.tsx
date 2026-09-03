import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  buildPrefixCacheTrace,
  hitRate,
  prefixCacheOutcome,
  type PrefixCachePolicy,
} from '@/learning/prefixCacheTrace'

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

const roleLabels: Record<string, string> = {
  free: '空',
  private: '私',
  shared: '共',
  cached: '缓',
}

/** 共享块生命周期图：块带 rc 徽章，逐拍推进显示命中、递减、转缓存与逐出。 */
export function SharedLifecycleFigure() {
  const trace = useMemo(() => buildPrefixCacheTrace('prefix-cache'), [])
  const playback = useSteppedPlayback(trace.ticks.length - 1)
  const tick = Math.min(playback.index, trace.ticks.length - 1)
  const snapshot = trace.ticks[tick]
  const tickEvents = trace.events.filter((event) => event.tick === tick)

  return (
    <figure className="concurrency-figure shared-lifecycle-figure" aria-labelledby="shared-lifecycle-caption">
      <header className="concurrency-figure-header">
        <div><span>SHARED LIFECYCLE · 10</span><strong>共享块的引用计数</strong></div>
        <div className="concurrency-toolbar">
          <div role="group" aria-label="控制观察拍" className="step-controls">
            <button type="button" onClick={playback.toggle}>{playback.playing ? '暂停动画' : '继续动画'}</button>
            <button type="button" onClick={playback.previous} disabled={tick === 0}>上一步</button>
            <button type="button" onClick={playback.next} disabled={tick >= trace.ticks.length - 1}>下一步</button>
            <button type="button" onClick={playback.reset}>重置</button>
          </div>
        </div>
      </header>
      <div className="shared-lifecycle-workbench">
        <div className="lifecycle-band-scroll">
          <div className="lifecycle-head" aria-hidden="true">
            {trace.ticks.map((item) => (
              <button key={item.tick} type="button" aria-current={item.tick === tick ? 'step' : undefined} onClick={() => playback.select(item.tick)}>t{item.tick}</button>
            ))}
          </div>
          {snapshot.blocks.map((block) => (
            <div key={block.block} className="lifecycle-row">
              <strong>B{block.block}</strong>
              {trace.ticks.map((item) => {
                const state = item.blocks[block.block]
                const role = state.role
                return (
                  <span
                    key={item.tick}
                    data-role={role}
                    data-rc={state.refCount}
                    className={item.tick === tick ? 'is-current' : ''}
                  >
                    {roleLabels[role]}
                    {(role === 'shared' || role === 'cached') ? ` rc${state.refCount}` : ''}
                  </span>
                )
              })}
            </div>
          ))}
        </div>
        <div className="lifecycle-legend" aria-label="块状态图例">
          <span><i data-role="free" />空闲</span>
          <span><i data-role="private" />私有（独占）</span>
          <span><i data-role="shared" />共享（rc ≥ 1）</span>
          <span><i data-role="cached" />缓存（rc = 0，占池可命中）</span>
        </div>
        <div className="trace-readout lifecycle-readout" aria-live="polite">
          <span>t{tick}</span>
          <strong>本拍事件</strong>
          <p>共享块的完成只递减引用；rc 归零转缓存，压力下才可能被逐出。</p>
          <dl>
            <div><dt>事件</dt>
              <dd>{tickEvents.map((event) => `${event.requestId} ${event.kind}`).join(' · ') || '无'}</dd></div>
            <div><dt>空闲块</dt><dd>{snapshot.freeBlocks} / {trace.blockCount}</dd></div>
          </dl>
        </div>
      </div>
      <figcaption id="shared-lifecycle-caption">块状态与 rc 徽章全部来自 simulated 前缀缓存轨迹；B0 走完 共享 rc1→rc2→rc1→缓存→逐出 的完整旅程。rc 与拍数是教学记账，不是真实显存或收益。</figcaption>
    </figure>
  )
}

/** 命中对照图：无缓存与前缀缓存两条时间线的空闲块条带并排。 */
export function HitAdmissionFigure() {
  const traces = useMemo(() => ({
    'no-cache': buildPrefixCacheTrace('no-cache' as PrefixCachePolicy),
    'prefix-cache': buildPrefixCacheTrace('prefix-cache' as PrefixCachePolicy),
  }), [])
  const outcomes = useMemo(() => ({
    'no-cache': prefixCacheOutcome(traces['no-cache']),
    'prefix-cache': prefixCacheOutcome(traces['prefix-cache']),
  }), [traces])
  const rate = useMemo(() => hitRate(traces['prefix-cache']), [traces])
  const [policy, setPolicy] = useState<PrefixCachePolicy>('no-cache')
  const active = traces[policy]
  const playback = useSteppedPlayback(Math.max(traces['no-cache'].ticks.length, traces['prefix-cache'].ticks.length) - 1)
  const tick = playback.index

  return (
    <figure className="concurrency-figure hit-admission-figure" aria-labelledby="hit-admission-caption">
      <header className="concurrency-figure-header">
        <div><span>HIT ADMISSION · 10</span><strong>命中改写准入</strong></div>
        <div className="concurrency-toolbar">
          <div role="group" aria-label="选择策略" className="strategy-switch">
            <button type="button" aria-pressed={policy === 'no-cache'} onClick={() => { setPolicy('no-cache'); playback.reset() }}>无缓存</button>
            <button type="button" aria-pressed={policy === 'prefix-cache'} onClick={() => { setPolicy('prefix-cache'); playback.reset() }}>前缀缓存</button>
          </div>
          <div role="group" aria-label="控制观察拍" className="step-controls">
            <button type="button" onClick={playback.toggle}>{playback.playing ? '暂停动画' : '继续动画'}</button>
            <button type="button" onClick={playback.previous} disabled={tick === 0}>上一步</button>
            <button type="button" onClick={playback.next} disabled={tick >= active.ticks.length - 1}>下一步</button>
            <button type="button" onClick={playback.reset}>重置</button>
          </div>
        </div>
      </header>
      <div className="hit-admission-workbench">
        <div className="hit-strip-scroll">
          <div className="hit-strip-head" style={{ '--hit-columns': active.ticks.length } as CSSProperties}>
            {active.ticks.map((item) => (
              <button key={item.tick} type="button" aria-current={item.tick === tick ? 'step' : undefined} onClick={() => playback.select(item.tick)}>t{item.tick}</button>
            ))}
          </div>
          <div className="hit-strip-row">
            <strong>空闲</strong>
            {active.ticks.map((item) => (
              <div key={item.tick} className={`strip-cell${item.tick === tick ? ' is-current' : ''}`}>
                <span data-level={item.freeBlocks}>{item.freeBlocks}</span>
                <i data-empty={item.freeBlocks === 0 ? 'true' : undefined} style={{ '--fill': item.freeBlocks / active.blockCount } as CSSProperties} />
              </div>
            ))}
          </div>
          <div className="hit-strip-row">
            <strong>事件</strong>
            {active.ticks.map((item) => {
              const marks = active.events
                .filter((event) => event.tick === item.tick && ['prefix-hit', 'prefix-miss', 'block-evicted'].includes(event.kind))
                .map((event) => event.requestId + (event.kind === 'prefix-hit' ? ' 命中' : event.kind === 'prefix-miss' ? ' 首算' : ' 逐出'))
              return <span key={item.tick}>{marks.length > 0 ? marks.join('；') : '·'}</span>
            })}
          </div>
        </div>
        <div className="trace-readout hit-admission-readout" aria-live="polite">
          <span>{policy === 'no-cache' ? '无缓存' : '前缀缓存'}</span>
          <strong>{policy === 'no-cache' ? 'S-c 排队一拍，t3 准入' : 'S-b 命中省 1 块，S-c 当拍准入'}</strong>
          <p>{policy === 'no-cache'
            ? 'S-a/S-b 各自完整 prefill：t2 空闲只剩 1，S-c 排队等到 t3。'
            : 'S-b 命中只拿 1 块：t2 空闲还剩 2，S-c 当拍准入并完成；t6 S-d 需 5 块逐出缓存块。'}</p>
          <dl>
            {outcomes[policy].map((row) => (
              <div key={row.requestId}><dt>{row.requestId}</dt>
                <dd>首执行 t{row.firstExecutionTick} · 完成 t{row.completionTick}{row.hit ? ' · 命中' : ''}</dd></div>
            ))}
            {policy === 'prefix-cache' && (
              <div><dt>命中率</dt><dd>{rate.hits}/{rate.eligible} = {rate.rate}</dd></div>
            )}
          </dl>
        </div>
      </div>
      <figcaption id="hit-admission-caption">两条时间线来自同一工作量与池的 simulated 轨迹。命中省下的是块与准入拍，不是时间；命中率 1/2 是构造值，真实收益必须实测。</figcaption>
    </figure>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { buildBlockPoolTrace, blockPoolTeachingFixture } from '@/learning/blockPoolTrace'
import { buildKvTrace, type KvMemoryEventKind } from '@/learning/kvStateTrace'
import type { KvPoolInterval } from '@/learning/kvStateTrace'

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

type TranslationMode = 'contiguous' | 'block-table'

const translationModeCopy: Record<TranslationMode, { label: string; detail: string }> = {
  contiguous: {
    label: '连续区间直读',
    detail: '存储是一段连续区间：位置 p 的地址由基地址加 p 直接得到，不需要查表。',
  },
  'block-table': {
    label: '块表翻译',
    detail: '存储散布在块里：先算逻辑块 ⌊p/B⌋，查表项得到物理块，再加块内偏移。多出的每一步都是间接层。',
  },
}

/** 固定 `R-long` 完成态（表 [B0,B1,B2]，10 个 token），沿一次 decode 逐位置展示读取的翻译路径。 */
export function BlockTableTranslationFigure() {
  const trace = useMemo(() => buildBlockPoolTrace(), [])
  const completion = useMemo(() => {
    const snapshot = trace.tableSnapshots.find(
      (item) => item.requestId === 'R-long' && item.cachedTokens === 10,
    )!
    return snapshot
  }, [trace])
  const blockSize = blockPoolTeachingFixture.blockSizeTokens
  const positions = completion.cachedTokens
  const [mode, setMode] = useState<TranslationMode>('contiguous')
  const playback = useSteppedPlayback(positions - 1)
  const position = playback.index
  const logicalBlock = Math.floor(position / blockSize)
  const offset = position % blockSize
  const physicalBlock = completion.table[logicalBlock]

  const selectMode = (value: TranslationMode) => {
    setMode(value)
    playback.reset()
  }

  return (
    <figure className="concurrency-figure block-table-figure" aria-labelledby="block-table-caption">
      <header className="concurrency-figure-header">
        <div><span>BLOCK TABLE TRANSLATION · 04</span><strong>块表怎样翻译一次读取</strong></div>
        <div className="concurrency-toolbar">
          <div role="group" aria-label="选择存储布局" className="strategy-switch">
            <button type="button" aria-pressed={mode === 'contiguous'} onClick={() => selectMode('contiguous')}>连续区间直读</button>
            <button type="button" aria-pressed={mode === 'block-table'} onClick={() => selectMode('block-table')}>块表翻译</button>
          </div>
          <div role="group" aria-label="控制读取位置" className="step-controls">
            <button type="button" onClick={playback.toggle}>{playback.playing ? '暂停动画' : '继续动画'}</button>
            <button type="button" onClick={playback.previous} disabled={playback.index === 0}>上一步</button>
            <button type="button" onClick={playback.next} disabled={playback.index === positions - 1}>下一步</button>
            <button type="button" onClick={playback.reset}>重置</button>
          </div>
        </div>
      </header>
      <div className="block-table-workbench">
        <ol className="logical-position-band" aria-label="逻辑位置带">
          {Array.from({ length: positions }, (_, index) => (
            <li
              key={index}
              className={index === position ? 'is-current' : index < position ? 'is-past' : ''}
            >p{index}</li>
          ))}
        </ol>
        <div className="translation-lanes" data-mode={mode}>
          <div className="translation-lane">
            <strong>逻辑块与偏移</strong>
            <p>位置 p{position} → 逻辑块 {logicalBlock}（⌊p/{blockSize}⌋），偏移 {offset}（p mod {blockSize}）。</p>
          </div>
          <div className="translation-lane block-table-lane">
            <strong>块表（`R-long`）</strong>
            <ol aria-label="块表内容">
              {completion.table.map((block, index) => (
                <li key={block} className={index === logicalBlock ? 'is-current' : ''}>
                  <span>表项 {index}</span><b>→ B{block}</b>
                </li>
              ))}
            </ol>
          </div>
          <div className="translation-lane">
            <strong>物理块</strong>
            <ol className="physical-block-row" aria-label="物理块占用">
              {trace.poolSnapshots[completion.afterEventSequence].blocks.map((lease) => {
                const owner = lease.owner === 'R-long' ? '长' : lease.owner === null ? '空' : lease.owner
                return (
                  <li
                    key={lease.block}
                    data-owner={lease.owner === null ? 'free' : 'held'}
                    className={lease.block === physicalBlock && mode === 'block-table' ? 'is-hit' : ''}
                  >
                    <span>B{lease.block}</span>
                    <small>{lease.owner === null ? '空闲' : `${owner} ${lease.usedTokens}/${blockSize}`}</small>
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
        <div className="trace-readout block-table-readout" aria-live="polite">
          <span>p{position}</span>
          <strong>{translationModeCopy[mode].label}</strong>
          <p>{translationModeCopy[mode].detail}</p>
          <dl>
            <div><dt>读取的位置</dt><dd>p{position}（历史 0…{positions - 1} 中的第 {position + 1} 个）</dd></div>
            <div><dt>本次翻译</dt>
              <dd>{mode === 'contiguous'
                ? `直读：基地址 + p${position}`
                : `查表项 ${logicalBlock} → B${physicalBlock}，偏移 ${offset}`}</dd>
            </div>
            <div><dt>累计表查询</dt><dd>{mode === 'contiguous' ? 0 : position + 1} 次</dd></div>
            <div><dt>语义</dt><dd>两条路径读到的 K/V 相同</dd></div>
          </dl>
        </div>
      </div>
      <figcaption id="block-table-caption">两条路径沿同一批逻辑位置读取同一份 K/V：语义相同，差别只在翻译步骤。表查询次数是计数不是耗时；本图不据此声称任何速度差异。</figcaption>
    </figure>
  )
}

type PoolMode = 'contiguous' | 'block-pool'

const poolModeCopy: Record<PoolMode, { label: string; detail: string }> = {
  contiguous: {
    label: '连续按需',
    detail: '第 03 章布局：整段区间申请，尾部被占住时要走另址申请到释放的搬迁链条。',
  },
  'block-pool': {
    label: '固定块池',
    detail: '本章布局：按块分配，任何空闲块可服务任何增长；完成与取消整块归还。',
  },
}

const contiguousEventLabels: Record<KvMemoryEventKind, string> = {
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

const blockEventLabels: Record<string, string> = {
  arrived: '到达',
  'block-allocated': '分配块',
  'table-entry': '表项登记',
  appended: '追加',
  'read-complete': '读取完成',
  'block-released': '整块释放',
  rejected: '拒绝',
}

const ownerShort: Record<string, string> = { 'R-long': '长', 'R-short': '短', 'R-late': '晚' }

function contiguousUnitMark(interval: KvPoolInterval, offset: number): { mark: string; role: string } {
  if (interval.role === 'free') return { mark: '空', role: 'free' }
  const owner = ownerShort[interval.owner ?? ''] ?? '?'
  if (interval.role === 'migration-source') return { mark: `${owner}旧`, role: 'migration-source' }
  return offset < interval.usedTokens
    ? { mark: `${owner}用`, role: 'used' }
    : { mark: `${owner}留`, role: 'reserved-unused' }
}

/** 同一 24-unit 池、同一请求工作量的两种结局：连续按需轨迹对照块池轨迹。 */
export function BlockPoolEvolutionFigure() {
  const blockTrace = useMemo(() => buildBlockPoolTrace(), [])
  const contiguousTrace = useMemo(() => buildKvTrace('on-demand-growth'), [])
  const [mode, setMode] = useState<PoolMode>('block-pool')
  const eventCount = mode === 'block-pool' ? blockTrace.events.length : contiguousTrace.events.length
  const playback = useSteppedPlayback(eventCount - 1)

  const events = mode === 'block-pool' ? blockTrace.events : contiguousTrace.events
  const event = events[Math.min(playback.index, events.length - 1)]
  const pool = mode === 'block-pool'
    ? blockTrace.poolSnapshots[Math.min(playback.index, blockTrace.poolSnapshots.length - 1)]
    : contiguousTrace.poolSnapshots[Math.min(playback.index, contiguousTrace.poolSnapshots.length - 1)]

  const selectMode = (value: PoolMode) => {
    setMode(value)
    playback.reset()
  }

  const migrationCount = mode === 'block-pool'
    ? 0
    : contiguousTrace.events.filter((item) => item.kind === 'migration-start').length
  const rejectionCount = events.filter((item) => item.kind === 'rejected').length
  const eventBlock = 'block' in event ? event.block : undefined
  const eventStart = 'start' in event ? event.start : undefined
  const eventTokens = 'tokens' in event ? event.tokens : undefined

  return (
    <figure className="concurrency-figure block-pool-figure" aria-labelledby="block-pool-caption">
      <header className="concurrency-figure-header">
        <div><span>BLOCK POOL EVOLUTION · 04</span><strong>同一池的第三种结局</strong></div>
        <div className="concurrency-toolbar">
          <div role="group" aria-label="选择布局" className="strategy-switch">
            <button type="button" aria-pressed={mode === 'block-pool'} onClick={() => selectMode('block-pool')}>固定块池</button>
            <button type="button" aria-pressed={mode === 'contiguous'} onClick={() => selectMode('contiguous')}>连续按需</button>
          </div>
          <div role="group" aria-label="控制内存事件" className="step-controls">
            <button type="button" onClick={playback.toggle}>{playback.playing ? '暂停动画' : '继续动画'}</button>
            <button type="button" onClick={playback.previous} disabled={playback.index === 0}>上一步</button>
            <button type="button" onClick={playback.next} disabled={playback.index >= events.length - 1}>下一步</button>
            <button type="button" onClick={playback.reset}>重置</button>
          </div>
        </div>
      </header>
      <div className="kv-pool-workbench block-pool-workbench">
        <div className="address-band-scroll">
          <div className="address-ruler" aria-hidden="true">
            {mode === 'block-pool'
              ? Array.from({ length: blockTrace.fixture.blockCount }, (_, index) => <span key={index}>B{index}</span>)
              : Array.from({ length: 24 }, (_, index) => <span key={index}>{index}</span>)}
          </div>
          <ol className="address-band block-mode-band" data-mode={mode} aria-label="物理池">
            {mode === 'block-pool'
              ? (pool as typeof blockTrace.poolSnapshots[number]).blocks.map((lease) => (
                <li
                  key={lease.block}
                  data-role={lease.owner === null ? 'free' : 'held'}
                  data-reused={lease.generation > 1 ? 'true' : undefined}
                  className={eventBlock === lease.block ? 'is-event' : ''}
                >
                  <span aria-hidden="true">{lease.owner === null ? '空' : `${ownerShort[lease.owner] ?? '?'} ${lease.usedTokens}/${blockTrace.fixture.blockSizeTokens}`}</span>
                  <small>B{lease.block}{lease.generation > 1 ? ` · 复用×${lease.generation - 1}` : ''}</small>
                </li>
              ))
              : (pool as typeof contiguousTrace.poolSnapshots[number]).intervals.flatMap((interval) =>
                Array.from({ length: interval.capacityTokens }, (_, offset) => {
                  const address = interval.start + offset
                  const { mark, role } = contiguousUnitMark(interval, offset)
                  return (
                    <li key={address} data-role={role} className={eventStart === address ? 'is-event' : ''}>
                      <span aria-hidden="true">{mark}</span>
                      <small>{address}</small>
                    </li>
                  )
                }),
              )}
          </ol>
        </div>
        <div className="kv-pool-legend" aria-label="地址带图例">
          {mode === 'block-pool' ? <>
            <span><i data-role="held" />持有（所有者 用量/容量）</span>
            <span><i data-role="free" />空闲块</span>
            <span><i data-reused="true" />跨请求复用过的块</span>
          </> : <>
            <span><i data-role="used" />有效 KV（用）</span>
            <span><i data-role="reserved-unused" />按需余位（留）</span>
            <span><i data-role="migration-source" />搬迁旧区间（旧）</span>
            <span><i data-role="free" />空闲（空）</span>
          </>}
        </div>
        <div className="trace-readout block-pool-readout" aria-live="polite">
          <span>e{playback.index}</span>
          <strong>{poolModeCopy[mode].label}</strong>
          <p>{poolModeCopy[mode].detail}</p>
          <dl>
            <div><dt>当前事件</dt>
              <dd>{event.requestId} · {mode === 'block-pool'
                ? `${blockEventLabels[event.kind]}${eventBlock !== undefined ? ` · B${eventBlock}` : ''}`
                : `${contiguousEventLabels[event.kind as KvMemoryEventKind]}${eventStart !== undefined ? ` · [${eventStart}${eventTokens !== undefined ? `+${eventTokens}` : ''}]` : ''}`}</dd>
            </div>
            <div><dt>池状态</dt>
              <dd>{mode === 'block-pool'
                ? `空闲 ${(pool as typeof blockTrace.poolSnapshots[number]).freeBlocks}/${blockTrace.fixture.blockCount} 块 · 内部浪费 ${(pool as typeof blockTrace.poolSnapshots[number]).internalWasteTokens} unit`
                : `空闲 ${(pool as typeof contiguousTrace.poolSnapshots[number]).freeTokens}/24 unit · 最大连续 ${(pool as typeof contiguousTrace.poolSnapshots[number]).maxContiguousFreeTokens}`}</dd>
            </div>
            <div><dt>累计搬迁</dt><dd>{migrationCount} 次</dd></div>
            <div><dt>累计拒绝</dt><dd>{rejectionCount} 次</dd></div>
          </dl>
        </div>
        <ol className="event-ledger" aria-label="内存事件账本">
          {events.map((item, index) => (
            <li key={item.sequence} className={index === playback.index ? 'is-current' : index < playback.index ? 'is-past' : ''}>
              <button type="button" aria-current={index === playback.index ? 'step' : undefined} onClick={() => playback.select(index)}>
                <span>e{item.sequence} t{item.logicalStep}</span>
                <b>{item.requestId}</b>
                <em>{mode === 'block-pool'
                  ? `${blockEventLabels[item.kind]}${'block' in item && item.block !== undefined ? ` B${item.block}` : ''}`
                  : `${contiguousEventLabels[item.kind as KvMemoryEventKind]}${'start' in item && item.start !== undefined ? ` [${item.start}]` : ''}`}</em>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <figcaption id="block-pool-caption">两种布局来自同一 simulated 请求工作量与同一 24-unit 池。块编号与表项是整数教学单位，不是真实显存块地址；搬迁与拒绝计数只说明这些规则下的容量事实，不能证明真实显存行为或性能。</figcaption>
    </figure>
  )
}

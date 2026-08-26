export type KvAllocationStrategy = 'max-reservation' | 'on-demand-growth'
export type KvPhase = 'not-arrived' | 'prefill' | 'decode' | 'finished' | 'rejected'
export type KvIntervalRole = 'primary' | 'migration-source' | 'free'
export type KvCapacityFailureCategory =
  | 'effective-capacity'
  | 'over-reservation'
  | 'migration-peak'
  | 'external-fragmentation'

export type KvMemoryEventKind =
  | 'arrived'
  | 'reserved'
  | 'appended'
  | 'grew-in-place'
  | 'migration-start'
  | 'copy-complete'
  | 'address-published'
  | 'read-complete'
  | 'released'
  | 'rejected'

/** 固定教学模型：层数、query/KV heads、head dimension 与每元素字节数。 */
export interface KvModelFixture {
  layers: number
  queryHeads: number
  kvHeads: number
  headDim: number
  dtypeBytes: number
}

/** 请求声明自己的最大上下文；实际终止沿用第 02 章原因。 */
export interface KvRequestFixture {
  id: string
  arrivalStep: number
  promptTokens: number
  outputTokens: number
  maxContextTokens: number
  terminalReason: 'eos' | 'length'
}

/** 请求对某个物理区间的租约视图。 */
export interface KvAllocation {
  owner: string
  start: number
  capacityTokens: number
  usedTokens: number
  generation: number
}

export interface KvMemoryEvent {
  sequence: number
  logicalStep: number
  requestId: string
  kind: KvMemoryEventKind
  /** 事件涉及的 token 数（追加后的缓存长度、预留容量或被拒申请量）。 */
  tokens?: number
  /** 事件涉及的区间起点（预留、增长、发布、释放）。 */
  start?: number
  /** 搬迁事件涉及的旧地址。 */
  previousStart?: number
  evidence: 'simulated'
}

export interface KvRequestSnapshot {
  afterEventSequence: number
  logicalStep: number
  requestId: string
  phase: KvPhase
  cachedTokens: number
  effectiveBytes: number
  reservedTokens: number
  reservedBytes: number
  address: number | null
  inFlightReads: number
  released: boolean
}

export interface KvPoolInterval {
  start: number
  capacityTokens: number
  usedTokens: number
  owner: string | null
  generation: number
  role: KvIntervalRole
}

export interface KvPoolSnapshot {
  afterEventSequence: number
  logicalStep: number
  intervals: readonly KvPoolInterval[]
  totalTokens: number
  freeTokens: number
  maxContiguousFreeTokens: number
}

export interface KvTrace {
  strategy: KvAllocationStrategy
  evidence: 'simulated'
  model: KvModelFixture
  requests: readonly KvRequestFixture[]
  poolCapacityTokens: number
  events: readonly KvMemoryEvent[]
  snapshots: readonly KvRequestSnapshot[]
  poolSnapshots: readonly KvPoolSnapshot[]
}

/**
 * 教学模型：4 层、8 query heads、2 KV heads、head dim 4、每元素 2 bytes。
 * queryHeads 故意多于 kvHeads，形成 GQA 反例：字节账本必须代入 KV heads。
 */
export const kvTeachingModel: KvModelFixture = {
  layers: 4,
  queryHeads: 8,
  kvHeads: 2,
  headDim: 4,
  dtypeBytes: 2,
}

/** 延续第 02 章请求身份与工作量，新增声明的最大上下文。 */
export const kvChapterRequests: readonly KvRequestFixture[] = [
  { id: 'R-long', arrivalStep: 0, promptTokens: 6, outputTokens: 4, maxContextTokens: 16, terminalReason: 'eos' },
  { id: 'R-short', arrivalStep: 1, promptTokens: 2, outputTokens: 1, maxContextTokens: 16, terminalReason: 'eos' },
  { id: 'R-late', arrivalStep: 3, promptTokens: 4, outputTokens: 2, maxContextTokens: 8, terminalReason: 'length' },
]

/** 教学物理池：24 个 token unit，每 unit 等于固定模型的 128 bytes。 */
export const kvPoolCapacityTokens = 24

/** 每 token 有效 KV 字节数 = 层数 × 2(K,V) × KV heads × head dim × 每元素字节数。 */
export function kvBytesPerToken(model: KvModelFixture): number {
  return model.layers * 2 * model.kvHeads * model.headDim * model.dtypeBytes
}

/** 请求在某个 token 数下的有效 KV 字节数。 */
export function kvBytesForTokens(model: KvModelFixture, tokens: number): number {
  return tokens * kvBytesPerToken(model)
}

/** 请求完成态缓存 token 数：prompt + 全部输出（最后输出的 K/V 也写入缓存）。 */
export function kvCompletionTokens(request: KvRequestFixture): number {
  return request.promptTokens + request.outputTokens
}

/** 池快照中某请求的当前主区间租约；无主区间（未准入或已释放）时为 null。 */
export function primaryAllocationOf(pool: KvPoolSnapshot, requestId: string): KvAllocation | null {
  const interval = pool.intervals.find((item) => item.owner === requestId && item.role === 'primary')
  if (!interval) return null
  return {
    owner: interval.owner as string,
    start: interval.start,
    capacityTokens: interval.capacityTokens,
    usedTokens: interval.usedTokens,
    generation: interval.generation,
  }
}

/**
 * 从原始区间判断一次无法满足的连续申请属于哪类容量失败：
 * - effective-capacity：即使全部空闲连续、未用预留与搬迁副本全部归还也放不下；
 * - migration-peak：失败由搬迁期间旧、新区间双份存活造成；
 * - over-reservation：失败由已保留未用的预留空间造成；
 * - external-fragmentation：空闲总量足够但没有足够大的连续区间。
 * 申请能被当前最大连续空闲满足时返回 null。
 */
export function classifyCapacityFailure(
  intervals: readonly KvPoolInterval[],
  demandTokens: number,
  poolCapacityTokens: number,
): KvCapacityFailureCategory | null {
  const free = intervals.filter((interval) => interval.role === 'free')
  const freeTokens = free.reduce((total, interval) => total + interval.capacityTokens, 0)
  const maxContiguousFree = free.reduce((max, interval) => Math.max(max, interval.capacityTokens), 0)
  if (demandTokens <= maxContiguousFree) return null
  if (demandTokens <= freeTokens) return 'external-fragmentation'

  const primaries = intervals.filter((interval) => interval.owner !== null && interval.role === 'primary')
  // 搬迁副本与主区间是同一批逻辑 token，有效占用只按主区间统计。
  const effectiveTokens = primaries.reduce((total, interval) => total + interval.usedTokens, 0)
  const unusedReservation = primaries.reduce((total, interval) => total + interval.capacityTokens - interval.usedTokens, 0)
  const migrationSource = intervals.find((interval) => interval.owner !== null && interval.role === 'migration-source')
  if (effectiveTokens + demandTokens > poolCapacityTokens) return 'effective-capacity'
  if (migrationSource && freeTokens + migrationSource.capacityTokens >= demandTokens) return 'migration-peak'
  if (unusedReservation >= demandTokens - freeTokens) return 'over-reservation'
  return 'effective-capacity'
}

interface MutableRequestState {
  phase: KvPhase
  cachedTokens: number
  generatedTokens: number
  address: number | null
  generation: number
  inFlightReads: number
  released: boolean
}

interface KvTraceBuilder {
  model: KvModelFixture
  fixtures: readonly KvRequestFixture[]
  poolCapacityTokens: number
  events: KvMemoryEvent[]
  snapshots: KvRequestSnapshot[]
  poolSnapshots: KvPoolSnapshot[]
  states: Map<string, MutableRequestState>
  intervals: KvPoolInterval[]
  emit: (logicalStep: number, requestId: string, kind: KvMemoryEventKind, details?: Pick<KvMemoryEvent, 'tokens' | 'start' | 'previousStart'>) => void
}

function assertFixtures(model: KvModelFixture, fixtures: readonly KvRequestFixture[], poolCapacityTokens: number) {
  void model
  const ids = new Set<string>()
  for (const fixture of fixtures) {
    if (!fixture.id || ids.has(fixture.id)) throw new Error('请求标识必须存在且唯一。')
    if (!Number.isInteger(fixture.arrivalStep) || fixture.arrivalStep < 0) throw new Error('到达步必须是非负整数。')
    if (!Number.isInteger(fixture.promptTokens) || fixture.promptTokens < 1) throw new Error('prompt token 数必须是正整数。')
    if (!Number.isInteger(fixture.outputTokens) || fixture.outputTokens < 1) throw new Error('输出 token 数必须是正整数。')
    if (fixture.maxContextTokens < kvCompletionTokens(fixture)) {
      throw new Error(`请求 ${fixture.id} 声明的最大上下文必须覆盖其完成态 token 数。`)
    }
    if (kvCompletionTokens(fixture) > poolCapacityTokens) {
      throw new Error(`请求 ${fixture.id} 的完成态有效 KV 超出物理池。`)
    }
    ids.add(fixture.id)
  }
}

function sortedIntervals(intervals: KvPoolInterval[]): KvPoolInterval[] {
  return [...intervals].sort((a, b) => a.start - b.start)
}

/** 合并相邻空闲区间，保证 maxContiguousFreeTokens 反映真实连续空闲。 */
function coalesceFree(builder: KvTraceBuilder) {
  builder.intervals = sortedIntervals(builder.intervals)
  const merged: KvPoolInterval[] = []
  for (const interval of builder.intervals) {
    const last = merged[merged.length - 1]
    if (
      interval.role === 'free'
      && last?.role === 'free'
      && last.start + last.capacityTokens === interval.start
    ) {
      last.capacityTokens += interval.capacityTokens
      continue
    }
    merged.push({ ...interval })
  }
  builder.intervals = merged
}

function makeBuilder(model: KvModelFixture, fixtures: readonly KvRequestFixture[], poolCapacityTokens: number): KvTraceBuilder {
  const bytesPerToken = kvBytesPerToken(model)
  const builder: KvTraceBuilder = {
    model,
    fixtures,
    poolCapacityTokens,
    events: [],
    snapshots: [],
    poolSnapshots: [],
    states: new Map(fixtures.map((fixture) => [fixture.id, {
      phase: 'not-arrived' as KvPhase,
      cachedTokens: 0,
      generatedTokens: 0,
      address: null,
      generation: 0,
      inFlightReads: 0,
      released: false,
    }])),
    intervals: [{ start: 0, capacityTokens: poolCapacityTokens, usedTokens: 0, owner: null, generation: 0, role: 'free' }],
    emit(logicalStep, requestId, kind, details = {}) {
      builder.events.push({ sequence: builder.events.length, logicalStep, requestId, kind, ...details, evidence: 'simulated' })
      const free = builder.intervals.filter((interval) => interval.role === 'free')
      builder.poolSnapshots.push({
        afterEventSequence: builder.events.length - 1,
        logicalStep,
        intervals: builder.intervals.map((interval) => ({ ...interval })),
        totalTokens: poolCapacityTokens,
        freeTokens: free.reduce((total, interval) => total + interval.capacityTokens, 0),
        maxContiguousFreeTokens: free.reduce((max, interval) => Math.max(max, interval.capacityTokens), 0),
      })
      for (const fixture of fixtures) {
        const state = builder.states.get(fixture.id)!
        const primary = builder.intervals.find((interval) => interval.owner === fixture.id && interval.role === 'primary')
        builder.snapshots.push({
          afterEventSequence: builder.events.length - 1,
          logicalStep,
          requestId: fixture.id,
          phase: state.phase,
          cachedTokens: state.cachedTokens,
          effectiveBytes: state.cachedTokens * bytesPerToken,
          reservedTokens: primary ? primary.capacityTokens : 0,
          reservedBytes: (primary ? primary.capacityTokens : 0) * bytesPerToken,
          address: state.address,
          inFlightReads: state.inFlightReads,
          released: state.released,
        })
      }
    },
  }
  return builder
}

/** 从第一个能整体容纳 demand 的空闲区间中切出一段租给 owner。 */
function carve(builder: KvTraceBuilder, demand: number, owner: string, generation: number): number | null {
  const fit = builder.intervals.find(
    (interval) => interval.role === 'free' && interval.capacityTokens >= demand,
  )
  if (!fit) return null
  const start = fit.start
  const next: KvPoolInterval[] = []
  if (fit.capacityTokens > demand) {
    next.push({ ...fit, start: start + demand, capacityTokens: fit.capacityTokens - demand })
  }
  next.push({ start, capacityTokens: demand, usedTokens: 0, owner, generation, role: 'primary' })
  builder.intervals = sortedIntervals([...builder.intervals.filter((interval) => interval !== fit), ...next])
  return start
}

/** 归还一个区间；只在归还时合并相邻空闲。 */
function releaseInterval(builder: KvTraceBuilder, start: number, capacityTokens: number) {
  const interval = builder.intervals.find(
    (item) => item.owner !== null && item.start === start && item.capacityTokens === capacityTokens,
  )
  if (!interval) throw new Error(`没有找到始于 ${start}、容量 ${capacityTokens} 的租约区间。`)
  interval.owner = null
  interval.usedTokens = 0
  interval.generation = 0
  interval.role = 'free'
  coalesceFree(builder)
}

function primaryOf(builder: KvTraceBuilder, requestId: string): KvPoolInterval {
  const interval = builder.intervals.find((item) => item.owner === requestId && item.role === 'primary')
  if (!interval) throw new Error(`请求 ${requestId} 没有主区间。`)
  return interval
}

/** 完成裁决：最后一次读取结束后归还自己的区间，不影响其他请求。 */
function finishRequest(builder: KvTraceBuilder, logicalStep: number, fixture: KvRequestFixture) {
  const state = builder.states.get(fixture.id)!
  state.phase = 'finished'
  const interval = primaryOf(builder, fixture.id)
  builder.emit(logicalStep, fixture.id, 'read-complete', { start: interval.start })
  state.inFlightReads = 0
  releaseInterval(builder, interval.start, interval.capacityTokens)
  state.released = true
  state.address = null
  builder.emit(logicalStep, fixture.id, 'released', { start: interval.start, tokens: interval.capacityTokens })
}

function buildMaxReservationTrace(builder: KvTraceBuilder) {
  const { fixtures } = builder
  let logicalStep = 0
  while ([...builder.states.values()].some((state) => state.phase !== 'finished' && state.phase !== 'rejected')) {
    const arrivedThisStep = new Set<string>()
    const finishers: KvRequestFixture[] = []

    for (const fixture of fixtures) {
      const state = builder.states.get(fixture.id)!
      if (state.phase !== 'not-arrived' || fixture.arrivalStep > logicalStep) continue
      state.phase = 'prefill'
      builder.emit(logicalStep, fixture.id, 'arrived')
      arrivedThisStep.add(fixture.id)
      const demand = fixture.maxContextTokens
      const start = carve(builder, demand, fixture.id, state.generation)
      if (start === null) {
        state.phase = 'rejected'
        builder.emit(logicalStep, fixture.id, 'rejected', { tokens: demand })
        continue
      }
      state.phase = 'prefill'
      state.address = start
      state.cachedTokens = fixture.promptTokens + 1
      state.generatedTokens = 1
      builder.emit(logicalStep, fixture.id, 'reserved', { start, tokens: demand })
      const interval = primaryOf(builder, fixture.id)
      interval.usedTokens = state.cachedTokens
      builder.emit(logicalStep, fixture.id, 'appended', { start, tokens: state.cachedTokens })
      if (state.generatedTokens === fixture.outputTokens) {
        state.inFlightReads = 1
        finishers.push(fixture)
      } else {
        state.phase = 'decode'
      }
    }

    for (const fixture of fixtures) {
      const state = builder.states.get(fixture.id)!
      if (state.phase !== 'decode' || arrivedThisStep.has(fixture.id)) continue
      state.cachedTokens += 1
      state.generatedTokens += 1
      const interval = primaryOf(builder, fixture.id)
      interval.usedTokens = state.cachedTokens
      builder.emit(logicalStep, fixture.id, 'appended', { start: interval.start, tokens: state.cachedTokens })
      if (state.generatedTokens === fixture.outputTokens) {
        state.inFlightReads = 1
        finishers.push(fixture)
      }
    }

    // 步末统一裁决完成：区间在整个 decode 阶段保持持有，读取结束后才释放。
    for (const fixture of finishers) finishRequest(builder, logicalStep, fixture)
    logicalStep += 1
  }
}

function buildOnDemandGrowthTrace(builder: KvTraceBuilder) {
  const { fixtures } = builder
  let logicalStep = 0

  const appendToken = (step: number, fixture: KvRequestFixture, state: MutableRequestState) => {
    const interval = primaryOf(builder, fixture.id)
    const needed = state.cachedTokens + 1
    const tail = builder.intervals.find(
      (item) => item.role === 'free' && item.start === interval.start + interval.capacityTokens,
    )
    if (tail) {
      // 原地扩展：吸收紧邻的一个空闲 unit，地址不变。
      if (tail.capacityTokens > 1) {
        tail.start += 1
        tail.capacityTokens -= 1
      } else {
        builder.intervals = builder.intervals.filter((item) => item !== tail)
      }
      interval.capacityTokens += 1
      interval.usedTokens = needed
      state.cachedTokens = needed
      builder.emit(step, fixture.id, 'grew-in-place', { start: interval.start, tokens: needed })
      return
    }
    // 尾部被占用：另址申请 → 双份存活 → 复制 → 发布 → 等在途读取 → 释放旧区间。
    const freshStart = carve(builder, needed, fixture.id, state.generation + 1)
    if (freshStart === null) {
      state.phase = 'rejected'
      builder.emit(step, fixture.id, 'rejected', { tokens: needed })
      return
    }
    const oldStart = interval.start
    const oldCapacity = interval.capacityTokens
    interval.role = 'migration-source'
    state.generation += 1
    state.inFlightReads = 1
    builder.emit(step, fixture.id, 'migration-start', { start: freshStart, previousStart: oldStart, tokens: needed })
    const fresh = primaryOf(builder, fixture.id)
    fresh.usedTokens = needed
    builder.emit(step, fixture.id, 'copy-complete', { start: freshStart, previousStart: oldStart, tokens: needed })
    // 地址发布后新区间成为权威状态；发布前任一步失败，旧地址仍是权威。
    state.address = freshStart
    state.cachedTokens = needed
    builder.emit(step, fixture.id, 'address-published', { start: freshStart, previousStart: oldStart, tokens: needed })
    builder.emit(step, fixture.id, 'read-complete', { start: oldStart })
    state.inFlightReads = 0
    releaseInterval(builder, oldStart, oldCapacity)
    builder.emit(step, fixture.id, 'released', { start: oldStart, tokens: oldCapacity })
  }

  while ([...builder.states.values()].some((state) => state.phase !== 'finished' && state.phase !== 'rejected')) {
    const arrivedThisStep = new Set<string>()
    const finishers: KvRequestFixture[] = []

    for (const fixture of fixtures) {
      const state = builder.states.get(fixture.id)!
      if (state.phase !== 'not-arrived' || fixture.arrivalStep > logicalStep) continue
      state.phase = 'prefill'
      builder.emit(logicalStep, fixture.id, 'arrived')
      arrivedThisStep.add(fixture.id)
      const demand = fixture.promptTokens + 1
      const start = carve(builder, demand, fixture.id, state.generation)
      if (start === null) {
        state.phase = 'rejected'
        builder.emit(logicalStep, fixture.id, 'rejected', { tokens: demand })
        continue
      }
      state.phase = 'prefill'
      state.address = start
      state.cachedTokens = demand
      state.generatedTokens = 1
      builder.emit(logicalStep, fixture.id, 'reserved', { start, tokens: demand })
      const interval = primaryOf(builder, fixture.id)
      interval.usedTokens = demand
      builder.emit(logicalStep, fixture.id, 'appended', { start, tokens: demand })
      if (state.generatedTokens === fixture.outputTokens) {
        state.inFlightReads = 1
        finishers.push(fixture)
      } else {
        state.phase = 'decode'
      }
    }

    for (const fixture of fixtures) {
      const state = builder.states.get(fixture.id)!
      if (state.phase !== 'decode' || arrivedThisStep.has(fixture.id)) continue
      state.generatedTokens += 1
      appendToken(logicalStep, fixture, state)
      if (state.phase === 'decode' && state.generatedTokens === fixture.outputTokens) {
        state.inFlightReads = 1
        finishers.push(fixture)
      }
    }

    // 步末统一裁决完成：本步 decode 期间其他请求仍看到完整持有，读取结束后才释放。
    for (const fixture of finishers) finishRequest(builder, logicalStep, fixture)
    logicalStep += 1
  }
}

/**
 * 生成确定性 KV 轨迹。两种策略使用同一物理池、同一请求工作量与同一步内顺序：
 * 到达与准入 → 各驻留请求 decode 追加 → 完成者在读取结束后释放。
 */
export function buildKvTrace(
  strategy: KvAllocationStrategy,
  options?: { model?: KvModelFixture; requests?: readonly KvRequestFixture[]; poolCapacityTokens?: number },
): KvTrace {
  const model = options?.model ?? kvTeachingModel
  const fixtures = options?.requests ?? kvChapterRequests
  const poolCapacityTokens = options?.poolCapacityTokens ?? kvPoolCapacityTokens
  assertFixtures(model, fixtures, poolCapacityTokens)

  const builder = makeBuilder(model, fixtures, poolCapacityTokens)
  if (strategy === 'max-reservation') buildMaxReservationTrace(builder)
  else buildOnDemandGrowthTrace(builder)

  const trace: KvTrace = {
    strategy,
    evidence: 'simulated',
    model,
    requests: fixtures.map((fixture) => ({ ...fixture })),
    poolCapacityTokens,
    events: builder.events,
    snapshots: builder.snapshots,
    poolSnapshots: builder.poolSnapshots,
  }
  const issues = validateKvTrace(trace)
  if (issues.length > 0) throw new Error(issues.join('\n'))
  return trace
}

/** 校验轨迹不变量：区间不重叠且覆盖全池、发布先于释放、释放必有读取完成、每请求恰好一次终结。 */
export function validateKvTrace(trace: KvTrace): string[] {
  const issues: string[] = []
  const fixturesById = new Map(trace.requests.map((fixture) => [fixture.id, fixture]))
  let previousStep = -1

  trace.events.forEach((event, index) => {
    if (event.sequence !== index) issues.push(`事件 ${index} 的序号不连续。`)
    if (event.logicalStep < previousStep) issues.push(`事件 ${event.sequence} 的逻辑步发生逆序。`)
    previousStep = event.logicalStep
    const fixture = fixturesById.get(event.requestId)
    if (!fixture) issues.push(`事件 ${event.sequence} 引用了未知请求。`)
    else if (event.logicalStep < fixture.arrivalStep) issues.push(`请求 ${event.requestId} 在到达前产生事件。`)
  })

  trace.poolSnapshots.forEach((snapshot) => {
    let cursor = 0
    let covered = 0
    for (const interval of [...snapshot.intervals].sort((a, b) => a.start - b.start)) {
      if (interval.start < cursor) issues.push(`事件 ${snapshot.afterEventSequence} 后区间 ${interval.start} 与前序区间重叠。`)
      cursor = Math.max(cursor, interval.start + interval.capacityTokens)
      covered += interval.capacityTokens
    }
    if (covered !== trace.poolCapacityTokens) {
      issues.push(`事件 ${snapshot.afterEventSequence} 后区间总量 ${covered} 不等于池容量。`)
    }
    const free = snapshot.intervals.filter((interval) => interval.role === 'free')
    const freeTokens = free.reduce((total, interval) => total + interval.capacityTokens, 0)
    if (freeTokens !== snapshot.freeTokens) issues.push(`事件 ${snapshot.afterEventSequence} 后空闲总量记录不一致。`)
  })

  for (const fixture of trace.requests) {
    const events = trace.events.filter((event) => event.requestId === fixture.id)
    if (events.filter((event) => event.kind === 'arrived').length !== 1) {
      issues.push(`请求 ${fixture.id} 必须且只能到达一次。`)
    }
    const rejected = events.filter((event) => event.kind === 'rejected')
    const released = events.filter((event) => event.kind === 'released')
    if (rejected.length > 1) issues.push(`请求 ${fixture.id} 被拒绝了多次。`)
    if (rejected.length > 0 && released.length > 0) issues.push(`请求 ${fixture.id} 不能既释放又被拒绝。`)
    if (rejected.length === 0 && released.length === 0) issues.push(`请求 ${fixture.id} 必须以释放或拒绝终结。`)
    // 每次释放（含搬迁释放旧区间）之前，必须有针对同一地址的读取完成事件。
    for (const event of released) {
      const matching = events.find(
        (item) => item.kind === 'read-complete' && item.start === event.start && item.sequence < event.sequence,
      )
      if (!matching) issues.push(`请求 ${fixture.id} 在地址 ${event.start} 的读取完成前释放了区间。`)
    }
    for (const published of events.filter((event) => event.kind === 'address-published')) {
      if (!events.some((event) => event.kind === 'copy-complete' && event.sequence < published.sequence)) {
        issues.push(`请求 ${fixture.id} 在复制完成前发布了新地址。`)
      }
    }
    for (const migration of events.filter((event) => event.kind === 'migration-start')) {
      const oldRelease = events.find((event) => event.kind === 'released' && event.start === migration.previousStart)
      if (!oldRelease || oldRelease.sequence <= migration.sequence) {
        issues.push(`请求 ${fixture.id} 的旧区间 ${migration.previousStart} 未在搬迁后释放。`)
      }
    }
    const lastEvent = events[events.length - 1]
    if (rejected.length > 0 && lastEvent && lastEvent.kind !== 'rejected') {
      issues.push(`请求 ${fixture.id} 的拒绝必须是它的最后一个事件。`)
    }
  }
  return issues
}

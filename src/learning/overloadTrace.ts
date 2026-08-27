import { blockCountFor, blockPoolTeachingFixture } from './blockPoolTrace'
import { kvCompletionTokens, type KvRequestFixture } from './kvStateTrace'

export type OverloadPolicy = 'queue' | 'reject' | 'preempt-recompute'
export type OverloadRequestState =
  | 'not-arrived'
  | 'queued-waiting-blocks'
  | 'queued-recompute'
  | 'waiting-prefill'
  | 'runnable'
  | 'finished'
  | 'rejected'

export type OverloadEventKind =
  | 'arrived'
  | 'admitted'
  | 'queued'
  | 'rejected'
  | 'preempted'
  | 'prefill-executed'
  | 'recompute-prefill'
  | 'decode-executed'
  | 'completed'
  | 'blocks-acquired'
  | 'blocks-released'

export interface OverloadEvent {
  sequence: number
  tick: number
  requestId: string
  kind: OverloadEventKind
  /** 事件涉及的块数（准入、抢占释放、增长获取、完成释放）。 */
  blocks?: number
  /** 拒绝时的裁决输入：需要块数、当时空闲与水位。 */
  neededBlocks?: number
  freeBlocks?: number
  watermark?: number
  /** 被抢占时已生成的 token 数。 */
  generatedTokens?: number
  /** 重计算 prefill 重新处理的 token 数。 */
  recomputeTokens?: number
  groupSize?: number
  evidence: 'simulated'
}

export interface OverloadTickSnapshot {
  tick: number
  afterEventSequence: number
  freeBlocks: number
  queueDepth: number
  states: readonly {
    requestId: string
    state: OverloadRequestState
    heldBlocks: number
    cachedTokens: number
  }[]
  chosen: { kind: 'prefill' | 'decode'; members: readonly string[] } | null
}

export interface OverloadTrace {
  policy: OverloadPolicy
  watermarkBlocks: number
  evidence: 'simulated'
  requests: readonly KvRequestFixture[]
  blockCount: number
  blockSizeTokens: number
  events: readonly OverloadEvent[]
  ticks: readonly OverloadTickSnapshot[]
}

/** 突发工作量：P-c 恰好用掉最后两块，P-d 面对空池。 */
export const overloadRequests: readonly KvRequestFixture[] = [
  { id: 'P-a', arrivalStep: 0, promptTokens: 5, outputTokens: 3, maxContextTokens: 8, terminalReason: 'eos' },
  { id: 'P-b', arrivalStep: 0, promptTokens: 5, outputTokens: 3, maxContextTokens: 8, terminalReason: 'eos' },
  { id: 'P-c', arrivalStep: 1, promptTokens: 5, outputTokens: 3, maxContextTokens: 8, terminalReason: 'eos' },
  { id: 'P-d', arrivalStep: 2, promptTokens: 3, outputTokens: 2, maxContextTokens: 5, terminalReason: 'eos' },
]

export const overloadTeachingPool = {
  blockCount: blockPoolTeachingFixture.blockCount,
  blockSizeTokens: blockPoolTeachingFixture.blockSizeTokens,
}

interface MutableState {
  arrived: boolean
  admitted: boolean
  rejected: boolean
  generatedTokens: number
  cachedTokens: number
  heldBlocks: number
  finished: boolean
  lastPrefillTick: number
}

/**
 * 生成确定性过载轨迹。拍内顺序沿用第 05 章：到达与准入裁决 →
 * prefill 优先选择 → 执行 → 完成释放。准入裁决按策略分派：
 * queue 排队重试；reject 按 free − need ≥ 水位 否则立即拒绝；
 * preempt-recompute 在空闲不足时抢占最近开始生成者。
 */
export function buildOverloadTrace(
  policy: OverloadPolicy,
  options?: { watermarkBlocks?: number; requests?: readonly KvRequestFixture[]; blockCount?: number },
): OverloadTrace {
  const watermarkBlocks = options?.watermarkBlocks ?? 0
  const requests = options?.requests ?? overloadRequests
  const blockCount = options?.blockCount ?? overloadTeachingPool.blockCount
  const blockSizeTokens = overloadTeachingPool.blockSizeTokens
  for (const request of requests) {
    if (kvCompletionTokens(request) > blockCount * blockSizeTokens) {
      throw new Error(`请求 ${request.id} 的完成态超出块池。`)
    }
  }

  const states = new Map<string, MutableState>(requests.map((request) => [request.id, {
    arrived: false,
    admitted: false,
    rejected: false,
    generatedTokens: 0,
    cachedTokens: 0,
    heldBlocks: 0,
    finished: false,
    lastPrefillTick: -1,
  }]))
  const events: OverloadEvent[] = []
  const ticks: OverloadTickSnapshot[] = []
  const pendingPrefills: string[] = []
  const heldTotal = () => [...states.values()].reduce((total, state) => total + state.heldBlocks, 0)
  const emit = (tick: number, requestId: string, kind: OverloadEventKind, details: Omit<OverloadEvent, 'sequence' | 'tick' | 'requestId' | 'kind' | 'evidence'> = {}) => {
    events.push({ sequence: events.length, tick, requestId, kind, ...details, evidence: 'simulated' })
  }

  const admit = (tick: number, request: KvRequestFixture, state: MutableState, neededBlocks: number) => {
    state.admitted = true
    state.heldBlocks = neededBlocks
    pendingPrefills.push(request.id)
    emit(tick, request.id, 'admitted', { blocks: neededBlocks })
  }

  let tick = 0
  while ([...states.values()].some((state) => !state.finished && !state.rejected)) {
    if (tick > 200) throw new Error('过载轨迹未能在有限拍内完成：请检查块池与策略。')

    // 1. 到达与准入裁决。
    for (const request of requests) {
      const state = states.get(request.id)!
      let justArrived = false
      if (!state.arrived) {
        if (request.arrivalStep > tick) continue
        state.arrived = true
        justArrived = true
        emit(tick, request.id, 'arrived')
      } else if (state.admitted || state.rejected || state.finished) {
        continue
      }
      const neededBlocks = blockCountFor(request.promptTokens + state.generatedTokens + 1, blockSizeTokens)
      const free = blockCount - heldTotal()
      if (policy === 'queue') {
        if (neededBlocks <= free) admit(tick, request, state, neededBlocks)
        else emit(tick, request.id, 'queued', { neededBlocks, freeBlocks: free })
      } else if (policy === 'reject') {
        if (free - neededBlocks >= watermarkBlocks) admit(tick, request, state, neededBlocks)
        else {
          state.rejected = true
          emit(tick, request.id, 'rejected', { neededBlocks, freeBlocks: free, watermark: watermarkBlocks })
        }
      } else {
        if (neededBlocks <= free) {
          admit(tick, request, state, neededBlocks)
        } else {
          // 抢占只属于新到达拍的裁决；等待中的请求重试时安静排队，
          // 否则重试本身会每拍抢占一位在跑者，产生震荡。
          const victims = justArrived
            ? requests
              .filter((item) => {
                const victim = states.get(item.id)!
                return victim.admitted && !victim.finished && victim.generatedTokens > 0 && victim.heldBlocks >= neededBlocks
              })
              .sort((left, right) => states.get(right.id)!.lastPrefillTick - states.get(left.id)!.lastPrefillTick)
            : []
          const victim = victims[0]
          if (victim) {
            const victimState = states.get(victim.id)!
            emit(tick, victim.id, 'preempted', { blocks: victimState.heldBlocks, generatedTokens: victimState.generatedTokens })
            victimState.heldBlocks = 0
            victimState.cachedTokens = 0
            victimState.admitted = false
            const pendingIndex = pendingPrefills.indexOf(victim.id)
            if (pendingIndex >= 0) pendingPrefills.splice(pendingIndex, 1)
            admit(tick, request, state, neededBlocks)
          } else {
            emit(tick, request.id, 'queued', { neededBlocks, freeBlocks: free })
          }
        }
      }
    }

    // 2. 选择与执行（prefill 优先，FIFO）。
    let chosen: OverloadTickSnapshot['chosen'] = null
    const pendingId = pendingPrefills[0]
    if (pendingId !== undefined) {
      const request = requests.find((item) => item.id === pendingId)!
      const state = states.get(pendingId)!
      pendingPrefills.shift()
      const isRecompute = state.generatedTokens > 0
      const restored = request.promptTokens + state.generatedTokens
      state.cachedTokens = restored + 1
      state.generatedTokens += 1
      state.heldBlocks = blockCountFor(state.cachedTokens, blockSizeTokens)
      state.lastPrefillTick = tick
      chosen = { kind: 'prefill', members: [pendingId] }
      if (isRecompute) emit(tick, pendingId, 'recompute-prefill', { recomputeTokens: restored })
      else emit(tick, pendingId, 'prefill-executed')
    } else {
      const decodeReady = requests
        .filter((item) => {
          const state = states.get(item.id)!
          return state.admitted && !state.finished && state.generatedTokens > 0
        })
        .map((item) => item.id)
      if (decodeReady.length > 0) {
        chosen = { kind: 'decode', members: decodeReady }
        for (const requestId of decodeReady) {
          const state = states.get(requestId)!
          const newBlocks = blockCountFor(state.cachedTokens + 1, blockSizeTokens)
          if (newBlocks > state.heldBlocks) {
            emit(tick, requestId, 'blocks-acquired', { blocks: newBlocks - state.heldBlocks })
            state.heldBlocks = newBlocks
          }
          state.cachedTokens += 1
          state.generatedTokens += 1
          emit(tick, requestId, 'decode-executed', { groupSize: decodeReady.length })
        }
      }
    }

    // 3. 完成释放。
    for (const request of requests) {
      const state = states.get(request.id)!
      if (state.admitted && !state.finished && state.generatedTokens === request.outputTokens) {
        state.finished = true
        emit(tick, request.id, 'completed')
        emit(tick, request.id, 'blocks-released', { blocks: state.heldBlocks })
        state.heldBlocks = 0
      }
    }

    const queueDepth = [...states.values()].filter((state) =>
      state.arrived && !state.admitted && !state.rejected && !state.finished).length
    ticks.push({
      tick,
      afterEventSequence: events.length - 1,
      freeBlocks: blockCount - heldTotal(),
      queueDepth,
      states: requests.map((request) => {
        const state = states.get(request.id)!
        return {
          requestId: request.id,
          state: state.rejected
            ? 'rejected'
            : state.finished
              ? 'finished'
              : !state.arrived
                ? 'not-arrived'
                : !state.admitted
                  ? (state.generatedTokens > 0 ? 'queued-recompute' : 'queued-waiting-blocks')
                  : state.generatedTokens === 0
                    ? 'waiting-prefill'
                    : 'runnable',
          heldBlocks: state.heldBlocks,
          cachedTokens: state.cachedTokens,
        }
      }),
      chosen,
    })
    tick += 1
  }

  const trace: OverloadTrace = {
    policy,
    watermarkBlocks,
    evidence: 'simulated',
    requests: requests.map((request) => ({ ...request })),
    blockCount,
    blockSizeTokens,
    events,
    ticks,
  }
  const issues = validateOverloadTrace(trace)
  if (issues.length > 0) throw new Error(issues.join('\n'))
  return trace
}

export interface OverloadSummaryRow {
  requestId: string
  firstExecutionTick: number
  completionTick: number
}

export interface OverloadSummary {
  totalTicks: number
  rejected: readonly string[]
  preempted: readonly string[]
  recomputeTokenUnits: number
  maxQueueDepth: number
  outcomes: readonly OverloadSummaryRow[]
}

/** 成本账单：全部由事件推导，正文与图消费同一结果。 */
export function overloadSummary(trace: OverloadTrace): OverloadSummary {
  return {
    totalTicks: trace.ticks.length,
    rejected: trace.events.filter((event) => event.kind === 'rejected').map((event) => event.requestId),
    preempted: trace.events.filter((event) => event.kind === 'preempted').map((event) => event.requestId),
    recomputeTokenUnits: trace.events.reduce((total, event) => total + (event.recomputeTokens ?? 0), 0),
    maxQueueDepth: Math.max(...trace.ticks.map((snapshot) => snapshot.queueDepth)),
    outcomes: trace.requests.map((request) => {
      const executions = trace.events.filter((event) =>
        event.requestId === request.id && (event.kind === 'prefill-executed' || event.kind === 'recompute-prefill' || event.kind === 'decode-executed'))
      const completion = trace.events.find((event) => event.requestId === request.id && event.kind === 'completed')
      return {
        requestId: request.id,
        firstExecutionTick: executions[0]?.tick ?? -1,
        completionTick: completion?.tick ?? -1,
      }
    }),
  }
}

/** 校验过载轨迹不变量：块数、裁决一致性、抢占与重计算条件、恰一次终结。 */
export function validateOverloadTrace(trace: OverloadTrace): string[] {
  const issues: string[] = []
  const requestsById = new Map(trace.requests.map((request) => [request.id, request]))
  let held = 0

  for (const event of trace.events) {
    const request = requestsById.get(event.requestId)
    if (!request) issues.push(`事件 ${event.sequence} 引用了未知请求。`)
    if (event.kind === 'admitted' || event.kind === 'blocks-acquired') held += event.blocks ?? 0
    if (event.kind === 'blocks-released' || event.kind === 'preempted') held -= event.blocks ?? 0
    if (held < 0 || held > trace.blockCount) {
      issues.push(`事件 ${event.sequence} 后持有块数 ${held} 越界。`)
    }
    if (event.kind === 'rejected') {
      const margin = (event.freeBlocks ?? 0) - (event.neededBlocks ?? 0)
      if (trace.policy !== 'reject' || margin >= trace.watermarkBlocks) {
        issues.push(`事件 ${event.sequence} 的拒绝与水位规则不一致。`)
      }
    }
    if (event.kind === 'queued' && (event.neededBlocks ?? 0) <= (event.freeBlocks ?? 0) && trace.policy !== 'preempt-recompute') {
      issues.push(`事件 ${event.sequence} 在空闲足够时仍排队。`)
    }
    if (event.kind === 'preempted') {
      if (trace.policy !== 'preempt-recompute') issues.push(`事件 ${event.sequence} 在非抢占策略下发生抢占。`)
      if ((event.blocks ?? 0) <= 0) issues.push(`事件 ${event.sequence} 抢占未释放任何块。`)
    }
    if (event.kind === 'recompute-prefill') {
      // 重计算 token 数与被抢占时已生成数的对应关系在下方按请求校验。
      if ((event.recomputeTokens ?? 0) < 0) issues.push(`事件 ${event.sequence} 的重计算 token 数为负。`)
    }
  }

  for (const snapshot of trace.ticks) {
    const heldFromStates = snapshot.states.reduce((total, item) => total + item.heldBlocks, 0)
    if (snapshot.freeBlocks !== trace.blockCount - heldFromStates) {
      issues.push(`拍 ${snapshot.tick} 的空闲块数与状态不一致。`)
    }
  }

  for (const request of trace.requests) {
    const events = trace.events.filter((event) => event.requestId === request.id)
    if (events.filter((event) => event.kind === 'arrived').length !== 1) {
      issues.push(`请求 ${request.id} 必须且只能到达一次。`)
    }
    const rejected = events.filter((event) => event.kind === 'rejected')
    const completed = events.filter((event) => event.kind === 'completed')
    if (rejected.length > 1) issues.push(`请求 ${request.id} 被拒绝了多次。`)
    if (rejected.length > 0 && completed.length > 0) issues.push(`请求 ${request.id} 不能既被拒绝又完成。`)
    if (rejected.length === 0 && completed.length !== 1) issues.push(`请求 ${request.id} 必须恰完成一次或被拒绝。`)
    const preempted = events.find((event) => event.kind === 'preempted')
    const recompute = events.find((event) => event.kind === 'recompute-prefill')
    if (preempted && !recompute) issues.push(`请求 ${request.id} 被抢占后没有以重计算恢复。`)
    if (!preempted && recompute) issues.push(`请求 ${request.id} 未被抢占却出现重计算。`)
    if (preempted && recompute && recompute.recomputeTokens !== request.promptTokens + (preempted.generatedTokens ?? 0)) {
      issues.push(`请求 ${request.id} 的重计算 token 数不等于 prompt 加被抢占时已生成数。`)
    }
    if (preempted && preempted.sequence > (events.find((event) => event.kind === 'recompute-prefill')?.sequence ?? 0)) {
      issues.push(`请求 ${request.id} 的重计算必须晚于抢占。`)
    }
  }
  return issues
}

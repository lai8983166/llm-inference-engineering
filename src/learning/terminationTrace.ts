import { blockCountFor, blockPoolTeachingFixture } from './blockPoolTrace'
import { kvCompletionTokens, type KvRequestFixture } from './kvStateTrace'

/** 终态原因：前两类自然产生，后四类由终止注入带来。 */
export type TerminationCause = 'eos' | 'length' | 'client-cancel' | 'timeout' | 'disconnect' | 'error'

/** 注入的外部终止：作用在单个请求上。 */
export interface TerminationInjection {
  requestId: string
  tick: number
  cause: 'client-cancel' | 'timeout' | 'disconnect' | 'error'
  /** 超时注入的首执行期限（含）。 */
  firstExecutionDeadlineTick?: number
}

export type TerminationRequestState =
  | 'not-arrived'
  | 'queued-waiting-blocks'
  | 'waiting-prefill'
  | 'runnable'
  | 'finished'
  | 'terminated'

export type TerminationEventKind =
  | 'arrived'
  | 'admitted'
  | 'queued'
  | 'terminated'
  | 'blocks-released'
  | 'left-queue'
  | 'stream-closed'
  | 'prefill-executed'
  | 'decode-executed'
  | 'completed'
  | 'blocks-acquired'

export interface TerminationEvent {
  sequence: number
  tick: number
  requestId: string
  kind: TerminationEventKind
  blocks?: number
  cause?: TerminationCause
  groupSize?: number
  evidence: 'simulated'
}

export interface TerminationTickSnapshot {
  tick: number
  afterEventSequence: number
  freeBlocks: number
  queueDepth: number
  states: readonly {
    requestId: string
    state: TerminationRequestState
    terminalCause?: TerminationCause
    heldBlocks: number
    cachedTokens: number
    queued: boolean
  }[]
  chosen: { kind: 'prefill' | 'decode'; members: readonly string[] } | null
}

export interface TerminationTrace {
  evidence: 'simulated'
  requests: readonly KvRequestFixture[]
  injections: readonly TerminationInjection[]
  blockCount: number
  blockSizeTokens: number
  events: readonly TerminationEvent[]
  ticks: readonly TerminationTickSnapshot[]
}

/** 第 07 章固定工作量与终止注入。 */
export const terminationRequests: readonly KvRequestFixture[] = [
  { id: 'C-a', arrivalStep: 0, promptTokens: 5, outputTokens: 3, maxContextTokens: 8, terminalReason: 'eos' },
  { id: 'C-b', arrivalStep: 0, promptTokens: 5, outputTokens: 3, maxContextTokens: 8, terminalReason: 'eos' },
  { id: 'C-c', arrivalStep: 1, promptTokens: 5, outputTokens: 3, maxContextTokens: 8, terminalReason: 'eos' },
  { id: 'C-d', arrivalStep: 2, promptTokens: 3, outputTokens: 2, maxContextTokens: 5, terminalReason: 'eos' },
  { id: 'C-e', arrivalStep: 3, promptTokens: 2, outputTokens: 1, maxContextTokens: 3, terminalReason: 'eos' },
]

export const terminationInjections: readonly TerminationInjection[] = [
  { requestId: 'C-b', tick: 4, cause: 'client-cancel' },
  { requestId: 'C-e', tick: 4, cause: 'timeout', firstExecutionDeadlineTick: 3 },
]

export const terminationTeachingPool = {
  blockCount: blockPoolTeachingFixture.blockCount,
  blockSizeTokens: blockPoolTeachingFixture.blockSizeTokens,
}

interface MutableState {
  arrived: boolean
  admitted: boolean
  queued: boolean
  generatedTokens: number
  cachedTokens: number
  heldBlocks: number
  terminalCause?: TerminationCause
  terminalSequence?: number
  firstExecutionTick?: number
}

function makeStates(requests: readonly KvRequestFixture[]): Map<string, MutableState> {
  return new Map(requests.map((request) => [request.id, {
    arrived: false,
    admitted: false,
    queued: false,
    generatedTokens: 0,
    cachedTokens: 0,
    heldBlocks: 0,
  }]))
}

/**
 * 生成确定性终止轨迹（无界排队、prefill 优先）。拍内顺序：
 * 终止注入（最先）→ 到达与准入重试 → 选择与执行 → 自然完成清理。
 * 清理仪式在终态当拍一次走完：释放块、离队、关流、终态事件。
 */
export function buildTerminationTrace(
  options?: {
    requests?: readonly KvRequestFixture[]
    injections?: readonly TerminationInjection[]
    blockCount?: number
  },
): TerminationTrace {
  const requests = options?.requests ?? terminationRequests
  const injections = options?.injections ?? terminationInjections
  const blockCount = options?.blockCount ?? terminationTeachingPool.blockCount
  const blockSizeTokens = terminationTeachingPool.blockSizeTokens
  for (const request of requests) {
    if (kvCompletionTokens(request) > blockCount * blockSizeTokens) {
      throw new Error(`请求 ${request.id} 的完成态超出块池。`)
    }
  }

  const states = makeStates(requests)
  const events: TerminationEvent[] = []
  const ticks: TerminationTickSnapshot[] = []
  const pendingPrefills: string[] = []
  const heldTotal = () => [...states.values()].reduce((total, state) => total + state.heldBlocks, 0)
  const emit = (tick: number, requestId: string, kind: TerminationEventKind, details: Pick<TerminationEvent, 'blocks' | 'cause' | 'groupSize'> = {}) => {
    events.push({ sequence: events.length, tick, requestId, kind, ...details, evidence: 'simulated' })
  }

  /** 清理仪式：裁决后同拍按固定顺序走完——释放块、离队、关流、记录终态。 */
  const terminate = (tick: number, request: KvRequestFixture, state: MutableState, cause: TerminationCause) => {
    if (state.heldBlocks > 0) {
      emit(tick, request.id, 'blocks-released', { blocks: state.heldBlocks })
      state.heldBlocks = 0
    }
    if (state.queued) {
      state.queued = false
      emit(tick, request.id, 'left-queue')
    }
    emit(tick, request.id, 'stream-closed')
    emit(tick, request.id, 'terminated', { cause })
    state.terminalCause = cause
    state.terminalSequence = events.length - 1
    const pendingIndex = pendingPrefills.indexOf(request.id)
    if (pendingIndex >= 0) pendingPrefills.splice(pendingIndex, 1)
  }

  let tick = 0
  while ([...states.values()].some((state) => state.terminalCause === undefined)) {
    if (tick > 200) throw new Error('终止轨迹未能在有限拍内完成：请检查块池与注入。')

    // 1. 终止注入（最先处理）：显式取消按拍触发，超时按首执行期限判定。
    for (const injection of injections) {
      const state = states.get(injection.requestId)
      const request = requests.find((item) => item.id === injection.requestId)
      if (!state || !request || state.terminalCause !== undefined) continue
      if (injection.tick !== tick || !state.arrived) continue
      if (injection.cause === 'timeout') {
        const deadline = injection.firstExecutionDeadlineTick ?? injection.tick
        if (state.firstExecutionTick !== undefined && state.firstExecutionTick <= deadline) continue
      }
      terminate(tick, request, state, injection.cause)
    }

    // 2. 到达与准入重试。
    for (const request of requests) {
      const state = states.get(request.id)!
      if (!state.arrived) {
        if (request.arrivalStep > tick) continue
        state.arrived = true
        emit(tick, request.id, 'arrived')
      } else if (state.admitted || state.terminalCause !== undefined) {
        continue
      }
      const neededBlocks = blockCountFor(request.promptTokens + 1, blockSizeTokens)
      const free = blockCount - heldTotal()
      if (neededBlocks <= free) {
        state.admitted = true
        state.queued = false
        state.heldBlocks = neededBlocks
        pendingPrefills.push(request.id)
        emit(tick, request.id, 'admitted', { blocks: neededBlocks })
      } else {
        state.queued = true
        emit(tick, request.id, 'queued')
      }
    }

    // 3. 选择与执行（prefill 优先，FIFO）。
    let chosen: TerminationTickSnapshot['chosen'] = null
    const pendingId = pendingPrefills[0]
    if (pendingId !== undefined) {
      const request = requests.find((item) => item.id === pendingId)!
      const state = states.get(pendingId)!
      pendingPrefills.shift()
      state.cachedTokens = request.promptTokens + 1
      state.generatedTokens = 1
      state.heldBlocks = blockCountFor(state.cachedTokens, blockSizeTokens)
      state.firstExecutionTick = tick
      chosen = { kind: 'prefill', members: [pendingId] }
      emit(tick, pendingId, 'prefill-executed')
    } else {
      const decodeReady = requests
        .filter((item) => {
          const state = states.get(item.id)!
          return state.admitted && state.terminalCause === undefined && state.generatedTokens > 0
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
          if (state.firstExecutionTick === undefined) state.firstExecutionTick = tick
          emit(tick, requestId, 'decode-executed', { groupSize: decodeReady.length })
        }
      }
    }

    // 4. 自然完成（eos/length）走同一次清理仪式。
    for (const request of requests) {
      const state = states.get(request.id)!
      if (state.terminalCause === undefined && state.generatedTokens === request.outputTokens && state.generatedTokens > 0) {
        emit(tick, request.id, 'completed')
        terminate(tick, request, state, request.terminalReason === 'eos' ? 'eos' : 'length')
      }
    }

    ticks.push({
      tick,
      afterEventSequence: events.length - 1,
      freeBlocks: blockCount - heldTotal(),
      queueDepth: [...states.values()].filter((state) => state.queued).length,
      states: requests.map((request) => {
        const state = states.get(request.id)!
        return {
          requestId: request.id,
          state: state.terminalCause !== undefined
            ? 'terminated'
            : !state.arrived
              ? 'not-arrived'
              : !state.admitted
                ? 'queued-waiting-blocks'
                : state.generatedTokens === 0
                  ? 'waiting-prefill'
                  : 'runnable',
          terminalCause: state.terminalCause,
          heldBlocks: state.heldBlocks,
          cachedTokens: state.cachedTokens,
          queued: state.queued,
        }
      }),
      chosen,
    })
    tick += 1
  }

  const trace: TerminationTrace = {
    evidence: 'simulated',
    requests: requests.map((request) => ({ ...request })),
    injections: injections.map((injection) => ({ ...injection })),
    blockCount,
    blockSizeTokens,
    events,
    ticks,
  }
  const issues = noLeakIssues(trace)
  if (issues.length > 0) throw new Error(issues.join('\n'))
  return trace
}

export interface TerminationOutcomeRow {
  requestId: string
  firstExecutionTick: number
  terminalTick: number
  cause: TerminationCause | 'never-terminated'
}

/** 每请求首执行拍、终态拍与终态原因；基线与注入对照消费同一结果。 */
export function terminationOutcome(trace: TerminationTrace): TerminationOutcomeRow[] {
  return trace.requests.map((request) => {
    const events = trace.events.filter((event) => event.requestId === request.id)
    const terminal = events.find((event) => event.kind === 'terminated')
    return {
      requestId: request.id,
      firstExecutionTick: events.find((event) => event.kind === 'prefill-executed' || event.kind === 'decode-executed')?.tick ?? -1,
      terminalTick: terminal?.tick ?? -1,
      cause: terminal?.cause ?? 'never-terminated',
    }
  })
}

/** 无泄漏合同：每请求恰一终态；终态后无增长/执行/排队；终态当拍块归零、离队、关流。 */
export function noLeakIssues(trace: TerminationTrace): string[] {
  const issues: string[] = []
  const requestsById = new Map(trace.requests.map((request) => [request.id, request]))
  let held = 0

  for (const event of trace.events) {
    const request = requestsById.get(event.requestId)
    if (!request) issues.push(`事件 ${event.sequence} 引用了未知请求。`)
    if (event.kind === 'admitted' || event.kind === 'blocks-acquired') held += event.blocks ?? 0
    if (event.kind === 'blocks-released') held -= event.blocks ?? 0
    if (held < 0 || held > trace.blockCount) {
      issues.push(`事件 ${event.sequence} 后持有块数 ${held} 越界。`)
    }
  }

  for (const request of trace.requests) {
    const events = trace.events.filter((event) => event.requestId === request.id)
    // 逐请求重放块账：终态事件发生时持有必须已归零。
    let heldByRequest = 0
    for (const event of events) {
      if (event.kind === 'admitted' || event.kind === 'blocks-acquired') heldByRequest += event.blocks ?? 0
      if (event.kind === 'blocks-released') heldByRequest -= event.blocks ?? 0
      if (event.kind === 'terminated' && heldByRequest !== 0) {
        issues.push(`请求 ${request.id} 终态时仍持有 ${heldByRequest} 块。`)
      }
    }
    const terminalEvents = events.filter((event) => event.kind === 'terminated')
    if (terminalEvents.length !== 1) {
      issues.push(`请求 ${request.id} 必须恰有一个终态事件（当前 ${terminalEvents.length} 个）。`)
      continue
    }
    const terminal = terminalEvents[0]
    if (!terminal.cause) issues.push(`请求 ${request.id} 的终态事件缺少原因。`)
    if (events.find((event) => event.kind === 'completed') && terminal.cause !== 'eos' && terminal.cause !== 'length') {
      issues.push(`请求 ${request.id} 自然完成与注入终态冲突。`)
    }
    // 终态之后不得再出现任何增长、执行或排队事件。
    for (const event of events) {
      if (event.sequence > terminal.sequence && event.kind !== 'blocks-released' && event.kind !== 'left-queue' && event.kind !== 'stream-closed' && event.kind !== 'terminated') {
        issues.push(`请求 ${request.id} 在终态后仍出现 ${event.kind} 事件。`)
      }
    }
    // 终态当拍：持有块归零（若有块必有释放事件）、流关闭紧随终态。
    const releases = events.filter((event) => event.kind === 'blocks-released')
    for (const release of releases) {
      if (release.tick !== terminal.tick) {
        issues.push(`请求 ${request.id} 的块释放（t${release.tick}）不在终态拍（t${terminal.tick}）。`)
      }
    }
    const closed = events.find((event) => event.kind === 'stream-closed')
    if (!closed || closed.tick !== terminal.tick) {
      issues.push(`请求 ${request.id} 的流关闭不在终态拍。`)
    }
    // 仅当终态时仍在队（终态前最后一个队列事件是 queued）才要求离队。
    const queueStateEvents = events.filter((event) =>
      (event.kind === 'queued' || event.kind === 'admitted' || event.kind === 'left-queue') && event.sequence < terminal.sequence)
    const stillQueuedAtTerminal = queueStateEvents.at(-1)?.kind === 'queued'
    const leftQueue = events.find((event) => event.kind === 'left-queue')
    if (stillQueuedAtTerminal && (!leftQueue || leftQueue.tick !== terminal.tick)) {
      issues.push(`请求 ${request.id} 终态时在队，但没有在终态拍离队。`)
    }
    if (!stillQueuedAtTerminal && leftQueue && (queueStateEvents.at(-1)?.kind !== 'left-queue')) {
      issues.push(`请求 ${request.id} 终态时不在队，却出现离队事件。`)
    }
  }
  return issues
}

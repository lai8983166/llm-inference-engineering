export type ConcurrencyStrategy = 'serial' | 'independent-loops' | 'static-batch'
export type RequestPhase = 'prefill' | 'decode' | 'finished'
export type RequestStatus = 'not-arrived' | 'ready' | 'submitted' | 'in-flight' | 'done'
export type ConcurrencyActor = 'request' | 'host' | 'device' | 'runtime'
export type ConcurrencyEventKind =
  | 'arrived'
  | 'became-ready'
  | 'batch-wait'
  | 'host-submit'
  | 'device-start'
  | 'device-complete'
  | 'request-complete'
  | 'resource-released'

export interface RequestFixture {
  id: string
  arrivalStep: number
  promptTokens: number
  outputTokens: number
  terminalReason: 'eos' | 'length'
}

export interface RequestSnapshot {
  afterEventSequence: number
  logicalStep: number
  requestId: string
  status: RequestStatus
  phase: RequestPhase
  generatedTokens: number
  inFlight: boolean
  released: boolean
}

export interface ExecutionGroupMember {
  requestId: string
  slotState: 'active' | 'inactive'
  validTokens: number
  paddingTokens: number
}

export interface ExecutionGroup {
  id: string
  logicalStep: number
  phase: Exclude<RequestPhase, 'finished'>
  members: readonly ExecutionGroupMember[]
}

export interface ConcurrencyEvent {
  sequence: number
  logicalStep: number
  requestId: string
  actor: ConcurrencyActor
  kind: ConcurrencyEventKind
  phase?: RequestPhase
  executionGroupId?: string
  generatedTokens?: number
  evidence: 'simulated'
}

export interface StrategyTrace {
  strategy: ConcurrencyStrategy
  evidence: 'simulated'
  requests: readonly RequestFixture[]
  events: readonly ConcurrencyEvent[]
  groups: readonly ExecutionGroup[]
  snapshots: readonly RequestSnapshot[]
}

export type TraceAuditCategory =
  | 'not-runnable'
  | 'ready-not-selected'
  | 'valid-device-work'
  | 'padding-or-inactive'

export interface TraceAuditEvent {
  id: string
  logicalStep: number
  requestId: string
  observation: string
  expectedCategory: TraceAuditCategory
}

export interface TraceAuditResult {
  eventId: string
  selected?: TraceAuditCategory
  expected: TraceAuditCategory
  correct: boolean
}

export const traceAuditEvents: readonly TraceAuditEvent[] = [
  { id: 'E0', logicalStep: 0, requestId: 'Q-beta', observation: 'arrived=true · input_ready=false', expectedCategory: 'not-runnable' },
  { id: 'E1', logicalStep: 1, requestId: 'Q-alpha', observation: 'ready=true · selected=false · device_group=G-prev', expectedCategory: 'ready-not-selected' },
  { id: 'E2', logicalStep: 2, requestId: 'Q-alpha', observation: 'group=G1 · phase=prefill · valid=4 · pad=0', expectedCategory: 'valid-device-work' },
  { id: 'E3', logicalStep: 2, requestId: 'Q-beta', observation: 'group=G1 · phase=prefill · valid=2 · pad=2', expectedCategory: 'padding-or-inactive' },
]

export function assessTraceAudit(selections: Readonly<Partial<Record<string, TraceAuditCategory>>>) {
  const results: TraceAuditResult[] = traceAuditEvents.map((event) => ({
    eventId: event.id,
    selected: selections[event.id],
    expected: event.expectedCategory,
    correct: selections[event.id] === event.expectedCategory,
  }))
  return {
    results,
    correct: results.filter((result) => result.correct).length,
    total: results.length,
  }
}

export const concurrencyChapterRequests: readonly RequestFixture[] = [
  { id: 'R-long', arrivalStep: 0, promptTokens: 6, outputTokens: 4, terminalReason: 'eos' },
  { id: 'R-short', arrivalStep: 1, promptTokens: 2, outputTokens: 1, terminalReason: 'eos' },
  { id: 'R-late', arrivalStep: 3, promptTokens: 4, outputTokens: 2, terminalReason: 'length' },
]

interface MutableRequestState {
  generatedTokens: number
  arrived: boolean
  completed: boolean
}

interface TraceBuilder {
  events: ConcurrencyEvent[]
  groups: ExecutionGroup[]
  emit: (
    logicalStep: number,
    requestId: string,
    actor: ConcurrencyActor,
    kind: ConcurrencyEventKind,
    details?: Pick<ConcurrencyEvent, 'phase' | 'executionGroupId' | 'generatedTokens'>,
  ) => void
}

function assertFixtures(fixtures: readonly RequestFixture[]) {
  const ids = new Set<string>()
  for (const fixture of fixtures) {
    if (!fixture.id || ids.has(fixture.id)) throw new Error('请求标识必须存在且唯一。')
    if (!Number.isInteger(fixture.arrivalStep) || fixture.arrivalStep < 0) throw new Error('到达步必须是非负整数。')
    if (!Number.isInteger(fixture.promptTokens) || fixture.promptTokens < 1) throw new Error('prompt token 数必须是正整数。')
    if (!Number.isInteger(fixture.outputTokens) || fixture.outputTokens < 1) throw new Error('输出 token 数必须是正整数。')
    ids.add(fixture.id)
  }
}

function makeBuilder(): TraceBuilder {
  const events: ConcurrencyEvent[] = []
  const groups: ExecutionGroup[] = []
  return {
    events,
    groups,
    emit(logicalStep, requestId, actor, kind, details = {}) {
      events.push({
        sequence: events.length,
        logicalStep,
        requestId,
        actor,
        kind,
        ...details,
        evidence: 'simulated',
      })
    },
  }
}

function makeState(fixtures: readonly RequestFixture[]) {
  return new Map<string, MutableRequestState>(fixtures.map((fixture) => [fixture.id, {
    generatedTokens: 0,
    arrived: false,
    completed: false,
  }]))
}

function phaseFor(state: MutableRequestState): Exclude<RequestPhase, 'finished'> {
  return state.generatedTokens === 0 ? 'prefill' : 'decode'
}

function emitArrivals(
  logicalStep: number,
  fixtures: readonly RequestFixture[],
  states: Map<string, MutableRequestState>,
  builder: TraceBuilder,
) {
  for (const fixture of fixtures) {
    const state = states.get(fixture.id)!
    if (!state.arrived && fixture.arrivalStep <= logicalStep) {
      state.arrived = true
      builder.emit(fixture.arrivalStep, fixture.id, 'request', 'arrived')
      builder.emit(fixture.arrivalStep, fixture.id, 'runtime', 'became-ready', { phase: 'prefill' })
    }
  }
}

function executeGroup(
  logicalStep: number,
  group: ExecutionGroup,
  fixturesById: ReadonlyMap<string, RequestFixture>,
  states: Map<string, MutableRequestState>,
  builder: TraceBuilder,
) {
  builder.groups.push(group)
  for (const member of group.members.filter((item) => item.slotState === 'active')) {
    const state = states.get(member.requestId)!
    const fixture = fixturesById.get(member.requestId)!
    builder.emit(logicalStep, member.requestId, 'host', 'host-submit', {
      phase: group.phase,
      executionGroupId: group.id,
    })
    builder.emit(logicalStep, member.requestId, 'device', 'device-start', {
      phase: group.phase,
      executionGroupId: group.id,
    })
    state.generatedTokens += 1
    builder.emit(logicalStep, member.requestId, 'device', 'device-complete', {
      phase: group.phase,
      executionGroupId: group.id,
      generatedTokens: state.generatedTokens,
    })
    if (state.generatedTokens === fixture.outputTokens) {
      state.completed = true
      builder.emit(logicalStep, member.requestId, 'request', 'request-complete', {
        phase: 'finished',
        executionGroupId: group.id,
        generatedTokens: state.generatedTokens,
      })
      builder.emit(logicalStep, member.requestId, 'runtime', 'resource-released', {
        phase: 'finished',
        executionGroupId: group.id,
        generatedTokens: state.generatedTokens,
      })
    }
  }
}

function buildSerialTrace(fixtures: readonly RequestFixture[], builder: TraceBuilder) {
  const states = makeState(fixtures)
  const fixturesById = new Map(fixtures.map((fixture) => [fixture.id, fixture]))
  let logicalStep = 0
  let activeRequestId: string | undefined

  while ([...states.values()].some((state) => !state.completed)) {
    emitArrivals(logicalStep, fixtures, states, builder)
    if (!activeRequestId) {
      activeRequestId = fixtures.find((fixture) => {
        const state = states.get(fixture.id)!
        return state.arrived && !state.completed
      })?.id
    }
    if (!activeRequestId) {
      logicalStep += 1
      continue
    }

    const state = states.get(activeRequestId)!
    const phase = phaseFor(state)
    executeGroup(logicalStep, {
      id: `serial-${logicalStep}`,
      logicalStep,
      phase,
      members: [{ requestId: activeRequestId, slotState: 'active', validTokens: phase === 'prefill' ? fixturesById.get(activeRequestId)!.promptTokens : 1, paddingTokens: 0 }],
    }, fixturesById, states, builder)
    if (state.completed) activeRequestId = undefined
    logicalStep += 1
  }
}

function buildIndependentLoopsTrace(fixtures: readonly RequestFixture[], builder: TraceBuilder) {
  const states = makeState(fixtures)
  const fixturesById = new Map(fixtures.map((fixture) => [fixture.id, fixture]))
  const submittedQueue: Array<{ requestId: string; phase: Exclude<RequestPhase, 'finished'> }> = []
  const submitted = new Set<string>()
  let logicalStep = 0

  while ([...states.values()].some((state) => !state.completed)) {
    emitArrivals(logicalStep, fixtures, states, builder)
    for (const fixture of fixtures) {
      const state = states.get(fixture.id)!
      if (state.arrived && !state.completed && !submitted.has(fixture.id)) {
        const phase = phaseFor(state)
        builder.emit(logicalStep, fixture.id, 'host', 'host-submit', { phase })
        submittedQueue.push({ requestId: fixture.id, phase })
        submitted.add(fixture.id)
      }
    }

    const next = submittedQueue.shift()
    if (!next) {
      logicalStep += 1
      continue
    }
    submitted.delete(next.requestId)
    const fixture = fixturesById.get(next.requestId)!
    const state = states.get(next.requestId)!
    const group: ExecutionGroup = {
      id: `independent-${logicalStep}`,
      logicalStep,
      phase: next.phase,
      members: [{ requestId: next.requestId, slotState: 'active', validTokens: next.phase === 'prefill' ? fixture.promptTokens : 1, paddingTokens: 0 }],
    }
    builder.groups.push(group)
    builder.emit(logicalStep, next.requestId, 'device', 'device-start', { phase: next.phase, executionGroupId: group.id })
    state.generatedTokens += 1
    builder.emit(logicalStep, next.requestId, 'device', 'device-complete', {
      phase: next.phase,
      executionGroupId: group.id,
      generatedTokens: state.generatedTokens,
    })
    if (state.generatedTokens === fixture.outputTokens) {
      state.completed = true
      builder.emit(logicalStep, next.requestId, 'request', 'request-complete', { phase: 'finished', generatedTokens: state.generatedTokens })
      builder.emit(logicalStep, next.requestId, 'runtime', 'resource-released', { phase: 'finished', generatedTokens: state.generatedTokens })
    } else {
      builder.emit(logicalStep, next.requestId, 'runtime', 'became-ready', { phase: 'decode', generatedTokens: state.generatedTokens })
    }
    logicalStep += 1
  }
}

function buildStaticBatchTrace(fixtures: readonly RequestFixture[], builder: TraceBuilder) {
  const states = makeState(fixtures)
  const fixturesById = new Map(fixtures.map((fixture) => [fixture.id, fixture]))
  let logicalStep = 0
  let cohort: string[] = []
  let cohortIndex = 0
  let cohortStarted = false

  while ([...states.values()].some((state) => !state.completed)) {
    emitArrivals(logicalStep, fixtures, states, builder)
    if (cohort.length === 0) {
      const ready = fixtures.filter((fixture) => {
        const state = states.get(fixture.id)!
        return state.arrived && !state.completed
      })
      const hasFutureArrival = fixtures.some((fixture) => !states.get(fixture.id)!.arrived)
      if (ready.length === 1 && hasFutureArrival) {
        builder.emit(logicalStep, ready[0].id, 'runtime', 'batch-wait', { phase: phaseFor(states.get(ready[0].id)!) })
        logicalStep += 1
        continue
      }
      cohort = ready.slice(0, 2).map((fixture) => fixture.id)
      cohortIndex += 1
      cohortStarted = false
    }

    if (cohort.length === 0) {
      logicalStep += 1
      continue
    }

    const phase: Exclude<RequestPhase, 'finished'> = cohortStarted ? 'decode' : 'prefill'
    const maxPromptTokens = Math.max(...cohort.map((id) => fixturesById.get(id)!.promptTokens))
    const members: ExecutionGroupMember[] = cohort.map((requestId) => {
      const state = states.get(requestId)!
      if (state.completed) return { requestId, slotState: 'inactive', validTokens: 0, paddingTokens: 0 }
      const validTokens = phase === 'prefill' ? fixturesById.get(requestId)!.promptTokens : 1
      return {
        requestId,
        slotState: 'active',
        validTokens,
        paddingTokens: phase === 'prefill' ? maxPromptTokens - validTokens : 0,
      }
    })
    executeGroup(logicalStep, {
      id: `static-${cohortIndex}-${logicalStep}`,
      logicalStep,
      phase,
      members,
    }, fixturesById, states, builder)
    cohortStarted = true

    for (const fixture of fixtures) {
      const state = states.get(fixture.id)!
      if (state.arrived && !state.completed && !cohort.includes(fixture.id)) {
        const alreadyWaiting = builder.events.some((event) => event.requestId === fixture.id && event.kind === 'batch-wait')
        if (!alreadyWaiting) builder.emit(logicalStep, fixture.id, 'runtime', 'batch-wait', { phase: phaseFor(state) })
      }
    }
    if (cohort.every((requestId) => states.get(requestId)!.completed)) {
      cohort = []
      cohortStarted = false
    }
    logicalStep += 1
  }
}

export function deriveRequestSnapshots(
  fixtures: readonly RequestFixture[],
  events: readonly ConcurrencyEvent[],
): RequestSnapshot[] {
  const state = new Map<string, Omit<RequestSnapshot, 'afterEventSequence' | 'logicalStep' | 'requestId'>>(fixtures.map((fixture) => [fixture.id, {
    status: 'not-arrived' as RequestStatus,
    phase: 'prefill' as RequestPhase,
    generatedTokens: 0,
    inFlight: false,
    released: false,
  }]))
  const snapshots: RequestSnapshot[] = []

  for (const event of events) {
    const current = state.get(event.requestId)!
    if (event.kind === 'arrived') current.status = 'ready'
    if (event.kind === 'became-ready') current.status = 'ready'
    if (event.kind === 'host-submit') current.status = 'submitted'
    if (event.kind === 'device-start') {
      current.status = 'in-flight'
      current.inFlight = true
    }
    if (event.kind === 'device-complete') {
      current.status = 'ready'
      current.inFlight = false
      current.generatedTokens = event.generatedTokens ?? current.generatedTokens
    }
    if (event.kind === 'request-complete') {
      current.status = 'done'
      current.phase = 'finished'
    } else if (event.phase) current.phase = event.phase
    if (event.kind === 'resource-released') current.released = true

    for (const fixture of fixtures) {
      const requestState = state.get(fixture.id)!
      snapshots.push({
        afterEventSequence: event.sequence,
        logicalStep: event.logicalStep,
        requestId: fixture.id,
        ...requestState,
      })
    }
  }
  return snapshots
}

export function validateStrategyTrace(trace: StrategyTrace): string[] {
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

  for (const fixture of trace.requests) {
    const requestEvents = trace.events.filter((event) => event.requestId === fixture.id)
    const arrivals = requestEvents.filter((event) => event.kind === 'arrived')
    const completions = requestEvents.filter((event) => event.kind === 'request-complete')
    const releases = requestEvents.filter((event) => event.kind === 'resource-released')
    if (arrivals.length !== 1 || arrivals[0]?.logicalStep !== fixture.arrivalStep) issues.push(`请求 ${fixture.id} 的到达事件与 fixture 不一致。`)
    if (completions.length !== 1) issues.push(`请求 ${fixture.id} 必须且只能完成一次。`)
    if (releases.length !== 1) issues.push(`请求 ${fixture.id} 必须且只能释放一次。`)
    if (completions[0] && releases[0] && releases[0].sequence < completions[0].sequence) issues.push(`请求 ${fixture.id} 在完成前释放。`)
  }
  return issues
}

export function buildStrategyTrace(
  strategy: ConcurrencyStrategy,
  fixtures: readonly RequestFixture[] = concurrencyChapterRequests,
): StrategyTrace {
  assertFixtures(fixtures)
  const requests = fixtures.map((fixture) => ({ ...fixture }))
  const builder = makeBuilder()
  if (strategy === 'serial') buildSerialTrace(requests, builder)
  else if (strategy === 'independent-loops') buildIndependentLoopsTrace(requests, builder)
  else buildStaticBatchTrace(requests, builder)

  const trace: StrategyTrace = {
    strategy,
    evidence: 'simulated',
    requests,
    events: builder.events,
    groups: builder.groups,
    snapshots: deriveRequestSnapshots(requests, builder.events),
  }
  const issues = validateStrategyTrace(trace)
  if (issues.length > 0) throw new Error(issues.join('\n'))
  return trace
}

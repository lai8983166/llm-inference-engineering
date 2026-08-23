import {
  assessComparability,
  measureWindow,
  type BenchmarkRun,
  type MeasurementWindow,
} from './benchmarkEvidence'

const clientWindow: MeasurementWindow = {
  id: 'client-e2e',
  observer: 'client',
  startEvent: 'client-start',
  endEvent: 'request-complete',
}

function makeRun(overrides: Partial<BenchmarkRun> = {}): BenchmarkRun {
  return {
    id: 'run-a-1',
    implementation: 'A',
    sequence: 1,
    phase: 'warm',
    status: 'succeeded',
    evidence: 'simulated',
    workload: {
      taskId: 'same-prompt-set',
      inputTokens: 128,
      outputLimit: 32,
      producedOutputTokens: 24,
      concurrency: 1,
    },
    environment: {
      modelId: 'teaching-model',
      modelRevision: 'r1',
      hardwareId: 'teaching-device',
      softwareStack: 'runtime-1',
    },
    events: [
      { runId: 'run-a-1', observer: 'client', name: 'client-start', timestampMs: 10 },
      { runId: 'run-a-1', observer: 'client', name: 'request-complete', timestampMs: 58 },
    ],
    ...overrides,
  }
}

describe('benchmark evidence', () => {
  it('derives a duration from raw events owned by one observer', () => {
    expect(measureWindow(makeRun(), clientWindow)).toEqual({
      ok: true,
      runId: 'run-a-1',
      windowId: 'client-e2e',
      observer: 'client',
      startMs: 10,
      endMs: 58,
      durationMs: 48,
      evidence: 'simulated',
    })
  })

  it('refuses to invent a duration when either boundary is missing', () => {
    const missingStart = makeRun({
      events: [{ runId: 'run-a-1', observer: 'client', name: 'request-complete', timestampMs: 58 }],
    })
    const missingEnd = makeRun({
      events: [{ runId: 'run-a-1', observer: 'client', name: 'client-start', timestampMs: 10 }],
    })

    expect(measureWindow(missingStart, clientWindow)).toMatchObject({ ok: false, code: 'missing-start' })
    expect(measureWindow(missingEnd, clientWindow)).toMatchObject({ ok: false, code: 'missing-end' })
  })

  it('rejects an end event that occurs before the start event', () => {
    const reversed = makeRun({
      events: [
        { runId: 'run-a-1', observer: 'client', name: 'client-start', timestampMs: 58 },
        { runId: 'run-a-1', observer: 'client', name: 'request-complete', timestampMs: 10 },
      ],
    })

    expect(measureWindow(reversed, clientWindow)).toMatchObject({ ok: false, code: 'end-before-start' })
  })

  it('rejects event boundaries observed by a different clock owner', () => {
    const mixedObserver = makeRun({
      events: [
        { runId: 'run-a-1', observer: 'client', name: 'client-start', timestampMs: 10 },
        { runId: 'run-a-1', observer: 'server', name: 'request-complete', timestampMs: 58 },
      ],
    })

    expect(measureWindow(mixedObserver, clientWindow)).toMatchObject({ ok: false, code: 'observer-mismatch' })
  })

  it('reports workload differences instead of comparing unlike runs', () => {
    const implementationA = makeRun()
    const implementationB = makeRun({
      id: 'run-b-1',
      implementation: 'B',
      workload: { ...makeRun().workload, producedOutputTokens: 12 },
      events: [
        { runId: 'run-b-1', observer: 'client', name: 'client-start', timestampMs: 10 },
        { runId: 'run-b-1', observer: 'client', name: 'request-complete', timestampMs: 42 },
      ],
    })

    expect(assessComparability(implementationA, implementationB)).toEqual({
      comparable: false,
      issues: ['different-workload'],
    })
  })

  it('allows implementation identity to differ under the same workload and environment', () => {
    const implementationB = makeRun({ implementation: 'B' })
    expect(assessComparability(makeRun(), implementationB)).toEqual({ comparable: true, issues: [] })
  })
})

import {
  assessKvFailurePrediction,
  assessKvMigrationOrder,
  kvFirstFailureQuestion,
  kvPracticeTrace,
} from './kvPractice'
import { classifyCapacityFailure, validateKvTrace } from './kvStateTrace'

describe('kv memory event practice domain', () => {
  it('builds a valid practice trace on a fresh workload and pool', () => {
    expect(validateKvTrace(kvPracticeTrace)).toEqual([])
    expect(kvPracticeTrace.requests.map((request) => request.id)).toEqual(['P-a', 'P-b', 'P-c'])
    expect(kvPracticeTrace.poolCapacityTokens).toBe(16)
    expect(kvPracticeTrace.events.filter((event) => event.kind === 'rejected').map((event) => event.requestId))
      .toEqual(['P-b', 'P-c'])
  })

  it('derives the expected first-failure category from the raw intervals', () => {
    const { pool, demandTokens, requestId, logicalStep } = kvFirstFailureQuestion

    expect(requestId).toBe('P-b')
    expect(logicalStep).toBe(1)
    expect(demandTokens).toBe(9)
    // 归因答案由分类函数从原始区间计算，不是页面里手写的常数。
    expect(classifyCapacityFailure(pool.intervals, demandTokens, 16)).toBe(kvFirstFailureQuestion.expected)
    expect(kvFirstFailureQuestion.expected).toBe('over-reservation')
    expect(pool.intervals).toEqual([
      expect.objectContaining({ start: 0, capacityTokens: 14, usedTokens: 5, owner: 'P-a' }),
      expect.objectContaining({ start: 14, capacityTokens: 2, owner: null, role: 'free' }),
    ])
  })

  it('checks failure predictions without inventing a performance score', () => {
    expect(assessKvFailurePrediction('over-reservation').correct).toBe(true)
    expect(assessKvFailurePrediction('external-fragmentation')).toMatchObject({
      correct: false,
      expected: 'over-reservation',
    })
    expect(assessKvFailurePrediction(undefined).correct).toBe(false)
  })

  it('grades the migration order against the authority contract', () => {
    expect(assessKvMigrationOrder(['apply', 'copy', 'publish', 'wait', 'release'])).toMatchObject({ correct: 5, total: 5 })
    const wrong = assessKvMigrationOrder(['apply', 'copy', 'release', 'wait', 'publish'])
    expect(wrong.correct).toBe(3)
    expect(wrong.positions[2]).toMatchObject({ selectedStep: 'release', expectedStep: 'publish', correct: false })
  })
})

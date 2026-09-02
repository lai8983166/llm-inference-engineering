import {
  baselineDecodeBudget,
  ceiling,
  noiseCases,
  optimizeReport,
  optimizations,
  share,
  total,
} from './bottleneckLedger'

const reports = Object.fromEntries(optimizations.map((spec) => [spec.id, optimizeReport(baselineDecodeBudget, spec)]))

describe('bottleneck ledger arithmetic', () => {
  it('keeps the launch-dominated baseline of twenty units', () => {
    expect(baselineDecodeBudget).toEqual({ submit: 2, launch: 8, sync: 2, memory: 6, compute: 2 })
    expect(total(baselineDecodeBudget)).toBe(20)
    expect(share(baselineDecodeBudget, 'launch')).toBe(0.4)
    expect(share(baselineDecodeBudget, 'compute')).toBe(0.1)
  })

  it('shows kernel halved while the service gains only five percent', () => {
    const report = reports['faster-kernel']
    expect(report.after.compute).toBe(1)
    expect(report.afterTotal).toBe(19)
    expect(report.speedup).toBeCloseTo(20 / 19, 10)
    // “kernel 快了一倍”与“服务快 5%”同时为真。
    expect(report.speedup).toBeLessThan(1.06)
    expect(report.targetShare).toBeCloseTo(0.1, 10)
  })

  it('gives each optimization its hand-checked gain and ceiling', () => {
    expect(reports['cuda-graph'].afterTotal).toBe(14)
    expect(reports['cuda-graph'].speedup).toBeCloseTo(20 / 14, 10)
    expect(reports['kv-quant'].afterTotal).toBe(17)
    expect(reports['kv-quant'].speedup).toBeCloseTo(20 / 17, 10)
    expect(reports['no-sync'].afterTotal).toBe(18)
    expect(reports['no-sync'].speedup).toBeCloseTo(20 / 18, 10)

    // Amdahl 上限：1/(1−占比)。
    expect(ceiling(baselineDecodeBudget, 'compute')).toBeCloseTo(20 / 18, 10)
    expect(ceiling(baselineDecodeBudget, 'launch')).toBeCloseTo(20 / 12, 10)
    expect(ceiling(baselineDecodeBudget, 'memory')).toBeCloseTo(20 / 14, 10)
    // 任何优化的收益都不超过其目标部件的上限。
    for (const report of Object.values(reports)) {
      expect(report.speedup).toBeLessThanOrEqual(report.targetCeiling + 1e-9)
    }
  })

  it('ranks optimizations by share, not by intuition', () => {
    const gains = Object.values(reports).sort((left, right) => right.speedup - left.speedup)
    expect(gains.map((report) => report.spec.target)).toEqual(['launch', 'memory', 'sync', 'compute'])
  })
})

describe('fixed noise sample cases', () => {
  it('flags overlapping ranges as unsupported claims', () => {
    const [withinNoise] = noiseCases()

    expect(withinNoise.beforeMean).toBe(20)
    expect(withinNoise.afterMean).toBe(20)
    expect(withinNoise.rangesOverlap).toBe(true)
    expect(withinNoise.claimSupported).toBe(false)
  })

  it('supports separated ranges only with same-condition caveat', () => {
    const realGain = noiseCases()[1]
    expect(realGain.afterMean).toBe(14.2)
    expect(realGain.beforeRange).toEqual([18, 22])
    expect(realGain.afterRange).toEqual([13, 15])
    expect(realGain.rangesOverlap).toBe(false)
    expect(realGain.claimSupported).toBe(true)
  })

  it('does not embed measured time or utilization fields', () => {
    const serialized = JSON.stringify([baselineDecodeBudget, optimizations, noiseCases()])
    const keys = [...serialized.matchAll(/"([^"]+)":/g)].map((match) => match[1].toLowerCase())

    expect(keys.some((key) => /(millisecond|duration|latency|utilization|throughput|timestamp|bandwidth|ms$|gb|flops)/.test(key))).toBe(false)
  })
})

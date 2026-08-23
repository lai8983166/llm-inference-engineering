/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { boundaryEvents, boundaryWindows, distributionRuns, warmupRuns } from '@/learning/baselineCase'

const source = readFileSync(resolve('src/content/chapters/trustworthy-baseline.mdx'), 'utf8')

describe('trustworthy baseline narrative', () => {
  it('uses five cognitive turns instead of a catalogue of benchmark terms', () => {
    const headings = [...source.matchAll(/^<h2 id="([^"]+)">(.+)<\/h2>$/gm)]
    expect(headings.map((match) => match[1])).toEqual([
      'same-work',
      'observer-window',
      'async-completion',
      'cold-and-steady',
      'evidence',
    ])
    expect(source).not.toMatch(/^## (原理|工程视角|最佳实践|总结)/m)
  })

  it('introduces contracts and measurement terms after their motivating contradiction', () => {
    expect(source.indexOf('少做了十二步')).toBeLessThan(source.indexOf('正确性合同'))
    expect(source.indexOf('没有写这段时间是由谁看见的')).toBeLessThan(source.indexOf('观察者、起始事件、结束事件'))
    expect(source.indexOf('主机却在 `20 ms` 就停止计时')).toBeLessThan(source.indexOf('完成 event'))
    expect(source.indexOf('第一次运行')).toBeLessThan(source.indexOf('warm-up'))
  })

  it('keeps prose arithmetic aligned with the deterministic case data', () => {
    const eventTime = (observer: string, name: string) => boundaryEvents.find((event) => (
      event.observer === observer && event.name === name
    ))?.timestampMs
    const durations = boundaryWindows.map((window) => (
      (eventTime(window.observer, window.endEvent) ?? 0) - (eventTime(window.observer, window.startEvent) ?? 0)
    ))
    expect(durations).toEqual([80, 66, 2, 47])
    expect(warmupRuns.A).toEqual([168, 112, 103, 100, 101, 99])
    expect(warmupRuns.B).toEqual([240, 125, 92, 90, 91, 89])
    expect(distributionRuns.A).toHaveLength(10)
    expect(distributionRuns.B).toHaveLength(10)
    for (const value of [...durations, ...warmupRuns.A, ...warmupRuns.B]) {
      expect(source).toContain(String(value))
    }
  })

  it('ends with a bounded claim and transfers the unresolved completion event to chapter one', () => {
    expect(source).toContain('该轨迹只验证测量协议，真实设备收益仍需按同一协议实测')
    expect(source).toContain('下一章将进入一次请求内部')
    expect(source).not.toContain('<TracePractice')
    expect(source).not.toContain('<ChapterAssessment')
  })

  it('places practice and transfer review after the complete explanatory chain', () => {
    const finalBody = source.indexOf('下一章将进入一次请求内部')
    const practice = source.indexOf('<TimingWindowPractice')
    const assessment = source.indexOf('<BaselineAssessment')
    expect(finalBody).toBeLessThan(practice)
    expect(practice).toBeLessThan(assessment)
  })
})

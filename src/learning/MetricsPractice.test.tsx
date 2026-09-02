import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  assessChainOrder,
  assessHiddenByDefinition,
  metricsPracticeTrace,
  trueTtfts,
} from './metricsPractice'
import { noLeakIssues } from './terminationTrace'
import { MetricsReportPractice } from './MetricsReportPractice'
import { MetricsTransferAssessment } from './MetricsTransferAssessment'

describe('metrics report practice domain', () => {
  it('builds a valid practice trace with real queue waits', () => {
    expect(noLeakIssues(metricsPracticeTrace)).toEqual([])
    expect(metricsPracticeTrace.ticks).toHaveLength(7)
    expect(trueTtfts).toEqual([
      { requestId: 'N-a', queueTicks: 0, ttftTicks: 0 },
      { requestId: 'N-b', queueTicks: 0, ttftTicks: 1 },
      { requestId: 'N-c', queueTicks: 3, ttftTicks: 3 },
      { requestId: 'N-d', queueTicks: 2, ttftTicks: 3 },
    ])
  })

  it('grades the hidden-definition judgment and the chain order', () => {
    expect(assessHiddenByDefinition('queue-hidden').correct).toBe(true)
    expect(assessHiddenByDefinition('token-count')).toMatchObject({ correct: false, expected: 'queue-hidden' })
    expect(assessChainOrder(['events', 'per-request', 'distribution', 'verdict']))
      .toMatchObject({ correct: 4, total: 4 })
    const wrong = assessChainOrder(['per-request', 'events', 'distribution', 'verdict'])
    expect(wrong.correct).toBe(2)
    expect(wrong.positions[0]).toMatchObject({ selectedStep: 'per-request', expectedStep: 'events', correct: false })
  })
})

describe('metrics report practice component', () => {
  it('shows the raw events and the claim-versus-truth table before any explanation', () => {
    render(<MetricsReportPractice />)

    expect(screen.getByRole('table', { name: '待审查的模拟原始事件' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: '报告声称值与事件流真实值对照' })).toBeInTheDocument()
    expect(screen.queryByText(/正确答案是/)).not.toBeInTheDocument()
  })

  it('requires a locked prediction before revealing the evidence', async () => {
    const user = userEvent.setup()
    render(<MetricsReportPractice />)

    await user.click(screen.getByRole('radio', { name: /排队拍：首 token 从准入起算/ }))
    await user.click(screen.getByRole('button', { name: '锁定判断，查看依据' }))
    const feedback = screen.getByText('判断与事件流一致', { selector: '.prediction-feedback strong' }).closest('div')!
    expect(within(feedback).getByText(/5 拍排队/)).toBeInTheDocument()
    expect(within(feedback).getByText(/平均是 1.75 拍而不是 0 拍/)).toBeInTheDocument()
    expect(within(feedback).getByText(/拍是事件刻度，不是时间/)).toBeInTheDocument()
  })

  it('grades a rebuilt chain order and marks every result simulated', async () => {
    const user = userEvent.setup()
    render(<MetricsReportPractice />)

    for (const label of ['按钉死的定义算每请求指标', '保留原始事件（到达/准入/输出/终态）', '把全体取值排成分布并取分位', '用阈值加分位给出 SLO 判定']) {
      await user.click(screen.getByRole('button', { name: label }))
    }
    await user.click(screen.getByRole('button', { name: '检查顺序' }))

    expect(screen.getByText('2 / 4 个位置正确')).toBeInTheDocument()
    expect(screen.getByText('应为：保留原始事件（到达/准入/输出/终态）')).toBeInTheDocument()
    expect(screen.getAllByText(/simulated · 拍是事件刻度/).length).toBeGreaterThanOrEqual(4)
    expect(screen.getByText(/没有原始事件，定义无从核对/)).toBeInTheDocument()
  })

  it('writes no storage while predicting or reordering', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(Storage.prototype, 'setItem')
    render(<MetricsReportPractice />)

    await user.click(screen.getByRole('radio', { name: /token 数/ }))
    await user.click(screen.getByRole('button', { name: '锁定判断，查看依据' }))
    await user.click(screen.getByRole('button', { name: '保留原始事件（到达/准入/输出/终态）' }))
    await user.click(screen.getByRole('button', { name: '清空重排' }))

    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('metrics transfer assessment component', () => {
  it('checks the fatal loop-and-goodput error before the free-text dimensions', async () => {
    const user = userEvent.setup()
    render(<MetricsTransferAssessment />)

    expect(screen.getByRole('button', { name: '检查审查起点' })).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: /闭环的零排队是负载生成器的性质/ }))
    await user.click(screen.getByRole('button', { name: '检查审查起点' }))
    expect(screen.getByText('先把环式与口径分开')).toBeInTheDocument()
    expect(screen.getByText(/goodput 是 5 不是 8/)).toBeInTheDocument()
  })

  it('covers six review dimensions without requiring metric names', () => {
    render(<MetricsTransferAssessment />)

    expect(screen.getAllByRole('listitem')).toHaveLength(6)
    expect(screen.getByText(/定义：两个报告的数字为什么对不上/)).toBeInTheDocument()
    expect(screen.getByText(/分布：只有均值的报告漏了什么/)).toBeInTheDocument()
    expect(screen.getByText(/环式：零排队证明了什么/)).toBeInTheDocument()
    expect(screen.getByText(/口径：吞吐等于 goodput 吗/)).toBeInTheDocument()
    expect(screen.getByText(/证据边界：这份报告最多能说什么/)).toBeInTheDocument()
    expect(screen.getByText(/归因指向：下一步查哪一层/)).toBeInTheDocument()
    expect(screen.getByText(/不自动评分，也不产生掌握状态/)).toBeInTheDocument()
  })

  it('keeps the new load numbers visible for hand recomputation', () => {
    render(<MetricsTransferAssessment />)

    expect(screen.getByText(/队列全程为零，证明服务永不过载/)).toBeInTheDocument()
    expect(screen.getByText(/平均间隔 2.2 拍，满足平均 ≤4 的目标/)).toBeInTheDocument()
  })
})

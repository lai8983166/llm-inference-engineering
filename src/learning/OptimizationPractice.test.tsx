import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  assessAttributionOrder,
  assessGainMissReason,
  practiceReport,
} from './optimizationPractice'
import { OptimizationReportPractice } from './OptimizationReportPractice'
import { OptimizationTransferAssessment } from './OptimizationTransferAssessment'

describe('optimization report practice domain', () => {
  it('bundles the kernel-halving report with overlapping samples', () => {
    expect(practiceReport.claim).toContain('计算 kernel 时间减半')
    expect(practiceReport.kernelReport.speedup).toBeCloseTo(20 / 19, 10)
    expect(practiceReport.kernelReport.targetCeiling).toBeCloseTo(20 / 18, 10)
    expect(practiceReport.samples.rangesOverlap).toBe(true)
  })

  it('grades the miss reason (share before noise) and the chain order', () => {
    expect(assessGainMissReason('share-too-small').correct).toBe(true)
    expect(assessGainMissReason('noise-overlap')).toMatchObject({ correct: false, expected: 'share-too-small' })
    expect(assessAttributionOrder(['metric', 'budget', 'signature', 'hypothesis', 'experiment', 'verdict']))
      .toMatchObject({ correct: 6, total: 6 })
    const wrong = assessAttributionOrder(['budget', 'metric', 'signature', 'hypothesis', 'experiment', 'verdict'])
    expect(wrong.correct).toBe(4)
    expect(wrong.positions[0]).toMatchObject({ selectedStep: 'budget', expectedStep: 'metric', correct: false })
  })
})

describe('optimization report practice component', () => {
  it('shows the budget and sample tables before any explanation', () => {
    render(<OptimizationReportPractice />)

    expect(screen.getByRole('table', { name: '报告附带的预算分解' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: '报告附带的测量样本' })).toBeInTheDocument()
    expect(screen.queryByText(/首要问题是占比/)).not.toBeInTheDocument()
  })

  it('requires a locked prediction before revealing the evidence', async () => {
    const user = userEvent.setup()
    render(<OptimizationReportPractice />)

    await user.click(screen.getByRole('radio', { name: /计算只占一成/ }))
    await user.click(screen.getByRole('button', { name: '锁定归因，查看依据' }))
    const feedback = screen.getByText('归因与算术一致', { selector: '.prediction-feedback strong' }).closest('div')!
    expect(within(feedback).getByText(/换不来“显著”/)).toBeInTheDocument()
    expect(within(feedback).getByText(/第二重问题/)).toBeInTheDocument()
    expect(within(feedback).getByText(/不是真实测量/)).toBeInTheDocument()
  })

  it('grades a rebuilt attribution chain and marks every result simulated', async () => {
    const user = userEvent.setup()
    render(<OptimizationReportPractice />)

    for (const label of ['预算分解：现场测出五部件占比', '指标异常：按第 08 章口径定位层与分位', '指纹对照：找出主导部件与嫌疑优化', '写成可反驳的假设并查收益上限', '最小实验：一次只改一处，按分布比较', '确认或推翻：收益与上限相符才算确认']) {
      await user.click(screen.getByRole('button', { name: label }))
    }
    await user.click(screen.getByRole('button', { name: '检查顺序' }))

    expect(screen.getByText('4 / 6 个位置正确')).toBeInTheDocument()
    expect(screen.getByText('应为：指标异常：按第 08 章口径定位层与分位')).toBeInTheDocument()
    expect(screen.getAllByText(/simulated · 归因链是教学合同/).length).toBeGreaterThanOrEqual(6)
    expect(screen.getByText(/把噪声当证据/)).toBeInTheDocument()
  })

  it('writes no storage while predicting or reordering', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(Storage.prototype, 'setItem')
    render(<OptimizationReportPractice />)

    await user.click(screen.getByRole('radio', { name: /样本范围重叠/ }))
    await user.click(screen.getByRole('button', { name: '锁定归因，查看依据' }))
    await user.click(screen.getByRole('button', { name: '指标异常：按第 08 章口径定位层与分位' }))
    await user.click(screen.getByRole('button', { name: '清空重排' }))

    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('optimization transfer assessment component', () => {
  it('checks the fatal ceiling-and-noise error before the free-text dimensions', async () => {
    const user = userEvent.setup()
    render(<OptimizationTransferAssessment />)

    expect(screen.getByRole('button', { name: '检查审查起点' })).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: /“必然快”先撞占比上限/ }))
    await user.click(screen.getByRole('button', { name: '检查审查起点' }))
    expect(screen.getByText('先查上限，再看样本')).toBeInTheDocument()
    expect(screen.getByText(/超过硬顶/)).toBeInTheDocument()
    expect(screen.getByText(/连“有效”都不支持/)).toBeInTheDocument()
  })

  it('covers six review dimensions without requiring law names', () => {
    render(<OptimizationTransferAssessment />)

    expect(screen.getAllByRole('listitem')).toHaveLength(6)
    expect(screen.getByText(/预算算术：颠倒的表里收益是多少/)).toBeInTheDocument()
    expect(screen.getByText(/指纹：这份报告的嫌疑部件是谁/)).toBeInTheDocument()
    expect(screen.getByText(/上限：声称的 ×1.8 可能吗/)).toBeInTheDocument()
    expect(screen.getByText(/噪声：三组样本怎么判/)).toBeInTheDocument()
    expect(screen.getByText(/证据边界：教学表能证明什么/)).toBeInTheDocument()
    expect(screen.getByText(/归因链：为这份报告设计实验/)).toBeInTheDocument()
    expect(screen.getByText(/不自动评分，也不产生掌握状态/)).toBeInTheDocument()
  })

  it('keeps the inverted budget visible for hand recomputation', () => {
    render(<OptimizationTransferAssessment />)

    expect(screen.getByText(/提交 2、launch 2、同步 2、访存 8、计算 6，合计 20 单位/)).toBeInTheDocument()
    expect(screen.getByText(/均值从 21.6 降到 20.8/)).toBeInTheDocument()
  })
})

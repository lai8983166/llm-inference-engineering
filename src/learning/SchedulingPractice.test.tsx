import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  assessTickOrder,
  assessWaitingCause,
  scheduleFirstWaiting,
  schedulePracticeTrace,
} from './schedulePractice'
import { validateScheduleTrace } from './scheduleTrace'
import { TickLedgerPractice } from './TickLedgerPractice'
import { SchedulingTransferAssessment } from './SchedulingTransferAssessment'

describe('tick ledger practice domain', () => {
  it('builds a valid practice trace with a real admission wait', () => {
    expect(validateScheduleTrace(schedulePracticeTrace)).toEqual([])
    const waiting = schedulePracticeTrace.events.filter((event) => event.kind === 'admission-waiting')
    expect(waiting.length).toBeGreaterThan(0)
    expect(waiting[0]).toMatchObject({ requestId: 'T-b', tick: 0, blocks: 2 })
    // T-b 直到 T-a 完成释放后才准入（t3 完成 → t4 准入）。
    const admitted = schedulePracticeTrace.events.find((event) => event.requestId === 'T-b' && event.kind === 'admitted')!
    expect(admitted.tick).toBe(4)
  })

  it('exposes the first waiting event with free and needed blocks', () => {
    expect(scheduleFirstWaiting).toMatchObject({ requestId: 'T-b', tick: 0, neededBlocks: 2, freeBlocks: 1 })
  })

  it('grades the waiting cause and the tick order', () => {
    expect(assessWaitingCause('not-enough-blocks').correct).toBe(true)
    expect(assessWaitingCause('not-selected')).toMatchObject({ correct: false, expected: 'not-enough-blocks' })
    expect(assessTickOrder(['arrivals', 'admission', 'runnable', 'select', 'execute', 'finish']))
      .toMatchObject({ correct: 6, total: 6 })
    const wrong = assessTickOrder(['select', 'arrivals', 'admission', 'runnable', 'execute', 'finish'])
    expect(wrong.correct).toBe(2)
    expect(wrong.positions[0]).toMatchObject({ selectedStep: 'select', expectedStep: 'arrivals', correct: false })
  })
})

describe('tick ledger practice component', () => {
  it('shows the raw ledger and waiting facts before any explanation', () => {
    render(<TickLedgerPractice />)

    expect(screen.getByRole('table', { name: '待审查的模拟逐拍事件' })).toBeInTheDocument()
    expect(screen.getByText(/`T-b` 在 t0 需要 2 个块，池中空闲 1 个块/)).toBeInTheDocument()
    expect(screen.queryByText(/正确归因/)).not.toBeInTheDocument()
  })

  it('requires a locked prediction before revealing the evidence', async () => {
    const user = userEvent.setup()
    render(<TickLedgerPractice />)

    await user.click(screen.getByRole('radio', { name: /空闲块不足/ }))
    await user.click(screen.getByRole('button', { name: '锁定归因，查看依据' }))
    const feedback = screen.getByText('归因与账本一致', { selector: '.prediction-feedback strong' }).closest('div')!
    expect(within(feedback).getByText(/先来后到让位于容量可行性/)).toBeInTheDocument()
    expect(within(feedback).getByText(/simulated · 非真实延迟证据/)).toBeInTheDocument()
  })

  it('grades a rebuilt tick order and marks every result simulated', async () => {
    const user = userEvent.setup()
    render(<TickLedgerPractice />)

    for (const label of ['登记本拍到达的请求', '重试准入并登记等待原因', '按策略选择本拍工作', '重算可运行集合', '执行被选中的 prefill 或 decode 组', '完成者当拍离开并归还块']) {
      await user.click(screen.getByRole('button', { name: label }))
    }
    await user.click(screen.getByRole('button', { name: '检查顺序' }))

    expect(screen.getByText('4 / 6 个位置正确')).toBeInTheDocument()
    expect(screen.getByText('应为：重算可运行集合')).toBeInTheDocument()
    expect(screen.getAllByText(/simulated · 非真实延迟证据/).length).toBeGreaterThanOrEqual(6)
    expect(screen.getByText(/不重算可运行集合就会执行已完成的请求/)).toBeInTheDocument()
  })

  it('writes no storage while predicting or reordering', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(Storage.prototype, 'setItem')
    render(<TickLedgerPractice />)

    await user.click(screen.getByRole('radio', { name: /调度器没有选中它/ }))
    await user.click(screen.getByRole('button', { name: '锁定归因，查看依据' }))
    await user.click(screen.getByRole('button', { name: '登记本拍到达的请求' }))
    await user.click(screen.getByRole('button', { name: '清空重排' }))

    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('scheduling transfer assessment component', () => {
  it('checks the fatal dimension error before the free-text dimensions', async () => {
    const user = userEvent.setup()
    render(<SchedulingTransferAssessment />)

    expect(screen.getByRole('button', { name: '检查审查起点' })).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: /把拍数差换算成了延迟百分比/ }))
    await user.click(screen.getByRole('button', { name: '检查审查起点' }))
    expect(screen.getByText('先把时间结论退回去')).toBeInTheDocument()
    expect(screen.getByText(/任何延迟、百分比或尾延迟结论都需要真实测量/)).toBeInTheDocument()
  })

  it('covers six review dimensions without requiring scheme names', () => {
    render(<SchedulingTransferAssessment />)

    expect(screen.getAllByRole('listitem')).toHaveLength(6)
    expect(screen.getByText(/决定点：这份报告把什么当成了调度/)).toBeInTheDocument()
    expect(screen.getByText(/可运行合同：`U-x` 的等待原因是什么/)).toBeInTheDocument()
    expect(screen.getByText(/成员重组：连续组织改变了什么、没改变什么/)).toBeInTheDocument()
    expect(screen.getByText(/竞争权衡：换 prefill 优先“立刻解决”了吗/)).toBeInTheDocument()
    expect(screen.getByText(/证据边界：8 拍压到 6 拍最多能说明什么/)).toBeInTheDocument()
    expect(screen.getByText(/待解问题：容量压力下这批请求会怎样/)).toBeInTheDocument()
    expect(screen.getByText(/不自动评分，也不产生掌握状态/)).toBeInTheDocument()
  })

  it('keeps the new workload numbers visible for hand recomputation', () => {
    render(<SchedulingTransferAssessment />)

    expect(screen.getByText(/`U-x`（prompt 4 \+ 输出 3）/)).toBeInTheDocument()
    expect(screen.getByText(/块池 4 块 × 4 unit，策略 decode 优先/)).toBeInTheDocument()
  })
})

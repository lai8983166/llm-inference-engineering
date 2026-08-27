import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  assessAdmissionOrder,
  assessRejectionMeaning,
  overloadFirstRejection,
  overloadPracticeTrace,
} from './overloadPractice'
import { validateOverloadTrace } from './overloadTrace'
import { OverloadLedgerPractice } from './OverloadLedgerPractice'
import { OverloadTransferAssessment } from './OverloadTransferAssessment'

describe('overload ledger practice domain', () => {
  it('builds a valid practice trace with a real rejection', () => {
    expect(validateOverloadTrace(overloadPracticeTrace)).toEqual([])
    const rejected = overloadPracticeTrace.events.filter((event) => event.kind === 'rejected')
    expect(rejected).toHaveLength(1)
    expect(rejected[0]).toMatchObject({ requestId: 'Q-3', tick: 1, neededBlocks: 2, freeBlocks: 0 })
  })

  it('exposes the first rejection with its verdict inputs', () => {
    expect(overloadFirstRejection).toMatchObject({
      requestId: 'Q-3',
      tick: 1,
      neededBlocks: 2,
      freeBlocks: 0,
      watermark: 0,
    })
  })

  it('grades the rejection meaning and the admission order', () => {
    expect(assessRejectionMeaning('caller-bears-cost').correct).toBe(true)
    expect(assessRejectionMeaning('selection-order')).toMatchObject({ correct: false, expected: 'caller-bears-cost' })
    expect(assessAdmissionOrder(['register', 'inputs', 'decide', 'record', 'handoff']))
      .toMatchObject({ correct: 5, total: 5 })
    const wrong = assessAdmissionOrder(['decide', 'register', 'inputs', 'record', 'handoff'])
    expect(wrong.correct).toBe(2)
    expect(wrong.positions[0]).toMatchObject({ selectedStep: 'decide', expectedStep: 'register', correct: false })
  })
})

describe('overload ledger practice component', () => {
  it('shows the raw ledger and verdict inputs before any explanation', () => {
    render(<OverloadLedgerPractice />)

    expect(screen.getByRole('table', { name: '待审查的模拟过载事件' })).toBeInTheDocument()
    expect(screen.getByText(/`Q-3` 在 t1 需要 2 个块，池中空闲 0 个块/)).toBeInTheDocument()
    expect(screen.queryByText(/正确归因/)).not.toBeInTheDocument()
  })

  it('requires a locked prediction before revealing the evidence', async () => {
    const user = userEvent.setup()
    render(<OverloadLedgerPractice />)

    await user.click(screen.getByRole('radio', { name: /调用方承担过载成本/ }))
    await user.click(screen.getByRole('button', { name: '锁定归因，查看依据' }))
    const feedback = screen.getByText('归因与账本一致', { selector: '.prediction-feedback strong' }).closest('div')!
    expect(within(feedback).getByText(/无论怎么排序，拿不到块的请求这一拍都执行不了/)).toBeInTheDocument()
    expect(within(feedback).getByText(/simulated · 非真实延迟证据/)).toBeInTheDocument()
  })

  it('grades a rebuilt admission order and marks every result simulated', async () => {
    const user = userEvent.setup()
    render(<OverloadLedgerPractice />)

    for (const label of ['计算 free、need 与水位', '登记到达与输入就绪', '作出准入/排队/拒绝/抢占裁决', '登记结果与原因（如等待块、被拒）', '交给本拍的选择与执行']) {
      await user.click(screen.getByRole('button', { name: label }))
    }
    await user.click(screen.getByRole('button', { name: '检查顺序' }))

    expect(screen.getByText('3 / 5 个位置正确')).toBeInTheDocument()
    expect(screen.getByText('应为：登记到达与输入就绪')).toBeInTheDocument()
    expect(screen.getAllByText(/simulated · 非真实延迟证据/).length).toBeGreaterThanOrEqual(5)
    expect(screen.getByText(/先裁决后登记会让等待与拒绝从账本上消失/)).toBeInTheDocument()
  })

  it('writes no storage while predicting or reordering', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(Storage.prototype, 'setItem')
    render(<OverloadLedgerPractice />)

    await user.click(screen.getByRole('radio', { name: /调度器选择了别人/ }))
    await user.click(screen.getByRole('button', { name: '锁定归因，查看依据' }))
    await user.click(screen.getByRole('button', { name: '登记到达与输入就绪' }))
    await user.click(screen.getByRole('button', { name: '清空重排' }))

    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('overload transfer assessment component', () => {
  it('checks the fatal cost error before the free-text dimensions', async () => {
    const user = userEvent.setup()
    render(<OverloadTransferAssessment />)

    expect(screen.getByRole('button', { name: '检查审查起点' })).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: /“重算不花钱”与 KV 已被丢弃矛盾/ }))
    await user.click(screen.getByRole('button', { name: '检查审查起点' }))
    expect(screen.getByText('先把成本账退回来')).toBeInTheDocument()
    expect(screen.getByText(/恢复必须重新 prefill prompt 加已生成 token/)).toBeInTheDocument()
  })

  it('covers six review dimensions without requiring scheme names', () => {
    render(<OverloadTransferAssessment />)

    expect(screen.getAllByRole('listitem')).toHaveLength(6)
    expect(screen.getByText(/决定点：过载发生在哪一拍/)).toBeInTheDocument()
    expect(screen.getByText(/承担者：每个裁决把成本寄给了谁/)).toBeInTheDocument()
    expect(screen.getByText(/抢占与重算：顺序与成本是什么/)).toBeInTheDocument()
    expect(screen.getByText(/水位：W=2 拒绝了谁、保护了谁/)).toBeInTheDocument()
    expect(screen.getByText(/证据边界：“吞吐提升 30%”从哪来/)).toBeInTheDocument()
    expect(screen.getByText(/待解问题：等待者消失时会发生什么/)).toBeInTheDocument()
    expect(screen.getByText(/不自动评分，也不产生掌握状态/)).toBeInTheDocument()
  })

  it('keeps the new burst numbers visible for hand recomputation', () => {
    render(<OverloadTransferAssessment />)

    expect(screen.getByText(/`R-1`（6\+3）与 `R-2`（5\+2）同拍到达/)).toBeInTheDocument()
    expect(screen.getByText(/块池 5 块 × 4 unit/)).toBeInTheDocument()
  })
})

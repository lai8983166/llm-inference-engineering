import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  assessBlockLifecycleOrder,
  assessBlockRejectionCause,
  blockFirstRejection,
  blockPracticeTrace,
} from './blockPractice'
import { validateBlockPoolTrace } from './blockPoolTrace'
import { BlockEventPractice } from './BlockEventPractice'
import { BlockLayoutAssessment } from './BlockLayoutAssessment'

describe('block event practice domain', () => {
  it('builds a valid practice trace on a fresh workload and pool', () => {
    expect(validateBlockPoolTrace(blockPracticeTrace)).toEqual([])
    expect(blockPracticeTrace.requests.map((request) => request.id)).toEqual(['Q-a', 'Q-b', 'Q-c'])
    expect(blockPracticeTrace.events.filter((event) => event.kind === 'rejected').map((event) => event.requestId))
      .toEqual(['Q-c'])
    // Q-b 在 step 1 内完成一次“分配新块”增长（3 → 4 token 越过块界）。
    expect(blockPracticeTrace.events.some((event) => event.requestId === 'Q-b' && event.kind === 'block-allocated'))
      .toBe(true)
  })

  it('exposes the first rejection with free and demanded block counts', () => {
    expect(blockFirstRejection).toMatchObject({ requestId: 'Q-c', logicalStep: 2, demandedBlocks: 3, freeBlocks: 1 })
    const heldUnits = blockFirstRejection.pool.blocks
      .filter((lease) => lease.owner !== null)
      .reduce((total, lease) => total + lease.usedTokens, 0)
    expect(heldUnits).toBe(8)
  })

  it('grades the rejection cause and the lifecycle order', () => {
    expect(assessBlockRejectionCause('not-enough-blocks').correct).toBe(true)
    expect(assessBlockRejectionCause('waste-too-large')).toMatchObject({ correct: false, expected: 'not-enough-blocks' })
    expect(assessBlockLifecycleOrder(['allocate', 'entry', 'write', 'release'])).toMatchObject({ correct: 4, total: 4 })
    const wrong = assessBlockLifecycleOrder(['entry', 'allocate', 'write', 'release'])
    expect(wrong.correct).toBe(2)
    expect(wrong.positions[0]).toMatchObject({ selectedStep: 'entry', expectedStep: 'allocate', correct: false })
  })
})

describe('block event practice component', () => {
  it('shows raw events and block states before any explanation', () => {
    render(<BlockEventPractice />)

    expect(screen.getByRole('table', { name: '待审查的模拟块池事件' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: '首个拒绝申请时刻的块池状态' })).toBeInTheDocument()
    expect(screen.getByText(/`Q-c` 在 t2 需要 3 个块，池中空闲 1 个块/)).toBeInTheDocument()
    expect(screen.queryByText(/正确归因/)).not.toBeInTheDocument()
  })

  it('requires a locked prediction before revealing the evidence', async () => {
    const user = userEvent.setup()
    render(<BlockEventPractice />)

    await user.click(screen.getByRole('radio', { name: /空闲块数不足/ }))
    await user.click(screen.getByRole('button', { name: '锁定归因，查看依据' }))
    const feedback = screen.getByText('归因与块状态一致', { selector: '.prediction-feedback strong' }).closest('div')!
    expect(within(feedback).getByText(/不是“空位太碎”的碎片问题/)).toBeInTheDocument()
    expect(within(feedback).getByText(/simulated · 非真实显存证据/)).toBeInTheDocument()
  })

  it('grades a rebuilt lifecycle order and marks every result simulated', async () => {
    const user = userEvent.setup()
    render(<BlockEventPractice />)

    for (const label of ['在块表末尾登记新表项', '从池中分配一个空闲块', '把新 token 写入该块', '请求结束后整块归还']) {
      await user.click(screen.getByRole('button', { name: label }))
    }
    await user.click(screen.getByRole('button', { name: '检查顺序' }))

    expect(screen.getByText('2 / 4 个位置正确')).toBeInTheDocument()
    expect(screen.getByText('应为：从池中分配一个空闲块')).toBeInTheDocument()
    expect(screen.getByText('应为：在块表末尾登记新表项')).toBeInTheDocument()
    expect(screen.getAllByText(/simulated · 非真实显存证据/).length).toBeGreaterThanOrEqual(4)
    expect(screen.getByText(/先登记后分配会留下悬空表项/)).toBeInTheDocument()
  })

  it('writes no storage while predicting or reordering', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(Storage.prototype, 'setItem')
    render(<BlockEventPractice />)

    await user.click(screen.getByRole('radio', { name: /块表太长/ }))
    await user.click(screen.getByRole('button', { name: '锁定归因，查看依据' }))
    await user.click(screen.getByRole('button', { name: '从池中分配一个空闲块' }))
    await user.click(screen.getByRole('button', { name: '清空重排' }))

    expect(spy).not.toHaveBeenCalled()
    expect(screen.getByText(/不写入存储，也不形成掌握状态/)).toBeInTheDocument()
    spy.mockRestore()
  })
})

describe('block layout assessment component', () => {
  it('checks the fatal ledger gap before the free-text dimensions', async () => {
    const user = userEvent.setup()
    render(<BlockLayoutAssessment />)

    expect(screen.getByRole('button', { name: '检查审查起点' })).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: /没有把表元数据与内部浪费入账/ }))
    await user.click(screen.getByRole('button', { name: '检查审查起点' }))
    expect(screen.getByText('账本先于一切结论')).toBeInTheDocument()
    expect(screen.getByText(/同时在场共 6 块，已经超过 4 块的池/)).toBeInTheDocument()
  })

  it('covers six review dimensions without requiring scheme names', () => {
    render(<BlockLayoutAssessment />)

    expect(screen.getAllByRole('listitem')).toHaveLength(6)
    expect(screen.getByText(/分段语义：拆开存改变了什么/)).toBeInTheDocument()
    expect(screen.getByText(/固定块与浪费归因/)).toBeInTheDocument()
    expect(screen.getByText(/块表翻译：用新配置复算账本/)).toBeInTheDocument()
    expect(screen.getByText(/准入与回收：第三个请求为什么进不来/)).toBeInTheDocument()
    expect(screen.getByText(/证据边界：这份报告最多能说什么/)).toBeInTheDocument()
    expect(screen.getByText(/待解问题：块池之后还缺什么/)).toBeInTheDocument()
    expect(screen.getByText(/不自动评分，也不产生掌握状态/)).toBeInTheDocument()
  })

  it('keeps the new config numbers visible for hand recomputation', () => {
    render(<BlockLayoutAssessment />)

    expect(screen.getByText(/2 层、4 个 query heads、2 个 KV heads、head dim 6、每元素 4 bytes/)).toBeInTheDocument()
    expect(screen.getByText(/4 块 × 6 token unit/)).toBeInTheDocument()
    expect(screen.getByText(/`K-p`（prompt 4 \+ 输出 4）/)).toBeInTheDocument()
  })
})

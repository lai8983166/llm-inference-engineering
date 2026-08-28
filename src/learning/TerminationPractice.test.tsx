import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  assessCleanupOrder,
  assessDisconnectRelease,
  terminationPracticeQuestions,
  terminationPracticeTrace,
} from './terminationPractice'
import { noLeakIssues } from './terminationTrace'
import { TerminationLedgerPractice } from './TerminationLedgerPractice'
import { TerminationTransferAssessment } from './TerminationTransferAssessment'

describe('termination ledger practice domain', () => {
  it('builds a valid practice trace with both injected terminations at t3', () => {
    expect(noLeakIssues(terminationPracticeTrace)).toEqual([])
    const terminals = terminationPracticeTrace.events.filter((event) => event.kind === 'terminated')
    expect(terminals.map((event) => [event.requestId, event.tick, event.cause])).toEqual([
      ['D-2', 3, 'disconnect'],
      ['D-3', 3, 'timeout'],
      ['D-4', 3, 'eos'],
      ['D-1', 4, 'eos'],
    ])
    expect(terminationPracticeQuestions).toEqual([
      { requestId: 'D-2', tick: 3, releasedBlocks: 2, leftQueue: false },
      { requestId: 'D-3', tick: 3, releasedBlocks: 0, leftQueue: true },
    ])
  })

  it('grades the release judgment and the cleanup order', () => {
    expect(assessDisconnectRelease('blocks-and-stream').correct).toBe(true)
    expect(assessDisconnectRelease('stream-only')).toMatchObject({ correct: false, expected: 'blocks-and-stream' })
    expect(assessCleanupOrder(['decide', 'inflight', 'release', 'close', 'record']))
      .toMatchObject({ correct: 5, total: 5 })
    const wrong = assessCleanupOrder(['decide', 'inflight', 'close', 'release', 'record'])
    expect(wrong.correct).toBe(3)
    expect(wrong.positions[2]).toMatchObject({ selectedStep: 'close', expectedStep: 'release', correct: false })
  })
})

describe('termination ledger practice component', () => {
  it('shows the raw ledger before any explanation', () => {
    render(<TerminationLedgerPractice />)

    expect(screen.getByRole('table', { name: '待审查的模拟终止事件' })).toBeInTheDocument()
    expect(screen.getByText(/两个终态都发生在 t3/)).toBeInTheDocument()
    expect(screen.queryByText(/正确答案是/)).not.toBeInTheDocument()
  })

  it('requires a locked prediction before revealing the evidence', async () => {
    const user = userEvent.setup()
    render(<TerminationLedgerPractice />)

    await user.click(screen.getByRole('radio', { name: /2 个块与输出流/ }))
    await user.click(screen.getByRole('button', { name: '锁定判断，查看依据' }))
    const feedback = screen.getByText('判断与账本一致', { selector: '.prediction-feedback strong' }).closest('div')!
    expect(within(feedback).getByText(/不需要等任何 decode 组/)).toBeInTheDocument()
    expect(within(feedback).getByText(/一个块都没有/)).toBeInTheDocument()
    expect(within(feedback).getByText(/simulated · 非真实延迟或可靠性证据/)).toBeInTheDocument()
  })

  it('grades a rebuilt cleanup order and marks every result simulated', async () => {
    const user = userEvent.setup()
    render(<TerminationLedgerPractice />)

    for (const label of ['终止裁决：确定原因并冻结状态', '在途安全：等已提交的工作结束', '关闭流：输出通道收尾', '释放块（如有）并离队（如在队）', '记录带原因的终态事件']) {
      await user.click(screen.getByRole('button', { name: label }))
    }
    await user.click(screen.getByRole('button', { name: '检查顺序' }))

    expect(screen.getByText('3 / 5 个位置正确')).toBeInTheDocument()
    expect(screen.getByText('应为：释放块（如有）并离队（如在队）')).toBeInTheDocument()
    expect(screen.getAllByText(/simulated · 非真实延迟或可靠性证据/).length).toBeGreaterThanOrEqual(5)
    expect(screen.getByText(/先关流后裁决/)).toBeInTheDocument()
  })

  it('writes no storage while predicting or reordering', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(Storage.prototype, 'setItem')
    render(<TerminationLedgerPractice />)

    await user.click(screen.getByRole('radio', { name: /只有输出流/ }))
    await user.click(screen.getByRole('button', { name: '锁定判断，查看依据' }))
    await user.click(screen.getByRole('button', { name: '终止裁决：确定原因并冻结状态' }))
    await user.click(screen.getByRole('button', { name: '清空重排' }))

    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('termination transfer assessment component', () => {
  it('checks the fatal misreading before the free-text dimensions', async () => {
    const user = userEvent.setup()
    render(<TerminationTransferAssessment />)

    expect(screen.getByRole('button', { name: '检查审查起点' })).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: /清理在终态当拍一次走完/ }))
    await user.click(screen.getByRole('button', { name: '检查审查起点' }))
    expect(screen.getByText('先把账本读对')).toBeInTheDocument()
    expect(screen.getByText(/两种半径都要让每位死者走完同一次清理/)).toBeInTheDocument()
  })

  it('covers six review dimensions without requiring scheme names', () => {
    render(<TerminationTransferAssessment />)

    expect(screen.getAllByRole('listitem')).toHaveLength(6)
    expect(screen.getByText(/状态覆盖：三处终止各落在什么状态/)).toBeInTheDocument()
    expect(screen.getByText(/清理仪式：每一步的依据是什么/)).toBeInTheDocument()
    expect(screen.getByText(/容量后果：断开释放的块去了哪/)).toBeInTheDocument()
    expect(screen.getByText(/爆炸半径：请求级失败杀死了谁/)).toBeInTheDocument()
    expect(screen.getByText(/证据边界：这份报告最多能说什么/)).toBeInTheDocument()
    expect(screen.getByText(/可观测终点：指标从哪里来/)).toBeInTheDocument()
    expect(screen.getByText(/不自动评分，也不产生掌握状态/)).toBeInTheDocument()
  })

  it('keeps the new injection set visible for hand recomputation', () => {
    render(<TerminationTransferAssessment />)

    expect(screen.getByText(/生成中的 `E-2` 被断开，排队的 `E-3` 越过期限，重算恢复中的 `E-4` 遇到错误/)).toBeInTheDocument()
    expect(screen.getByText(/平均多花 3 拍才清理完/)).toBeInTheDocument()
  })
})

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  assessLifecycleOrder,
  assessSharedRelease,
  practiceTrace,
  sharedBlockRelease,
} from './prefixCachePractice'
import { validatePrefixCacheTrace } from './prefixCacheTrace'
import { PrefixLedgerPractice } from './PrefixLedgerPractice'
import { PrefixCacheTransferAssessment } from './PrefixCacheTransferAssessment'

describe('prefix ledger practice domain', () => {
  it('builds a valid practice trace on the ragged prefix workload', () => {
    expect(validatePrefixCacheTrace(practiceTrace)).toEqual([])
    const miss = practiceTrace.events.find((event) => event.kind === 'prefix-miss')!
    expect(miss.blocks).toHaveLength(1)
    const hit = practiceTrace.events.find((event) => event.kind === 'prefix-hit')!
    expect(hit.hitTokens).toBe(4)
  })

  it('exposes the shared release with decrement-only semantics', () => {
    expect(sharedBlockRelease.decrementedBlocks.length).toBe(1)
    expect(sharedBlockRelease.cachedBlocks).toEqual([])
    expect(sharedBlockRelease.freedBlocks.length).toBeGreaterThan(0)
  })

  it('grades the release judgment and the lifecycle order', () => {
    expect(assessSharedRelease('decrement-not-free').correct).toBe(true)
    expect(assessSharedRelease('free-immediately')).toMatchObject({ correct: false, expected: 'decrement-not-free' })
    expect(assessLifecycleOrder(['miss', 'hit', 'use', 'decrement', 'cache', 'evict']))
      .toMatchObject({ correct: 6, total: 6 })
    const wrong = assessLifecycleOrder(['miss', 'hit', 'use', 'cache', 'decrement', 'evict'])
    expect(wrong.correct).toBe(4)
    expect(wrong.positions[3]).toMatchObject({ selectedStep: 'cache', expectedStep: 'decrement', correct: false })
  })
})

describe('prefix ledger practice component', () => {
  it('shows the raw ledger and release grouping before any explanation', () => {
    render(<PrefixLedgerPractice />)

    expect(screen.getByRole('table', { name: '待审查的模拟缓存事件' })).toBeInTheDocument()
    expect(screen.queryByText(/正确答案是/)).not.toBeInTheDocument()
  })

  it('requires a locked prediction before revealing the evidence', async () => {
    const user = userEvent.setup()
    render(<PrefixLedgerPractice />)

    await user.click(screen.getByRole('radio', { name: /只递减 rc 到 1/ }))
    await user.click(screen.getByRole('button', { name: '锁定判断，查看依据' }))
    const feedback = screen.getByText('判断与账本一致', { selector: '.prediction-feedback strong' }).closest('div')!
    expect(within(feedback).getByText(/让还在读它的 `T-a` 悬空/)).toBeInTheDocument()
    expect(within(feedback).getByText(/5-token 前缀只共享 1 块/)).toBeInTheDocument()
    expect(within(feedback).getByText(/simulated · rc 与拍数是教学记账/)).toBeInTheDocument()
  })

  it('grades a rebuilt lifecycle order and marks every result simulated', async () => {
    const user = userEvent.setup()
    render(<PrefixLedgerPractice />)

    for (const label of ['首算：为对齐前缀建共享块并登记缓存（rc=1）', '命中：后来的请求挂入块表（rc++）', '使用：两个请求各自 decode，共享块只读', '最后所有者离开：rc=0 转缓存（占池可命中）', '一位共享者完成：只递减 rc，不归还', '压力下：新申请超过空闲，LRU 逐出缓存块']) {
      await user.click(screen.getByRole('button', { name: label }))
    }
    await user.click(screen.getByRole('button', { name: '检查顺序' }))

    expect(screen.getByText('4 / 6 个位置正确')).toBeInTheDocument()
    expect(screen.getByText('应为：一位共享者完成：只递减 rc，不归还')).toBeInTheDocument()
    expect(screen.getAllByText(/simulated · 教学记账/).length).toBeGreaterThanOrEqual(6)
    expect(screen.getByText(/永不逐出/)).toBeInTheDocument()
  })

  it('writes no storage while predicting or reordering', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(Storage.prototype, 'setItem')
    render(<PrefixLedgerPractice />)

    await user.click(screen.getByRole('radio', { name: /立即归还空闲池/ }))
    await user.click(screen.getByRole('button', { name: '锁定判断，查看依据' }))
    await user.click(screen.getByRole('button', { name: '首算：为对齐前缀建共享块并登记缓存（rc=1）' }))
    await user.click(screen.getByRole('button', { name: '清空重排' }))

    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('prefix cache transfer assessment component', () => {
  it('checks the fatal ownership error before the free-text dimensions', async () => {
    const user = userEvent.setup()
    render(<PrefixCacheTransferAssessment />)

    expect(screen.getByRole('button', { name: '检查审查起点' })).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: /“完成即释放所有块”违背引用计数/ }))
    await user.click(screen.getByRole('button', { name: '检查审查起点' }))
    expect(screen.getByText('先修所有权，再谈其他')).toBeInTheDocument()
    expect(screen.getByText(/悬空仍在读的一方/)).toBeInTheDocument()
  })

  it('covers six review dimensions without requiring mechanism names', () => {
    render(<PrefixCacheTransferAssessment />)

    expect(screen.getAllByRole('listitem')).toHaveLength(6)
    expect(screen.getByText(/对齐：7-token 共享前缀能省几块/)).toBeInTheDocument()
    expect(screen.getByText(/所有权：取消一位共享方释放了什么/)).toBeInTheDocument()
    expect(screen.getByText(/逐出：哪块能走、哪块不能/)).toBeInTheDocument()
    expect(screen.getByText(/调度：优先命中者公平吗/)).toBeInTheDocument()
    expect(screen.getByText(/证据：命中率 60% 说明什么/)).toBeInTheDocument()
    expect(screen.getByText(/组合：再叠加投机解码要重签什么/)).toBeInTheDocument()
    expect(screen.getByText(/不自动评分，也不产生掌握状态/)).toBeInTheDocument()
  })

  it('keeps the ragged-prefix config visible for hand recomputation', () => {
    render(<PrefixCacheTransferAssessment />)

    expect(screen.getByText(/共享 7-token 前缀（毛边 3）/)).toBeInTheDocument()
    expect(screen.getByText(/池内驻留 2 块缓存（其中 1 块 rc=1）/)).toBeInTheDocument()
  })
})

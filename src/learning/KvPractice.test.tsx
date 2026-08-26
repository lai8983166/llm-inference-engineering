import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KvMemoryEventPractice } from './KvMemoryEventPractice'
import { KvStateAssessment } from './KvStateAssessment'

describe('kv memory event practice component', () => {
  it('shows the raw events and intervals before any explanation', () => {
    render(<KvMemoryEventPractice />)

    expect(screen.getByRole('table', { name: '待审查的模拟内存事件' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: '首个拒绝申请时刻的原始区间' })).toBeInTheDocument()
    expect(screen.getByText(/`P-b` 在 t1 申请 9 个连续 unit/)).toBeInTheDocument()
    expect(screen.getByText('[0, 14)')).toBeInTheDocument()
    expect(screen.getByText('[14, 16)')).toBeInTheDocument()
    expect(screen.queryByText(/正确类别/)).not.toBeInTheDocument()
  })

  it('requires a locked prediction before revealing the classification evidence', async () => {
    const user = userEvent.setup()
    render(<KvMemoryEventPractice />)

    await user.click(screen.getByRole('radio', { name: '过度预留' }))
    await user.click(screen.getByRole('button', { name: '锁定归因，查看依据' }))
    const feedback = screen.getByText('归因与区间一致', { selector: '.prediction-feedback strong' }).closest('div')!
    expect(within(feedback).getByText(/simulated · 非真实 GPU 显存证据/)).toBeInTheDocument()
    expect(within(feedback).getByText(/释放它们即可满足申请/)).toBeInTheDocument()

    expect(screen.queryByText(/正确类别/)).not.toBeInTheDocument()
  })

  it('grades a rebuilt migration order and keeps every result marked simulated', async () => {
    const user = userEvent.setup()
    render(<KvMemoryEventPractice />)

    const legalOrder = ['另址申请一段足够大的连续新区间', '把旧区间的 K/V 逐项复制到新区间', '发布新区间为请求的权威地址', '等待旧地址上的在途读取全部结束', '释放旧区间，归还给空闲池']
    for (const label of legalOrder) await user.click(screen.getByRole('button', { name: label }))
    await user.click(screen.getByRole('button', { name: '检查顺序' }))
    expect(screen.getByText('5 / 5 个位置正确')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '清空重排' }))
    const swapped = ['另址申请一段足够大的连续新区间', '把旧区间的 K/V 逐项复制到新区间', '释放旧区间，归还给空闲池', '等待旧地址上的在途读取全部结束', '发布新区间为请求的权威地址']
    for (const label of swapped) await user.click(screen.getByRole('button', { name: label }))
    await user.click(screen.getByRole('button', { name: '检查顺序' }))

    expect(screen.getByText('3 / 5 个位置正确')).toBeInTheDocument()
    expect(screen.getByText('应为：发布新区间为请求的权威地址')).toBeInTheDocument()
    expect(screen.getByText('应为：释放旧区间，归还给空闲池')).toBeInTheDocument()
    expect(screen.getAllByText(/simulated · 非真实 GPU 显存证据/).length).toBeGreaterThanOrEqual(5)
    expect(screen.getByText(/不能证明真实分配器的行为/)).toBeInTheDocument()
  })

  it('writes no storage while predicting, reordering, or reading feedback', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(Storage.prototype, 'setItem')
    render(<KvMemoryEventPractice />)

    await user.click(screen.getByRole('radio', { name: '搬迁峰值' }))
    await user.click(screen.getByRole('button', { name: '锁定归因，查看依据' }))
    await user.click(screen.getByRole('button', { name: '另址申请一段足够大的连续新区间' }))
    await user.click(screen.getByRole('button', { name: '清空重排' }))

    expect(spy).not.toHaveBeenCalled()
    expect(screen.getByText(/不写入存储，也不形成掌握状态/)).toBeInTheDocument()
    spy.mockRestore()
  })
})

describe('kv transfer assessment component', () => {
  it('checks the fatal ledger gap before the free-text dimensions', async () => {
    const user = userEvent.setup()
    render(<KvStateAssessment />)

    expect(screen.getByRole('button', { name: '检查审查起点' })).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: /账本只数了 prompt/ }))
    await user.click(screen.getByRole('button', { name: '检查审查起点' }))
    expect(screen.getByText('账本先于一切结论')).toBeInTheDocument()
    expect(screen.getByText(/合计 21，已经超过 20-unit 的池/)).toBeInTheDocument()
  })

  it('covers six review dimensions without asking for a paging scheme name', () => {
    render(<KvStateAssessment />)

    const dimensions = screen.getAllByRole('listitem')
    expect(screen.getByText(/依赖语义：哪些量必须跨步保存/)).toBeInTheDocument()
    expect(screen.getByText(/字节账本：用新配置逐项复算/)).toBeInTheDocument()
    expect(screen.getByText(/容量归因：第三个请求失败该归因于哪一类/)).toBeInTheDocument()
    expect(screen.getByText(/搬迁与释放：合法顺序是什么/)).toBeInTheDocument()
    expect(screen.getByText(/证据边界：这份报告最多能说什么/)).toBeInTheDocument()
    expect(screen.getByText(/待解布局：下一种布局必须保住什么/)).toBeInTheDocument()
    expect(dimensions.length).toBe(6)
    expect(screen.queryByText(/分页方案名|paged|block table/)).not.toBeInTheDocument()
    expect(screen.getByText(/不自动评分，也不产生掌握状态/)).toBeInTheDocument()
  })

  it('keeps the new model config numbers visible for hand recomputation', () => {
    render(<KvStateAssessment />)

    expect(screen.getByText(/3 层、4 个 query heads、1 个 KV head、head dim 4、每元素 4 bytes/)).toBeInTheDocument()
    expect(screen.getByText(/20 token unit 的物理池/)).toBeInTheDocument()
    expect(screen.getByText(/`K-x`（prompt 5 \+ 输出 3）/)).toBeInTheDocument()
  })
})

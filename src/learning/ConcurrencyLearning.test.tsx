import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConcurrencyAssessment } from './ConcurrencyAssessment'
import { ConcurrencyTracePractice } from './ConcurrencyTracePractice'

describe('chapter two trace audit and transfer assessment', () => {
  it('keeps raw events visible but requires a prediction before classification', async () => {
    const user = userEvent.setup()
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem')
    render(<ConcurrencyTracePractice />)

    expect(screen.getByRole('table', { name: '待审查的模拟原始事件' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: '逐条归类事件' })).not.toBeInTheDocument()
    await user.click(screen.getByLabelText('E1 · t1'))
    await user.click(screen.getByRole('button', { name: '锁定预测，开始归类' }))
    expect(screen.getByText('找到了首个策略等待')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: '逐条归类事件' })).toBeInTheDocument()
    expect(storageWrite).not.toHaveBeenCalled()
    storageWrite.mockRestore()
  })

  it('checks event categories and preserves the simulated evidence boundary', async () => {
    const user = userEvent.setup()
    render(<ConcurrencyTracePractice />)
    await user.click(screen.getByLabelText('E1 · t1'))
    await user.click(screen.getByRole('button', { name: '锁定预测，开始归类' }))

    const classification = screen.getByRole('group', { name: '逐条归类事件' })
    const expected = ['尚不可运行', '可运行但未被选择', '有效设备工作', 'padding / 非活跃占位']
    for (const [index, fieldset] of within(classification).getAllByRole('group').entries()) {
      await user.click(within(fieldset).getByLabelText(expected[index]))
    }
    await user.click(screen.getByRole('button', { name: '检查事件归类' }))
    expect(screen.getByText('4 / 4 条因果边界已重建')).toBeInTheDocument()
    expect(screen.getAllByText('simulated · 非真实 GPU 性能证据')).toHaveLength(4)
    expect(screen.getByText(/不能证明真实 GPU 的执行重叠、利用率或性能收益/)).toBeInTheDocument()
    expect(screen.getByRole('table', { name: '待审查的模拟原始事件' })).toBeInTheDocument()
  })

  it('checks the first fatal gap and exposes five transfer dimensions without mastery state', async () => {
    const user = userEvent.setup()
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem')
    const { container } = render(<ConcurrencyAssessment />)

    await user.click(screen.getByLabelText('没有把等待换算成延迟分位数'))
    await user.click(screen.getByRole('button', { name: '检查审查起点' }))
    expect(screen.getByText('这不能修复当前的并行结论')).toBeInTheDocument()
    await user.click(screen.getByLabelText('没有 Q-B 的设备开始/完成或执行组证据'))
    await user.click(screen.getByRole('button', { name: '检查审查起点' }))
    expect(screen.getByText('先恢复设备因果链')).toBeInTheDocument()

    expect(container.querySelectorAll('.assessment-dimensions > li')).toHaveLength(5)
    expect([...container.querySelectorAll('[data-dimension]')].map((item) => item.getAttribute('data-dimension'))).toEqual([
      'event-reconstruction',
      'causal-attribution',
      'request-invariants',
      'evidence-boundary',
      'next-selection',
    ])
    expect(screen.getByText(/不产生掌握状态/)).toBeInTheDocument()
    await user.click(screen.getAllByText('展开检查边界')[0])
    expect(screen.getByText(/Q-B 已到达且主机提交过/)).toBeVisible()
    expect(container.textContent).not.toContain('continuous batching')
    expect(storageWrite).not.toHaveBeenCalled()
    storageWrite.mockRestore()
  })
})

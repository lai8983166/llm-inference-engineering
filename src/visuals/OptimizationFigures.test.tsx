import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BudgetGainFigure, NoiseControlFigure } from './OptimizationFigures'

describe('chapter nine budget gain figure', () => {
  it('shows the baseline and the kernel-halving gain from the ledger', () => {
    render(<BudgetGainFigure />)

    expect(screen.getByText('基线预算')).toBeInTheDocument()
    const readout = screen.getByText('端到端收益 ×1.05', { selector: '.trace-readout strong' }).parentElement!
    expect(within(readout).getByText('19 单位')).toBeInTheDocument()
    expect(within(readout).getByText('×1.11')).toBeInTheDocument()
    expect(within(readout).getByText('×1.05')).toBeInTheDocument()
    expect(screen.getByText(/单位是教学预算，不是时间/)).toBeInTheDocument()
  })

  it('switches optimizations with gains ranked by share', async () => {
    const user = userEvent.setup()
    const { container } = render(<BudgetGainFigure />)
    const group = within(container.querySelector('.strategy-switch')!)

    await user.click(group.getByRole('button', { name: /CUDA Graph/ }))
    expect(screen.getByText('端到端收益 ×1.43', { selector: '.trace-readout strong' })).toBeInTheDocument()
    expect(screen.getByText('合计 14 单位')).toBeInTheDocument()

    await user.click(group.getByRole('button', { name: /KV 量化/ }))
    expect(screen.getByText('端到端收益 ×1.18', { selector: '.trace-readout strong' })).toBeInTheDocument()
    expect(screen.getByText('合计 17 单位')).toBeInTheDocument()
  })

  it('renders five stacked segments with text labels', () => {
    const { container } = render(<BudgetGainFigure />)
    const bars = container.querySelectorAll('.budget-bar')
    expect(bars).toHaveLength(2)
    expect(bars[0].querySelectorAll('span[data-kind]')).toHaveLength(5)
    expect(bars[0]).toHaveTextContent('8')
  })
})

describe('chapter nine noise control figure', () => {
  it('flags the overlapping case as unsupported', () => {
    render(<NoiseControlFigure />)

    expect(screen.getByText('范围重叠：证据不支持收益声称')).toBeInTheDocument()
    expect(screen.getByText(/不是发布结论/)).toBeInTheDocument()
    expect(screen.getByText('范围 [18, 22]')).toBeInTheDocument()
    expect(screen.getByText('范围 [19, 21]')).toBeInTheDocument()
    expect(screen.getByText(/不代表真实噪声分布/)).toBeInTheDocument()
  })

  it('switches to the separated case with the caveat template', async () => {
    const user = userEvent.setup()
    render(<NoiseControlFigure />)
    const group = within(screen.getByRole('group', { name: '选择样本组' }))

    await user.click(group.getByRole('button', { name: /真实收益/ }))
    expect(screen.getByText('范围分离：证据可支持收益')).toBeInTheDocument()
    expect(screen.getByText(/一次只改一处/)).toBeInTheDocument()
    expect(screen.getByText('范围 [13, 15]')).toBeInTheDocument()
  })

  it('exposes switches to keyboard focus', async () => {
    const user = userEvent.setup()
    render(<NoiseControlFigure />)
    await user.tab()
    expect(screen.getByRole('button', { name: /无实质变化/ })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: /真实收益/ })).toHaveFocus()
  })
})

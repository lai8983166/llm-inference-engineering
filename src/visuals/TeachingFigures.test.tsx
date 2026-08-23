import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RequestPulseHero } from './RequestPulseHero'
import { ExecutionShapeFigure, OutputTimelineFigure, ResourceLifecycleFigure } from './TeachingFigures'

describe('animated teaching figures', () => {
  it('lets the reader pause and inspect a request moment', async () => {
    const user = userEvent.setup()
    render(<RequestPulseHero />)

    await user.click(screen.getByRole('button', { name: /安全结束/ }))
    expect(screen.getByText('停止并释放资源')).toBeInTheDocument()
    expect(screen.getByText('4', { selector: '.pulse-readout strong' })).toBeInTheDocument()
    expect(screen.getByRole('figure')).toHaveClass('is-paused')
  })

  it('compares prefill and decode without changing model identity', async () => {
    const user = userEvent.setup()
    render(<ExecutionShapeFigure />)

    await user.click(screen.getByRole('button', { name: '新增一步' }))
    expect(screen.getByText('一个新 query 读取全部五个位置')).toBeInTheDocument()
    expect(screen.getByText('[1, 1, d]')).toBeInTheDocument()
    expect(screen.getByText('4 个位置')).toBeInTheDocument()
  })

  it('moves output boundaries one atomic time point at a time', async () => {
    const user = userEvent.setup()
    render(<OutputTimelineFigure />)

    await user.click(screen.getByRole('button', { name: '下一步' }))
    await user.click(screen.getByRole('button', { name: '下一步' }))
    expect(screen.getByText('y1 越过网络提交点；请求仍持有 KV 并继续 decode。')).toBeInTheDocument()
  })

  it('keeps resources held until the cleanup stage', async () => {
    const user = userEvent.setup()
    render(<ResourceLifecycleFigure />)

    await user.click(screen.getByRole('button', { name: /终止已登记/ }))
    expect(screen.getByText('暂不释放')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /清理完成/ }))
    expect(screen.getByText('released')).toBeInTheDocument()
    expect(screen.getByText('closed')).toBeInTheDocument()
  })
})

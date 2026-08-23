import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BaselineAssessment } from './BaselineAssessment'
import { TimingWindowPractice } from './TimingWindowPractice'

describe('chapter zero practice and transfer review', () => {
  it('requires a prediction before revealing raw events', async () => {
    const user = userEvent.setup()
    render(<TimingWindowPractice />)
    expect(screen.queryByRole('table', { name: '模拟原始事件' })).not.toBeInTheDocument()
    await user.click(screen.getByLabelText('只覆盖了主机提交路径'))
    await user.click(screen.getByRole('button', { name: '锁定预测，查看事件' }))
    expect(screen.getByRole('table', { name: '模拟原始事件' })).toBeInTheDocument()
    expect(screen.getByText('预测抓住了边界')).toBeInTheDocument()
  })

  it('derives a device window and refuses a missing completion event', async () => {
    const user = userEvent.setup()
    render(<TimingWindowPractice />)
    await user.click(screen.getByLabelText('只覆盖了主机提交路径'))
    await user.click(screen.getByRole('button', { name: '锁定预测，查看事件' }))
    await user.selectOptions(screen.getByLabelText('设备窗口起点'), 'device-start')
    await user.selectOptions(screen.getByLabelText('设备窗口终点'), 'device-complete')
    await user.click(screen.getByRole('button', { name: '验证窗口' }))
    expect(screen.getByText('47 ms', { selector: '.window-feedback strong' })).toBeInTheDocument()
    expect(screen.getByText(/不证明真实 GPU 性能/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '缺失完成事件' }))
    expect(within(screen.getByRole('table', { name: '模拟原始事件' })).queryByText('设备完成执行')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '验证窗口' }))
    expect(screen.getByText('拒绝计算')).toBeInTheDocument()
    expect(screen.getByText(/缺少结束事件/)).toBeInTheDocument()
  })

  it('teaches review priority without claiming automatic mastery', async () => {
    const user = userEvent.setup()
    render(<BaselineAssessment />)
    await user.click(screen.getByLabelText('计时停在异步提交返回'))
    await user.click(screen.getByRole('button', { name: '检查审查顺序' }))
    expect(screen.getByText('这是严重问题，但还不是第一步')).toBeInTheDocument()

    await user.click(screen.getByLabelText('C 与 D 完成的输出工作量不同'))
    await user.click(screen.getByRole('button', { name: '检查审查顺序' }))
    expect(screen.getByText('先恢复可比性')).toBeInTheDocument()
    expect(screen.getByLabelText(/写出最小修复协议/)).toBeInTheDocument()
    expect(screen.getByLabelText(/写一句不越过证据的结论/)).toBeInTheDocument()
    expect(screen.getByText(/不产生掌握状态/)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/任务合同、观察者、起止事件、工作负载、warm-up 与原始样本/)).toBeInTheDocument()
    expect(screen.getByText(/设备执行、端到端延迟或真实服务性能/)).toBeInTheDocument()
  })
})

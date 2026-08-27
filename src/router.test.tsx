import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { routes } from './router'

function renderRoute(path: string) {
  const testRouter = createMemoryRouter(routes, { initialEntries: [path] })
  return render(<RouterProvider router={testRouter} />)
}

describe('minimal course routes', () => {
  it('renders the focused course entry', () => {
    renderRoute('/')
    expect(screen.getByRole('heading', { level: 1, name: /不要背框架。\s*看系统怎样被逼出来。/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /从第 00 章开始/ })).toHaveAttribute('href', '/chapters/trustworthy-baseline')
    const chapterLinks = screen.getByRole('list', { name: '' }).querySelectorAll('a')
    expect([...chapterLinks].map((link) => link.getAttribute('href'))).toEqual([
      '/chapters/trustworthy-baseline',
      '/chapters/single-request',
      '/chapters/naive-concurrency',
      '/chapters/kv-state',
      '/chapters/paged-kv',
      '/chapters/scheduling',
    ])
  })

  it('renders chapter zero as one continuous evidence review', () => {
    renderRoute('/chapters/trustworthy-baseline')
    expect(screen.getByRole('heading', { level: 1, name: /建立可相信的\s*基线/ })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: '一项尚待审查的性能主张' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '本章内容' })).toBeInTheDocument()
    expect(document.querySelectorAll('.chapter-prose > h2')).toHaveLength(5)
    expect(screen.getAllByRole('figure')).toHaveLength(4)
    expect(document.querySelectorAll('.chapter-prose')).toHaveLength(1)
    expect(document.querySelectorAll('[class*="card"]')).toHaveLength(0)
    expect(screen.getByRole('heading', { level: 2, name: '自己定义一次完成' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: '审查另一份“优化成功”报告' })).toBeInTheDocument()
    expect(screen.queryByText(/学习进度|掌握率/)).not.toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: '章节导航' })).getByRole('link', { name: /下一章 · 01.*一次请求怎样活着/ })).toHaveAttribute('href', '/chapters/single-request')
  })

  it('renders one continuous chapter reading surface', () => {
    renderRoute('/chapters/single-request')
    expect(screen.getByRole('heading', { level: 1, name: /一次请求\s*怎样活着/ })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '本章内容' })).toBeInTheDocument()
    expect(document.querySelectorAll('.chapter-prose > h2')).toHaveLength(5)
    expect(screen.getAllByRole('figure')).toHaveLength(4)
    expect(document.querySelectorAll('.chapter-prose')).toHaveLength(1)
    expect(document.querySelectorAll('[class*="card"]')).toHaveLength(0)
    const finalBodyHeading = screen.getByRole('heading', { level: 2, name: '结束不是一个瞬间' })
    const practiceHeading = screen.getByRole('heading', { level: 2, name: '推演一次取消' })
    expect(finalBodyHeading.compareDocumentPosition(practiceHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: '用新场景验收' })).toBeInTheDocument()
    expect(screen.queryByText(/学习进度|掌握率/)).not.toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: '章节导航' })).getByRole('link', { name: /上一章 · 00.*建立可相信的基线/ })).toHaveAttribute('href', '/chapters/trustworthy-baseline')
    expect(within(screen.getByRole('navigation', { name: '章节导航' })).getByRole('link', { name: /下一章 · 02.*朴素并发为什么不够/ })).toHaveAttribute('href', '/chapters/naive-concurrency')
  })

  it('renders chapter two and leads into the published kv-state chapter', () => {
    renderRoute('/chapters/naive-concurrency')
    expect(screen.getByRole('heading', { level: 1, name: /朴素并发\s*为什么不够/ })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: '第 02 章固定请求清单' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '本章内容' })).toBeInTheDocument()
    expect(document.querySelectorAll('.chapter-prose > h2')).toHaveLength(5)
    expect(screen.getAllByRole('figure')).toHaveLength(2)
    const finalBodyHeading = screen.getByRole('heading', { level: 2, name: '下一次执行该选谁' })
    const practiceHeading = screen.getByRole('heading', { level: 2, name: '先判断等待，再给事件命名' })
    expect(finalBodyHeading.compareDocumentPosition(practiceHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: '审查一份“并发已经解决”的报告' })).toBeInTheDocument()
    expect(screen.queryByText(/学习进度|掌握率/)).not.toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: '章节导航' })).getByRole('link', { name: /上一章 · 01.*一次请求怎样活着/ })).toHaveAttribute('href', '/chapters/single-request')
    expect(within(screen.getByRole('navigation', { name: '章节导航' })).getByRole('link', { name: /下一章 · 03.*KV 为什么成为系统状态/ })).toHaveAttribute('href', '/chapters/kv-state')
  })

  it('renders chapter three with the teaching model manifest and no unpublished next chapter', () => {
    renderRoute('/chapters/kv-state')
    expect(screen.getByRole('heading', { level: 1, name: /KV 为什么\s*成为系统状态/ })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: '第 03 章固定教学模型' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '本章内容' })).toBeInTheDocument()
    expect(document.querySelectorAll('.chapter-prose > h2')).toHaveLength(5)
    expect(document.querySelectorAll('.chapter-prose')).toHaveLength(1)
    expect(screen.getAllByRole('figure')).toHaveLength(2)
    const finalBodyHeading = screen.getByRole('heading', { level: 2, name: '空闲总量够，连续空间仍不够' })
    const practiceHeading = screen.getByRole('heading', { level: 2, name: '先归因失败，再重建顺序' })
    expect(finalBodyHeading.compareDocumentPosition(practiceHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: '用新配置验收 KV 账本' })).toBeInTheDocument()
    expect(screen.queryByText(/学习进度|掌握率/)).not.toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: '章节导航' })).getByRole('link', { name: /上一章 · 02.*朴素并发为什么不够/ })).toHaveAttribute('href', '/chapters/naive-concurrency')
    expect(within(screen.getByRole('navigation', { name: '章节导航' })).getByRole('link', { name: /下一章 · 04.*分页 KV 怎样被逼出来/ })).toHaveAttribute('href', '/chapters/paged-kv')
  })

  it('renders chapter four with the block pool manifest and no unpublished next chapter', () => {
    renderRoute('/chapters/paged-kv')
    expect(screen.getByRole('heading', { level: 1, name: /分页 KV\s*怎样被逼出来/ })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: '第 04 章固定块池模型' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '本章内容' })).toBeInTheDocument()
    expect(document.querySelectorAll('.chapter-prose > h2')).toHaveLength(5)
    expect(document.querySelectorAll('.chapter-prose')).toHaveLength(1)
    expect(screen.getAllByRole('figure')).toHaveLength(2)
    const finalBodyHeading = screen.getByRole('heading', { level: 2, name: '块大小把浪费换成间接' })
    const practiceHeading = screen.getByRole('heading', { level: 2, name: '先归因拒绝，再重建顺序' })
    expect(finalBodyHeading.compareDocumentPosition(practiceHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: '用新块池验收布局账本' })).toBeInTheDocument()
    expect(screen.queryByText(/学习进度|掌握率/)).not.toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: '章节导航' })).getByRole('link', { name: /上一章 · 03.*KV 为什么成为系统状态/ })).toHaveAttribute('href', '/chapters/kv-state')
    expect(within(screen.getByRole('navigation', { name: '章节导航' })).getByRole('link', { name: /下一章 · 05.*下一拍执行谁/ })).toHaveAttribute('href', '/chapters/scheduling')
  })

  it('renders chapter five with the scheduling manifest and no unpublished next chapter', () => {
    renderRoute('/chapters/scheduling')
    expect(screen.getByRole('heading', { level: 1, name: /下一拍\s*执行谁/ })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: '第 05 章固定调度输入' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '本章内容' })).toBeInTheDocument()
    expect(document.querySelectorAll('.chapter-prose > h2')).toHaveLength(5)
    expect(document.querySelectorAll('.chapter-prose')).toHaveLength(1)
    expect(screen.getAllByRole('figure')).toHaveLength(2)
    const finalBodyHeading = screen.getByRole('heading', { level: 2, name: '调度需要合同，而不是默认值' })
    const practiceHeading = screen.getByRole('heading', { level: 2, name: '先归因等待，再重建一拍' })
    expect(finalBodyHeading.compareDocumentPosition(practiceHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: '用新工作量验收调度账本' })).toBeInTheDocument()
    expect(screen.queryByText(/学习进度|掌握率/)).not.toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: '章节导航' })).getByRole('link', { name: /上一章 · 04.*分页 KV 怎样被逼出来/ })).toHaveAttribute('href', '/chapters/paged-kv')
    expect(within(screen.getByRole('navigation', { name: '章节导航' })).queryByRole('link', { name: /下一章/ })).not.toBeInTheDocument()
  })

  it('places the skip link, course link, visual controls, and chapter navigation in keyboard order', async () => {
    const user = userEvent.setup()
    renderRoute('/chapters/single-request')

    await user.tab()
    expect(screen.getByRole('link', { name: '跳到正文' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('link', { name: 'LLM Inference Engineering' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: '暂停动画' })).toHaveFocus()

    for (let index = 0; index < 5; index += 1) await user.tab()
    expect(screen.getByRole('link', { name: /一次调用，多次执行/ })).toHaveFocus()
  })
})

import { Link } from 'react-router'

export function HomePage() {
  return (
    <article className="landing-page">
      <p className="chapter-number">课程样板</p>
      <h1>从一次请求开始，推导推理系统</h1>
      <p className="landing-intro">这里不从框架功能或最佳实践开始。第一章先跟随一次生成请求，弄清模型计算、可见输出和资源生命周期为何不是同一件事。</p>
      <Link className="start-link" to="/chapters/single-request">阅读第 01 章 <span aria-hidden="true">→</span></Link>
      <section className="scope-statement" aria-labelledby="scope-title">
        <h2 id="scope-title">这一批只验证一种教学方法</h2>
        <p>正文应当独立讲清概念和工程设计。只有运行能够提供额外认识时，才会出现实践。</p>
      </section>
    </article>
  )
}

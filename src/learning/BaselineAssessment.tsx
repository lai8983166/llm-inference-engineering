import { useState } from 'react'

type FatalGap = 'workload' | 'async' | 'warmup'

export function BaselineAssessment() {
  const [fatalGap, setFatalGap] = useState<FatalGap>()
  const [checked, setChecked] = useState(false)

  return (
    <section className="baseline-assessment" aria-labelledby="baseline-assessment-title">
      <p className="practice-kicker">TRANSFER REVIEW · NEW CASE</p>
      <h2 id="baseline-assessment-title">审查另一份“优化成功”报告</h2>
      <p>报告称实现 D 比 C 快 25%。C 生成 32 个 token，D 生成 18 个；两边都在异步提交函数返回时停表；D 的三次慢运行被事后标为 warm-up 并删除；报告只留下平均值。不要平均分配注意力，先处理让比较本身失效的问题。</p>

      <ol>
        <li>
          <fieldset>
            <legend>哪一个是首个致命缺口？</legend>
            <label><input type="radio" name="fatal-gap" checked={fatalGap === 'workload'} onChange={() => { setFatalGap('workload'); setChecked(false) }} />C 与 D 完成的输出工作量不同</label>
            <label><input type="radio" name="fatal-gap" checked={fatalGap === 'async'} onChange={() => { setFatalGap('async'); setChecked(false) }} />计时停在异步提交返回</label>
            <label><input type="radio" name="fatal-gap" checked={fatalGap === 'warmup'} onChange={() => { setFatalGap('warmup'); setChecked(false) }} />慢样本被事后删除</label>
          </fieldset>
          <button type="button" disabled={!fatalGap} onClick={() => setChecked(true)}>检查审查顺序</button>
          {checked && <div className="assessment-feedback" role="status"><strong>{fatalGap === 'workload' ? '先恢复可比性' : '这是严重问题，但还不是第一步'}</strong><p>{fatalGap === 'workload' ? '若任务和工作量不同，后面的计时与聚合再精确也不能隔离实现差异。先建立正确性合同，再修复其他证据。' : '在比较对象尚不等价时，修正计时或样本策略仍然是在精确比较两件不同的事。'}</p></div>}
        </li>
        <li>
          <label htmlFor="repair-protocol">写出最小修复协议：你会固定什么，并保留哪些原始事件？</label>
          <textarea id="repair-protocol" rows={5} placeholder="用任务合同、观察者、起止事件、工作负载、warm-up 与原始样本组织答案。" />
          <details><summary>展开检查边界</summary><p>答案应先让 C/D 满足同一任务与输出接受条件；再为目标问题声明同一观察者和真实完成事件；预先声明冷启动或稳态策略，保留所有运行、失败和环境信息。只写“多跑几次”不能修复这些边界。</p></details>
        </li>
        <li>
          <label htmlFor="bounded-conclusion">在没有新测量以前，写一句不越过证据的结论。</label>
          <textarea id="bounded-conclusion" rows={4} placeholder="区分当前观察到什么、哪些比较无效，以及下一步需要什么证据。" />
          <details><summary>展开检查边界</summary><p>可说明现有报告观察到两个不可比运行的主机提交时间不同，但不能声称 D 的设备执行、端到端延迟或真实服务性能更好。结论还应指出输出工作量、完成事件和删样本策略都需修复。</p></details>
        </li>
      </ol>
      <p>这些输入只用于本地思考，不上传、不自动判分，也不产生掌握状态。真正的完成证据是你能说明审查顺序和结论边界。</p>
    </section>
  )
}

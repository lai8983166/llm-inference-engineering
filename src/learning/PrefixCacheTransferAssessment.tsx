import { useState } from 'react'

type FatalGap = 'completion-not-release' | 'missing-tool' | 'missing-paper'

const reviewDimensions = [
  {
    id: 'alignment-audit',
    title: '对齐：7-token 共享前缀能省几块？',
    placeholder: '用 ⌊前缀/块大小⌋ 复算，再算毛边。',
    rubric: '新配置（块大小 4、前缀 7）：⌊7/4⌋=1 块共享，毛边 3 token 各自私有——命中方仍需为自己的 3+输出 token 拿私有块；"7 token 全省"高估了对齐收益。',
  },
  {
    id: 'ownership-audit',
    title: '所有权：取消一位共享方释放了什么？',
    placeholder: '区分归还、递减与转缓存。',
    rubric: '被取消的共享方只递减自己那份引用（rc 2→1），私有块走第 07 章清理；共享块因另一方存活既不归还也不转缓存。报告若称"取消即释放共享前缀"，混淆了引用与所有权。',
  },
  {
    id: 'eviction-audit',
    title: '逐出：哪块能走、哪块不能？',
    placeholder: '用 rc 与角色判断。',
    rubric: '只有 rc=0 的缓存块可被 LRU 逐出；rc>0 的共享块与私有块永不逐出。新申请 5 块、空闲 3、缓存 2 的局面：逐出两块缓存后准入成立；若其中一块 rc=1，申请必须等待或另寻方案。',
  },
  {
    id: 'scheduling-audit',
    title: '调度：优先命中者公平吗？',
    placeholder: '把缓存感知调度放进第 06 章的成本分配框架。',
    rubric: '优先能命中的请求把等待成本寄给无共享前缀的新请求；反过来优先新请求又浪费驻留前缀。这是又一个"把成本寄给谁"的决定，负载与承诺决定取舍，需实测公平性指标。',
  },
  {
    id: 'evidence-audit',
    title: '证据：命中率 60% 说明什么？',
    placeholder: '区分指标与收益。',
    rubric: '命中率只说明应计请求中 60% 复用了对齐前缀块；它不换算成吞吐或延迟——APC 只省 prefill 侧计算，答案长或 decode 主导时收益有限。收益要过第 09 章预算表与对照实验。',
  },
  {
    id: 'combination-audit',
    title: '组合：再叠加投机解码要重签什么？',
    placeholder: '用四项合同清单检查新机制。',
    rubric: '草稿与验证请求的块共享把所有权再复杂化一层（谁持有草稿块？验证失败时归谁？）；逐出、调度交互与证据口径都要重新回答——机制叠加放大复杂度，不只是功能。',
  },
] as const

export function PrefixCacheTransferAssessment() {
  const [fatalGap, setFatalGap] = useState<FatalGap>()
  const [checked, setChecked] = useState(false)

  return (
    <section className="concurrency-assessment prefix-assessment" aria-labelledby="prefix-assessment-title">
      <p className="practice-kicker">TRANSFER REVIEW · RAGGED PREFIX</p>
      <h2 id="prefix-assessment-title">用毛边前缀验收缓存账本</h2>
      <p>新的配置：块大小 4，`U-a`/`U-b` 共享 7-token 前缀（毛边 3），`U-c` 无共享且需 5 块，池内驻留 2 块缓存（其中 1 块 rc=1）。一份报告宣称：“开启前缀缓存后请求完成即释放所有块，无泄漏；命中率 60%，吞吐必然提升；`U-c` 进不来就逐出几块缓存，随时可行。”</p>

      <fieldset>
        <legend>先处理哪一个使核心结论无法成立的错误？</legend>
        <label><input type="radio" name="prefix-fatal-gap" checked={fatalGap === 'completion-not-release'} onChange={() => { setFatalGap('completion-not-release'); setChecked(false) }} />“完成即释放所有块”违背引用计数（共享块只递减），“随时逐出”违背“rc 大于 0 永不逐出”，命中率也不换算吞吐</label>
        <label><input type="radio" name="prefix-fatal-gap" checked={fatalGap === 'missing-tool'} onChange={() => { setFatalGap('missing-tool'); setChecked(false) }} />没有实现一个真实前缀缓存器作对照</label>
        <label><input type="radio" name="prefix-fatal-gap" checked={fatalGap === 'missing-paper'} onChange={() => { setFatalGap('missing-paper'); setChecked(false) }} />没有引用 PagedAttention 论文的共享小节</label>
      </fieldset>
      <button type="button" disabled={!fatalGap} onClick={() => setChecked(true)}>检查审查起点</button>
      {checked && <div className="assessment-feedback" role="status">
        <strong>{fatalGap === 'completion-not-release' ? '先修所有权，再谈其他' : '这不是当前结论的致命缺口'}</strong>
        <p>{fatalGap === 'completion-not-release'
          ? '共享块在一位所有者完成时只递减 rc——把"完成即释放"写进报告会悬空仍在读的一方；rc=1 的缓存块不能逐出，逐出只能 reclaim rc=0 的块。所有权错误不修，命中率与吞吐的声称都没有地基。'
          : '工具与引用都不能修复所有权误读；在释放与逐出语义都错时，补充材料只会强化无效推断。'}</p>
      </div>}

      <ol className="assessment-dimensions">
        {reviewDimensions.map((dimension, index) => <li key={dimension.id} data-dimension={dimension.id}>
          <label htmlFor={dimension.id}>{index + 1}. {dimension.title}</label>
          <textarea id={dimension.id} rows={4} placeholder={dimension.placeholder} />
          <details><summary>展开检查边界</summary><p>{dimension.rubric}</p></details>
        </li>)}
      </ol>
      <p>自由文本只保存在当前页面，不上传、不自动评分，也不产生掌握状态。展开标准用于检查推理边界，不代表页面已经替你完成诊断。</p>
    </section>
  )
}

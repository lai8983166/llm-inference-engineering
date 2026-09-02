import { useState } from 'react'

type FatalGap = 'share-before-noise' | 'missing-tool' | 'missing-paper'

const reviewDimensions = [
  {
    id: 'budget-arithmetic',
    title: '预算算术：颠倒的表里收益是多少？',
    placeholder: '用新预算表复算两种优化的收益。',
    rubric: '新表（提交 2、launch 2、同步 2、访存 8、计算 6，合计 20）：访存占 40%、上限 ×1.67，量化 ×0.5 得 ×1.18；计算占 30%、上限 ×1.43，kernel ×0.5 得 ×1.11——与正文的表恰成镜像，优化谁由表决定。',
  },
  {
    id: 'signature-selection',
    title: '指纹：这份报告的嫌疑部件是谁？',
    placeholder: '从占比与指纹描述找主导部件。',
    rubric: '报告称“kernel 间隙之间空转、batch 加大无用”——这是 launch 指纹的描述；但新表 launch 仅占一成。指纹要与现场预算互相印证，单凭描述或单凭占比都可能选错。',
  },
  {
    id: 'ceiling-check',
    title: '上限：声称的 ×1.8 可能吗？',
    placeholder: '复算目标部件的上限。',
    rubric: '新表任何单部件的上限最高 ×1.67（访存）；声称合并“量化+去同步”得 ×1.8 需要组合上限 = 20/(20−8−2) = ×2 的算术核对——组合优化的上限同样可算，不是直觉题。',
  },
  {
    id: 'noise-judgement',
    title: '噪声：三组样本怎么判？',
    placeholder: '逐组检查范围重叠与样本量。',
    rubric: '新样本组 [20..24] 对 [19..23] 重叠（不可声称）；[20..24] 对 [14..18] 分离（可支持，仍需同条件）；两组各只有两个样本时无论重叠分离都不足为凭。',
  },
  {
    id: 'evidence-boundary',
    title: '证据边界：教学表能证明什么？',
    placeholder: '区分算术可迁移与数值不可迁移。',
    rubric: '占比稀释、上限公式、噪声判定形状可迁移；一切具体数值（占比、收益、样本）必须现场实测，且登记 profiler 自身的开销与同条件纪律。',
  },
  {
    id: 'chain-design',
    title: '归因链：为这份报告设计实验。',
    placeholder: '从指标到确认或推翻写完整链条。',
    rubric: '间隔分位劣化（第 08 章指向 decode）→ 现场预算 → 指纹对照定嫌疑 → 假设加上限 → 一次只改一处、按分布比较 → 收益与上限相符才确认；任一环缺失即退回故事。',
  },
] as const

export function OptimizationTransferAssessment() {
  const [fatalGap, setFatalGap] = useState<FatalGap>()
  const [checked, setChecked] = useState(false)

  return (
    <section className="concurrency-assessment optimization-assessment" aria-labelledby="optimization-assessment-title">
      <p className="practice-kicker">TRANSFER REVIEW · NEW BUDGET</p>
      <h2 id="optimization-assessment-title">用新预算表验收归因账本</h2>
      <p>新的现场预算表把占比颠倒了：提交 2、launch 2、同步 2、访存 8、计算 6，合计 20 单位。一份报告宣称：“kernel 快了服务必然快；我们的样本均值从 21.6 降到 20.8（范围 [19,23] 对 [20,24]），证明访存优化有效，收益 ×1.8。”</p>

      <fieldset>
        <legend>先处理哪一个使核心结论无法成立的错误？</legend>
        <label><input type="radio" name="optimization-fatal-gap" checked={fatalGap === 'share-before-noise'} onChange={() => { setFatalGap('share-before-noise'); setChecked(false) }} />“必然快”先撞占比上限（新表访存上限 ×1.67，×1.8 需组合算术核对），且两组样本范围重叠——声称在算术与证据两头都不成立</label>
        <label><input type="radio" name="optimization-fatal-gap" checked={fatalGap === 'missing-tool'} onChange={() => { setFatalGap('missing-tool'); setChecked(false) }} />没有实现一个真实 profiler 作对照</label>
        <label><input type="radio" name="optimization-fatal-gap" checked={fatalGap === 'missing-paper'} onChange={() => { setFatalGap('missing-paper'); setChecked(false) }} />没有引用 Amdahl 定律的原始论文</label>
      </fieldset>
      <button type="button" disabled={!fatalGap} onClick={() => setChecked(true)}>检查审查起点</button>
      {checked && <div className="assessment-feedback" role="status">
        <strong>{fatalGap === 'share-before-noise' ? '先查上限，再看样本' : '这不是当前结论的致命缺口'}</strong>
        <p>{fatalGap === 'share-before-noise'
          ? '新表访存占 40%，单部件上限 ×1.67——声称的 ×1.8 超过硬顶，除非报告了组合优化并给出组合算术；而 [19,23] 对 [20,24] 范围重叠，连“有效”都不支持。“kernel 快了服务必然快”在计算占 30% 的新表里同样站不住。'
          : '工具与引用都不能修复上限与样本的双重错误；在算术与证据都不成立时，补充材料只会强化无效推断。'}</p>
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

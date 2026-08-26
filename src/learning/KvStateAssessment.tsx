import { useState } from 'react'

type FatalGap = 'ledger-missing-outputs' | 'utilization-curve' | 'allocator-language'

const reviewDimensions = [
  {
    id: 'dependency-semantics',
    title: '依赖语义：哪些量必须跨步保存？',
    placeholder: '从下一个 token 的 Attention 需要读什么开始，区分跨步状态与本步中间量。',
    rubric: '应指出历史 K/V 是后续每步都要读的跨步状态，query、注意力分数、context、logits 是本步产生本步消费的即抛量；缓存命中依赖同一模型、层、请求、位置与数值表示。',
  },
  {
    id: 'byte-ledger',
    title: '字节账本：用新配置逐项复算',
    placeholder: '用 3 层 × 2(K,V) × 1 KV head × 4 dim × 4 bytes 复算每 token，再算三个请求的完成态。',
    rubric: '每 token 应为 96 bytes；4 个 query heads 不进入公式；K-x 完成 8 units = 768 bytes、K-y 5 units = 480 bytes、K-z 8 units = 768 bytes；完成态必须包含全部输出 token。',
  },
  {
    id: 'capacity-attribution',
    title: '容量归因：第三个请求失败该归因于哪一类？',
    placeholder: '回到原始区间判断，而不是汇总占用百分比。',
    rubric: '三请求完成态合计 21 units，超过 20-unit 的池：即使全部空闲连续也放不下第三个请求的完成态，属于有效容量耗尽；若报告按声明上限预留，还会叠加过度预留的准入失败。',
  },
  {
    id: 'migration-order',
    title: '搬迁与释放：合法顺序是什么？',
    placeholder: '从另址申请写到旧区间释放，并说明取消时哪些动作不能提前。',
    rubric: '顺序应为另址申请、复制、地址发布、等待旧地址在途读取、释放旧区间；发布前任一步失败旧地址仍是权威状态；取消不得回收仍被读取的区间。“数组 push”式的原子扩容不成立。',
  },
  {
    id: 'evidence-boundary',
    title: '证据边界：这份报告最多能说什么？',
    placeholder: '区分模拟事实、缺失证据和不能声称的性能结论。',
    rubric: '可以说 96 bytes/token 来自给定配置、21 units 超过 20-unit 池；不能凭教学单位声称“快 40%”或任何真实耗时、带宽、OOM 行为——那些需要在指定软硬件上测量。',
  },
  {
    id: 'layout-contract',
    title: '待解布局：下一种布局必须保住什么？',
    placeholder: '写出逻辑连续与物理连续分开后仍要成立的合同。',
    rubric: '至少包括逻辑位置到存储位置的映射、按步追加、在途读取对权威地址的依赖、请求独立的终结与回收；不要求说出任何具体分页方案或数据结构名称。',
  },
] as const

export function KvStateAssessment() {
  const [fatalGap, setFatalGap] = useState<FatalGap>()
  const [checked, setChecked] = useState(false)

  return (
    <section className="concurrency-assessment kv-assessment" aria-labelledby="kv-assessment-title">
      <p className="practice-kicker">TRANSFER REVIEW · NEW MODEL CONFIG</p>
      <h2 id="kv-assessment-title">用新配置验收 KV 账本</h2>
      <p>新的教学模型是 3 层、4 个 query heads、1 个 KV head、head dim 4、每元素 4 bytes；请求 `K-x`（prompt 5 + 输出 3）、`K-y`（3 + 2）、`K-z`（6 + 2）先后来到一个 20 token unit 的物理池。一份报告宣称：“三份 prompt 合计只有 14 个 unit，放进 20 个 unit 的池绰绰有余；扩容不过是数组在末尾 push 一下；实测缓存让生成快了 40%。”</p>

      <fieldset>
        <legend>先处理哪一个使账本结论无法成立的错误？</legend>
        <label><input type="radio" name="kv-fatal-gap" checked={fatalGap === 'ledger-missing-outputs'} onChange={() => { setFatalGap('ledger-missing-outputs'); setChecked(false) }} />账本只数了 prompt，漏掉每个输出 token 也要追加 K/V</label>
        <label><input type="radio" name="kv-fatal-gap" checked={fatalGap === 'utilization-curve'} onChange={() => { setFatalGap('utilization-curve'); setChecked(false) }} />没有给出显存利用率的随时间曲线</label>
        <label><input type="radio" name="kv-fatal-gap" checked={fatalGap === 'allocator-language'} onChange={() => { setFatalGap('allocator-language'); setChecked(false) }} />没有说明分配器用什么语言实现</label>
      </fieldset>
      <button type="button" disabled={!fatalGap} onClick={() => setChecked(true)}>检查审查起点</button>
      {checked && <div className="assessment-feedback" role="status">
        <strong>{fatalGap === 'ledger-missing-outputs' ? '账本先于一切结论' : '这不是当前结论的致命缺口'}</strong>
        <p>{fatalGap === 'ledger-missing-outputs'
          ? '完成态是 prompt 加全部输出：8、5、8 个 unit，合计 21，已经超过 20-unit 的池。只数 prompt 的账本让“装得下”从一开始就不成立。'
          : '利用率曲线与实现语言都不能修复账本缺项；在完成态合计已超出物理池时，任何补充指标都无法支持“绰绰有余”。'}</p>
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

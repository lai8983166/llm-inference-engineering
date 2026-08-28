import { useState } from 'react'

type FatalGap = 'cleanup-not-free' | 'missing-paper' | 'missing-implementation'

const reviewDimensions = [
  {
    id: 'state-coverage',
    title: '状态覆盖：三处终止各落在什么状态？',
    placeholder: '从到达、持有块与队列位置重建三个注入。',
    rubric: '新配置（`E-1`/`E-2` 同拍、`E-3` 排队、`E-4` 重算恢复）注入断开、超时与请求级失败各一处；断开者生成中持有块、超时者排队零块、失败者在恢复中——同一套清理覆盖三种状态。',
  },
  {
    id: 'cleanup-ritual',
    title: '清理仪式：每一步的依据是什么？',
    placeholder: '按裁决、在途安全、释放、离队、关流、记录的顺序检查。',
    rubric: '在途安全来自第 01/03 章安全点与在途读取；释放块来自第 04 章整块归还；部分输出（已送达保持送达）来自第 01 章输出许可；“平均多花 3 拍清理”与“终态当拍一次走完”的模型事实矛盾。',
  },
  {
    id: 'capacity-effect',
    title: '容量后果：断开释放的块去了哪？',
    placeholder: '推出断开当拍之后第一个被准入的等待者。',
    rubric: '断开者在 t3 释放 2 块后，需要 1 块的等待者当拍即可准入并 prefill——终止改写可运行集合；幸存请求的完成拍可能因执行机会被占用而后移，清理不免费。',
  },
  {
    id: 'blast-radius',
    title: '爆炸半径：请求级失败杀死了谁？',
    placeholder: '区分请求级错误与引擎级失败的作用范围。',
    rubric: '请求级错误只终止出错者，同组其余照常推进（可手算：组内一员失败，其余当拍完成）；引擎级失败整组终止。“整组都失败是正常的”混淆了两种半径——半径是设计选择，不是自然律。',
  },
  {
    id: 'evidence-boundary',
    title: '证据边界：这份报告最多能说什么？',
    placeholder: '区分教学计数与真实延迟/可靠性结论。',
    rubric: '可以说终态原因分布、清理当拍完成、释放块数；不能说清理延迟 3 拍换算的时间、失败率或可靠性百分比——检测延迟、清理耗时与失败率都必须实测。',
  },
  {
    id: 'observable-terminals',
    title: '可观测终点：指标从哪里来？',
    placeholder: '把带原因的终态事件登记为指标原料。',
    rubric: '完成率、失败率、无效希望占比全部是对终态事件的聚合；没有带原因的终态记录，任何指标都无从谈起——这正是下一章的入口。',
  },
] as const

export function TerminationTransferAssessment() {
  const [fatalGap, setFatalGap] = useState<FatalGap>()
  const [checked, setChecked] = useState(false)

  return (
    <section className="concurrency-assessment termination-assessment" aria-labelledby="termination-assessment-title">
      <p className="practice-kicker">TRANSFER REVIEW · NEW INJECTIONS</p>
      <h2 id="termination-assessment-title">用新注入验收终止账本</h2>
      <p>新的配置把断开、超时与请求级失败各注入一处：生成中的 `E-2` 被断开，排队的 `E-3` 越过期限，重算恢复中的 `E-4` 遇到错误。一份报告宣称：“被取消的请求平均多花 3 拍才清理完，证明取消必须等当前 decode 组结束，清理代价高；另外同批一个请求失败后整组都失败了，这是正常的。”</p>

      <fieldset>
        <legend>先处理哪一个使核心结论无法成立的错误？</legend>
        <label><input type="radio" name="termination-fatal-gap" checked={fatalGap === 'cleanup-not-free'} onChange={() => { setFatalGap('cleanup-not-free'); setChecked(false) }} />清理在终态当拍一次走完，“多花 3 拍”与账本矛盾；整组失败混淆了两种爆炸半径</label>
        <label><input type="radio" name="termination-fatal-gap" checked={fatalGap === 'missing-paper'} onChange={() => { setFatalGap('missing-paper'); setChecked(false) }} />没有引用清理机制的原始论文</label>
        <label><input type="radio" name="termination-fatal-gap" checked={fatalGap === 'missing-implementation'} onChange={() => { setFatalGap('missing-implementation'); setChecked(false) }} />没有实现一个真实故障注入器作对照</label>
      </fieldset>
      <button type="button" disabled={!fatalGap} onClick={() => setChecked(true)}>检查审查起点</button>
      {checked && <div className="assessment-feedback" role="status">
        <strong>{fatalGap === 'cleanup-not-free' ? '先把账本读对' : '这不是当前结论的致命缺口'}</strong>
        <p>{fatalGap === 'cleanup-not-free'
          ? '终止轨迹里释放、离队、关流、终态全部发生在同一拍；声称“多花 3 拍”要么看错账本、要么在谈别的系统。而“整组都失败”只在引擎级半径成立——请求级错误隔离是另一种设计，两种半径都要让每位死者走完同一次清理。'
          : '引用与实现都不能修复对账本的误读；在清理时机与失败半径都判断错时，补充材料只会强化无效推断。'}</p>
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

export function ChapterAssessment() {
  return (
    <section className="chapter-assessment" aria-labelledby="assessment-title">
      <h2 id="assessment-title">用新场景验收</h2>
      <p>不要按段复述名词。三道题分别要求你重建时间线、收束异常路径并审查设计；展开检查标准只是核对答案边界，不会记录完成状态。</p>
      <ol>
        <li>
          <p>请求含 6 个 prompt token，最多生成 3 个 token，非流式返回；模型第三次选择结束 token。列出实际模型执行、每次新增输入、KV 长度变化，以及客户端第一次得到文本的时刻。</p>
          <details><summary>检查标准</summary><p>区分一次 API、prefill 和 decode；不要把被选择但未再次送入模型的结束 token 计入 KV；非流式合同下，首 token 被选择不等于客户端可见。</p></details>
        </li>
        <li>
          <p>一次 decode 已提交给设备，此时 deadline 到期；设备稍后正常返回一个 token，但输出流还未写入。给出合法事件顺序，并说明结果、流、KV 和结束原因怎样处理。</p>
          <details><summary>检查标准</summary><p>超时先取得终止权后不再提交 token 或启动下一步；在途工作先到安全点再释放资源；结束原因保持 timed_out；流与 KV 各收束一次。</p></details>
        </li>
        <li>
          <p>某实现每步按“检查取消—采样—异步发送—若停止则退出”执行，finally 中立即释放 KV，但发送和设备任务可能尚未完成。找出至少三个无法保证的性质，并提出接口层修正。</p>
          <details><summary>检查标准</summary><p>答案应覆盖发送竞态、停止内容误发、KV 提前释放、发送结果不明或重复关闭中的至少三项；修正应说明原子提交顺序、安全输出前缀和释放安全点，而不是再散落几个布尔检查。</p></details>
        </li>
      </ol>
      <p>反馈应分别指出事件边界、因果依赖、资源所有权或结论边界的缺口。仅浏览页面、展开答案或跑完轨迹都不构成掌握证据。</p>
    </section>
  )
}

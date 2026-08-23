# 第 00 章来源与编辑记录

本章的来源不负责替学习者得出“实现 B 更快”的结论，只负责固定哪些行为可以作为稳定前提、哪些说法依赖具体工具，以及哪些判断必须回到目标环境的原始测量。贯穿案例、事件数值和缺陷报告是教学构造，必须明确标注为模拟证据。

## 证据分层

### 稳定原理

这些内容可以进入连续正文，但仍要先由案例中的矛盾引出，不能写成开场规则清单。

| 主张边界 | 一手来源 | 来源支持什么 | 不用于证明 |
| --- | --- | --- | --- |
| 异步提交返回不等于设备工作完成；需要用同步、查询或回调观察完成 | [CUDA Programming Guide：Asynchronous Execution](https://docs.nvidia.com/cuda/cuda-programming-guide/02-basics/asynchronous-execution.html) | CUDA 的异步调用可以在操作开始或完成前返回，并列出等待、查询和回调三类完成观察方式 | 所有运行时都具有相同事件名；某次 GPU 执行一定发生并发 |
| 同一进程中的短时间区间应由适合持续时间测量的单调时钟求差 | [Python `time.perf_counter`](https://docs.python.org/3/library/time.html#time.perf_counter) | 性能计数器的参考点无意义，只有两次读数之差有效；CPython 使用单调时钟 | 它能跨客户端、服务端和设备时钟直接相减；它自动等待异步设备完成 |
| percentile 来自排序后的样本，median 是第 50 percentile | [NIST Engineering Statistics Handbook：Percentiles](https://www.itl.nist.gov/div898/handbook/prc/section2/prc262.htm) | order statistics、percentile 与 median 的定义 | 少量样本的某个 percentile 天然稳定；p95 是所有场景的最佳指标 |
| 浮点等价不应无条件收缩为逐位相等 | [PyTorch Numerical Accuracy](https://docs.pytorch.org/docs/stable/notes/numerical_accuracy.html) | 相同数学计算可能因浮点顺序、平台和设备得到非逐位相同结果 | 任意文本差异都可接受；优化后的任务质量无需单独验证 |

### 工具与框架事实

这些事实必须在正文或注释中带上工具语境，不得上升为所有推理框架的普遍语义。实现阶段若引用具体 API，要再次确认当前链接和版本。

| 版本化事实 | 一手来源 | 编辑约束 |
| --- | --- | --- |
| CUDA Runtime 提供 event 的 record、query、synchronize 与 elapsed-time API | [CUDA Runtime API：Event Management](https://docs.nvidia.com/cuda/cuda-runtime-api/group__CUDART__EVENT.html) | 只用来展示一种设备完成观察方案，不把 CUDA event 定义成通用 benchmark 合同 |
| `torch.utils.benchmark.Timer` 会做 warm-up、在需要时同步异步加速器并保留重复测量 | [PyTorch Benchmark Utils](https://docs.pytorch.org/docs/stable/benchmark_utils.html) | 用来说明成熟工具主动处理哪些混杂因素，不把其默认策略写成本章答案 |
| PyTorch 不能保证跨版本、平台或 CPU/GPU 的完全复现，固定 seed 也不是充分条件 | [PyTorch Reproducibility](https://docs.pytorch.org/docs/stable/notes/randomness.html) | 生成配置、随机源、软件和硬件环境都应进入证据记录；不承诺 seed 能带来跨环境逐位一致 |
| Google Benchmark 支持独立 warm-up 时间、重复运行、上下文字段和原始/聚合输出策略 | [Google Benchmark User Guide](https://google.github.io/benchmark/user_guide.html) | 只作为协议字段确实存在工程需求的旁证，不引入 C++ 工具教学，也不照抄默认次数 |

### 必须实测的判断

下列内容不能由教程、论文或工具文档提前证明。正文只能给出待验证假设、测量协议或模拟反例：

- 实现 B 是否比 A 快，以及“30%”对应哪个观察者、工作负载和聚合量。
- 某台目标机器需要多少次 warm-up 才进入当前问题定义的稳态。
- 一次同步、event 记录、计时器调用或日志记录在目标执行形状中的扰动大小。
- 主机工作、设备工作和数据传输在特定硬件、stream 与软件版本下是否真的重叠。
- 某个中心值或尾部指标是否足以代表真实部署的目标与风险。
- 模拟事件轨迹中出现的毫秒数是否能迁移到真实 GPU、模型或推理框架。

## 正文主张核对表

正式正文提交前，对每个技术主张执行以下检查：

1. 若是稳定原理，能否指出上表中的一手定义或由已展示事件直接推导出来？
2. 若出现 CUDA、PyTorch 或具体 API 名称，是否说明了版本/工具边界并避免把默认行为改写成普遍规律？
3. 若句子包含“更快”“更稳定”“开销很小”“需要 N 次”等经验判断，是否改写为待测假设并列出所需原始事件？
4. 若使用课程内模拟数据，是否在数据附近标注 `simulated`，并明确它只能验证计算和事件合同？
5. 若结论跨越了不同输入、输出工作量、环境或观察窗口，是否撤回结论或补充同条件对照？

## 编辑进度

- 2026-08-23：建立初始来源边界；已逐项核对异步完成、时钟求差、浮点等价、warm-up、重复测量与 percentile 的一手依据。
- 2026-08-23：完成 prose-only 评审。移除“正确性基础”“计时原理”“工程记录”“结果汇总”等会重复相邻正文的候选标题，只保留五次问题实质变化；确认隐藏全部图示与实践后，仍可沿 `100/70` 的含混主张依次发现工作量、观察者、异步完成、运行阶段和聚合缺口。
- 2026-08-23：逐项反查最小协议。任务合同回指 32/20 token 反例；环境与工作负载回指运行条件变化；事件与同步回指 2 ms 提交计时；warm-up 回指六次完整轨迹；原始样本与聚合回指“中心更好、慢端更差”；结论边界回指 simulated 数据。没有保留无法追溯的一般性能判断。
- 2026-08-23：术语顺序检查通过。正确性合同、观察窗口、完成 event、warm-up 与 percentile 均在对应矛盾出现后命名；正文没有把 CUDA 或 PyTorch 的工具行为写成跨运行时最佳实践。
- 2026-08-23：四类证据图已在概念形成后接入；自动检查覆盖键盘顺序、暂停/单步、reduced-motion 初始状态、窄屏内部滚动和深色面板标题对比。用户完成页面体验并确认当前视觉可接受，图示阶段验收通过。
- 待任务组 4：记录计时窗口推演相对解释性图示的认识增量。
- 待任务组 5：记录加入实践与章间导航后的最终完整阅读验收。

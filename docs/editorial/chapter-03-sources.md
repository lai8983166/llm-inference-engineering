# 第 03 章来源与编辑记录

## 使用规则

本章把第 01—02 章留下的“KV 使用权”变成可计算、可追踪的系统状态。正文中的技术陈述按四类管理：稳定张量与容量原理需要能够追溯到论文或一手文档；模型配置与框架事实必须记录版本或访问日期；真实显存、复制与失败行为只能由对应软硬件上的测量支持；确定性教学模型假设只用整数逻辑单位，不以引用把假设包装成事实。

## 稳定张量与容量原理

| 待支持主张 | 一手来源 | 可以支持什么 | 不能推出什么 |
| --- | --- | --- | --- |
| Attention 中每个 query 要与各位置的 key 计算分数并对 value 加权求和；自回归解码的每步预测依赖之前全部 token | [Attention Is All You Need](https://arxiv.org/abs/1706.03762)，Vaswani 等，2017，2026-08-26 核对（公式见论文正文 3.2.1 节） | 第 n+1 个 token 的 query 需要读取位置 0…n 的 K/V；这些量在跨步之间是同一函数的同一输入 | 不规定任何缓存实现、内存布局或 kernel 形状 |
| 多查询注意力（MQA）让所有 attention head 共享 key/value，减少这些张量的大小与增量解码的内存带宽需求 | [Fast Transformer Decoding: One Write-Head is All You Need](https://arxiv.org/abs/1911.02150)，Shazeer，2019，2026-08-26 核对 | KV head 数可以少于 query head 数；缓存侧张量大小由 KV head 数决定 | 不在本章比较 MHA/GQA/MQA 的真实速度或精度 |
| GQA 使用介于 1 与 query head 数之间的 KV head 数，是 MQA 的推广 | [GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints](https://arxiv.org/abs/2305.13245)，Ainslie 等，2023，2026-08-26 核对 | `queryHeads=8, kvHeads=2` 的教学 fixture 属于合法 GQA 配置；字节公式必须代入 KV heads 而不是 query heads | 不能推出某真实模型的配置数值或服务质量结论 |
| KV 缓存存放逐步计算的 key/value 供复用、避免逐步重复计算；缓存随生成进行存储越来越多的 K/V | [Transformers: Cache strategies（KV cache 指南）](https://huggingface.co/docs/transformers/en/kv_cache)，v5.15.1 文档，2026-08-26 核对 | “无缓存重算”与“读取历史 K/V 只追加当前位置”是真实存在的两条路径；缓存随 token 数增长是文档明确描述的行为 | 文档的比较表（内存高中低）是定性提示，不提供本章可引用的字节数 |
| 固定大小缓存按最大长度预分配、生成期不修改，短序列会浪费缓存槽位；动态缓存随生成增长 | 同上（StaticCache/DynamicCache 小节），2026-08-26 核对 | “按上限一次预留”与“按当前长度增长”是真实设计点，各有明确代价 | 不把 HF Cache 类映射为本章教学方案；真实增长粒度、复制与分配行为必须实测 |

## 模型配置与框架事实

| 待支持主张 | 一手来源 | 可以支持什么 | 不能推出什么 |
| --- | --- | --- | --- |
| 模型配置用 `num_hidden_layers`、`num_attention_heads`、`num_key_value_heads`、`head_dim` 描述层数与 head 结构；`num_key_value_heads=num_attention_heads` 时为 MHA，`=1` 时为 MQA，否则 GQA；`head_dim` 缺省为 `hidden_size // num_attention_heads` | [Transformers: LlamaConfig](https://huggingface.co/docs/transformers/en/model_doc/llama)，v5.15.1 文档，2026-08-26 核对 | 教学字段名与真实配置字段对应；字节账本的因子（层数、KV heads、head dim）是模型配置事实 | 不声明某具体模型检查点的取值；不同模型家族字段可能不同，引用时须重新核对 |
| `past_key_values` 缓存传入后，调用方只需输入未处理的新 token 而不是全部历史 | 同上（LlamaModel.forward 参数说明），2026-08-26 核对 | 缓存复用合同：已缓存位置不重算，本步只处理新增输入 | 不涉及缓存内部布局（连续、分页或其他），那是实现层事实 |
| 已发表服务系统分析指出 KV cache 显存可被碎片化与冗余复制显著浪费、限制 batch size | [Efficient Memory Management for LLM Serving with PagedAttention](https://arxiv.org/abs/2309.06180)，Kwon 等，SOSP 2023，2026-08-26 核对 | “预留浪费与碎片”是真实系统论文明确记录的问题，不是本章虚构 | 论文摘要未给出具体百分比；其分页方案是后续章节内容，本章不得引用为已讲结论 |

vLLM/SGLang 当前 block、page table、回收或前缀共享的数据结构本章不陈述。后续正文若映射真实框架，必须在本表追加：官方文档或源码链接、版本/commit、核对日期，以及它仅用于“实现示例”而不是“概念定义”的边界。

## 必须实测的判断

以下问题在本章只能提出观察需求，不能由教学池或逻辑步给出结论：

- 真实 GPU 上按上限预留、按需增长或迁移复制的实际耗时、带宽占用与失败行为。
- 显存分配粒度、地址对齐、allocator 元数据开销，以及 PyTorch caching allocator 或框架池的真实布局。
- 某种连续 KV 布局对 TTFT、逐 token 间隔、吞吐和 goodput 的影响。
- 真实模型在具体 dtype 与层数下的 KV 字节数（应从其 config 复核，而不是沿用本章 128 bytes/token 常数）。

真实结论必须沿用第 00 章的测量合同：固定请求集合与生成工作量，记录观察者和完成事件，保留原始事件、失败与环境信息，再限定结论适用范围。

## 确定性教学模型假设

任务组 1 的 KV 领域模型只用于形成可复核的因果轨迹：

- 模型 fixture 固定为 4 层、8 query heads、2 KV heads、head dimension 4、每元素 2 bytes，由此每 token KV 为 `4 × 2 × 2 × 4 × 2 = 128 bytes`。这是教学 GQA 反例，不是任何真实模型的常数。
- 请求沿用第 02 章 `R-long`（6 prompt + 4 output）、`R-short`（2 + 1）、`R-late`（4 + 2）与到达步 0/1/3；完成态有效 KV 分别为 10、3、6 个 token unit。
- 物理池按 24 个 token unit 编址；地址与逻辑步是整数教学单位，不对应 CUDA 地址、字节偏移、毫秒或 GPU cycle。
- 最大预留轨迹按请求声明上限一次保留连续区间；按需连续增长轨迹只给当前长度并在相邻空间不足时走“另址申请—双份存活—复制—地址发布—等待在途读取—释放旧区间”。两条轨迹与失败分类均由纯函数生成。
- 字段名、辅助文本与测试禁止出现 `ms`、`GB/s`、`utilization`，不得把逻辑地址声称为 CUDA 分配结果。

## 编辑记录

### 2026-08-26 · 事件底座

- 已建立四类来源边界，并核对 Attention 定义、MQA、GQA 论文与 Transformers v5.15.1 的 LlamaConfig / KV cache 指南；PagedAttention 论文仅用于记录“预留浪费与碎片是已发表问题”，其方案留待后续章节。
- 本阶段只建立来源记录、领域模型与章节载体，不撰写方案结论；正文出现框架映射或性能陈述时必须回到本记录补证据。
- 教学数据明确使用 `simulated` 和整数逻辑步/逻辑地址，禁止字段名或界面暗示真实耗时、显存布局或 GPU 利用率。

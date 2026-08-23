# 第 01 章来源清单

本章使用来源来固定原理边界，不按论文或框架功能组织正文。正文中的贯穿算例、状态机和接口合同是教学推导，不声称复现某个框架实现。

| 来源 | 支撑内容 | 不用于证明 |
| --- | --- | --- |
| [SentencePiece: A simple and language independent subword tokenizer and detokenizer for Neural Text Processing](https://aclanthology.org/D18-2012/) | 文本与离散 token id 序列之间存在模型相关的编码/解码边界 | 任意真实模型会按本章示意方式切词 |
| [Attention Is All You Need](https://arxiv.org/abs/1706.03762) | decoder 的自回归生成与 masked self-attention 依赖 | 现代 decoder-only LLM 的具体 kernel、缓存布局或服务性能 |
| [The Curious Case of Neural Text Degeneration](https://arxiv.org/abs/1904.09751) | 同一模型分布可以配合不同解码/采样策略，生成决策不是模型权重本身 | nucleus sampling 在所有任务中都是最佳选择 |
| [Efficient Memory Management for Large Language Model Serving with PagedAttention](https://arxiv.org/abs/2309.06180) | KV cache 随请求增长并成为服务系统需要管理的资源，为后续章节的问题边界提供依据 | 本章最小执行器采用 vLLM 的数据结构，或论文报告的性能可迁移到其他环境 |

编辑时优先引用上述原始论文或正式论文入口。框架文档、源码与版本化行为将在进入真实框架章节时单独固定 commit；不得用当前框架名称替代本章的因果解释。

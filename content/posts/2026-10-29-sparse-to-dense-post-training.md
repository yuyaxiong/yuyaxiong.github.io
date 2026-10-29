---
{
  "title": "从 GRPO 到 OPD：理清 SFT、KL 与蒸馏的关系",
  "slug": "sparse-to-dense-post-training",
  "date": "2026-10-29",
  "updated": "2026-10-29",
  "author": "余亚雄",
  "category": "技术",
  "tags": ["学习笔记", "大模型后训练", "知识蒸馏", "强化学习"],
  "description": "从 GRPO、SFT 与 KL 出发，补充 TML On-Policy Distillation 和 verl GKD / PG OPD：训练流程、Direct KL 与 PG 梯度、原始实验、配置及工程检查。",
  "status": "published",
  "math": true,
  "styles": ["/assets/post-training-note.css"]
}
---

## 1｜论文主线：先改善教师，再训练学生

这篇论文研究一个资源分配问题： **可验证的训练题目有限，应该先训练教师，还是直接训练部署用的学生？** 

数学答案和代码测试可以给整条回答打分。这是 **稀疏奖励** 。它能判断结果，但通常不直接指出哪一步出错。

教师还可以在每个前缀上给出下一个 token 的概率分布。这是 **密集监督** 。它提供的反馈更频繁，但不是逐步正确性的证明。

论文提出以下训练顺序。

<figure class="pt-figure">
<strong>图 1｜先用奖励改善教师，再把教师行为迁移给学生</strong>
<ol class="pt-flow">
<li><b>教师 GRPO</b><span>用任务奖励提高教师的解题能力。</span></li>
<li><b>FKL 预热</b><span>教师生成回答。学生在这些前缀上学习教师分布。</span></li>
<li><b>OPD</b><span>学生生成回答。教师在学生前缀上提供分布。</span></li>
<li><b>学生 GRPO，可选</b><span>用此前留出的新题继续训练学生。</span></li>
</ol>
<figcaption>按 01 → 02 → 03 → 04 执行。根据原论文第 2 节重绘。迁移阶段冻结教师，只更新学生。</figcaption>
</figure>

这套顺序包含两个判断：教师要在目标任务上足够好，学生也要具备学习这些行为的基础。教师 GRPO 改善前者。FKL 预热帮助学生接触教师常用的 token 和前缀。OPD 再处理学生自己生成时出现的问题。

论文结果见第 7 节。先把几个容易混淆的概念拆开，才能理解这套流程。[原论文 v5，第 2—3 节](https://arxiv.org/html/2605.12483v5#S2)

## 2｜概念关系：损失和 rollout 来源是两回事

 **rollout**  指模型根据输入逐 token 生成的一条回答。 **前缀** 指输入加上此前已生成的 token。

这些术语描述不同的事情：

| 术语 | 含义 | 决定什么 |
| --- | --- | --- |
| 蒸馏 | 把教师的行为迁移给学生 | 学习谁 |
| SFT | 根据给定目标文本做监督训练 | 用什么文本训练 |
| FKL / RKL | 教师分布与学生分布之间的两种 KL 方向 | 怎样计算差异 |
| off-policy / on-policy | 训练轨迹与当前学生策略的关系 | 在谁生成的前缀上学习 |
| OPD | 在当前学生生成的轨迹上，用教师反馈训练学生 | 蒸馏的一种训练流程 |
| GRPO | 对同题多条回答的奖励做组内比较，再更新策略 | 怎样利用任务奖励 |

这里的 on-policy 和 off-policy 都相对当前学生。判断蒸馏方式时，先分开问两件事： **谁生成回答？用哪种损失？** 

| rollout 来源 | 使用 FKL | 使用 RKL |
| --- | --- | --- |
| 教师 | off-policy FKL 蒸馏 |  **off-policy RKL 蒸馏**  |
| 当前学生 | on-policy FKL 蒸馏 | 本文论文使用的  **OPD**  |

因此， **RKL 不等于 OPD** 。教师生成回答后，即使把损失改成 RKL，训练仍是 off-policy。

广义 OPD 可以使用其他分布损失。主线论文把 OPD 特指为“学生 rollout + RKL”。[GKD 论文](https://arxiv.org/abs/2306.13649)提供了更一般的框架。

还要注意“当前”二字。旧学生生成的轨迹，相对更新后的学生已经有分布差异。缓存与重放需要记录采样策略，不能只看生成模型是否叫 student。

## 3｜SFT 与 FKL：学一个 token，还是学完整分布

固定一个前缀 $s$。设教师分布为 $p(v)$，学生分布为 $q(v)$，$v$ 遍历共享词表 $V$。

### 3.1 SFT 使用给定的目标 token

目标 token 为 $a$ 时，SFT 的损失是：

$$
L_{\mathrm{SFT}}=-\log q(a).
$$

它要求学生提高 $a$ 的概率。这个目标可以来自人工答案，也可以来自教师生成的答案。

### 3.2 FKL 使用教师的完整概率分布

本文的 FKL 指 $\operatorname{KL}(p\|q)$：

$$
L_F=\sum_{v\in V}p(v)\log\frac{p(v)}{q(v)}
=H(p,q)-H(p).
$$

$H(p,q)=-\sum_vp(v)\log q(v)$ 是交叉熵。教师固定时，$H(p)$ 不随学生变化。因此，优化 FKL 与优化这个软标签交叉熵的梯度相同。

如果目标 token $a$ 从教师分布 $p$ 中采样，那么 SFT 损失的期望就是 $H(p,q)$。这说明两者有关联。

但一条固定答案不能提供完整分布。使用 greedy 解码、筛选正确答案或改变采样温度，也会改变文本的来源分布。因此，不能把任意 SFT 都称为教师 FKL。

### 3.3 教师生成 10 个 token 后，学生怎样计算 FKL

假设教师和学生使用相同 tokenizer、词表索引和输入模板。教师生成 $y_1,\ldots,y_{10}$。logits 是 softmax 之前的模型分数。每个位置保存一组 **采样前的全词表 logits** ，共 $10\times|V|$ 个数。

学生不需要先生成同一份答案。把“输入 + 教师回答”送入学生，一次计算各位置的预测。训练时固定使用教师写出的前缀，这叫 teacher forcing。

| 预测目标 | 两个模型看到的相同前缀 | 比较的分布 |
| --- | --- | --- |
| 第 1 个 token | 输入 $x$ | $p_1$ 与 $q_1$ |
| 第 2 个 token | $x,y_1$ | $p_2$ 与 $q_2$ |
| 第 10 个 token | $x,y_1,\ldots,y_9$ | $p_{10}$ 与 $q_{10}$ |

每行都比较整个词表的分布。教师选出的那个 token 只是其中一个。预测 $y_t$ 时，模型不能看到 $y_t$ 本身。

令温度为 $\tau>0$。对教师和学生 logits 分别计算 softmax，再逐位置计算 KL。只汇总有效回答位置，排除输入和 padding。

下面是核心计算。`z_teacher`、`z_student` 和 `mask` 已完成预测位置对齐，教师 logits 已停止梯度。

```python
# logits: [batch, response_positions, vocabulary]
log_p = (z_teacher.float() / tau).log_softmax(-1)
log_q = (z_student.float() / tau).log_softmax(-1)
token_loss = (log_p.exp() * (log_p - log_q)).sum(-1)
loss = tau**2 * (token_loss * mask).sum() / mask.sum()
loss.backward()  # 只更新学生；训练器随后执行 optimizer.step()
```

训练器需拒绝 `mask.sum() == 0` 的 batch。$\tau^2$ 是常见的温度补偿约定，不是 KL 定义的一部分。长序列训练通常还需要分块计算，以控制全词表 logits 的内存占用。

只有教师文本时，可以做 SFT。只有被选中 token 的 log-prob 时，不能精确计算全词表 FKL。top-k logits 需要额外近似。不同 tokenizer 也不能直接按词表下标计算 KL。

## 4｜RKL：改变分布匹配的方向

保留同一批教师前缀，把损失改成：

$$
L_R=\operatorname{KL}(q\|p)
=\sum_vq(v)\log\frac{q(v)}{p(v)}.
$$

这就是  **off-policy RKL 蒸馏** 。对应代码是：

```python
token_loss = (log_q.exp() * (log_q - log_p)).sum(-1)
```

FKL 按教师概率 $p$ 加权。RKL 按学生概率 $q$ 加权。数据没有变，计算差异的方式变了。

### 4.1 梯度说明了什么

固定前缀，取温度为 1。令学生分布 $q=\operatorname{softmax}(z)$，教师固定。对学生第 $j$ 个 logit，有：

$$
\frac{\partial L_F}{\partial z_j}=q_j-p_j,
\qquad
\frac{\partial L_R}{\partial z_j}
=q_j\left(\log\frac{q_j}{p_j}-L_R\right).
$$

 **FKL：** 如果教师给某个 token 很高概率，而学生几乎不选它，$p_j$ 仍会直接推动学生提高它的概率。这通常有利于保留教师分布中的多种行为。

 **RKL：** 损失更关注学生已经分配概率的区域。如果学生常选教师认为不合理的 token，RKL 会压低这些选择。学生几乎不选的 token，其 logit 梯度受外层 $q_j$ 抑制。

这分别对应常说的 mode-covering 和 mode-seeking 倾向。它们不是性能排名。如果学生能完整表示教师，两种 KL 的全局最优都是 $q=p$。

### 4.2 学生答不对，不代表 RKL 无效

“学生基础弱”至少有三种情况：

| 问题 | 表现 | 影响 |
| --- | --- | --- |
| 容量不足 | 学生无法表示教师的部分行为 | 改损失也不能消除容量限制 |
| 前缀访问不足 | 学生很少生成有效推理的开头 | on-policy 数据缺少这些学习机会 |
| 梯度估计不稳定 | 教师与学生概率差距大，log-ratio 极端 | 少量采样估计可能有较高方差 |

即使整条回答错误，教师仍可能指出当前前缀下更合理的下一个 token。因此，错误 rollout 也能用于训练。

但教师不一定能修复任何错误前缀。FKL 预热的作用，是先让学生接触教师常用的行为，再进行学生轨迹上的学习。它没有增加学生容量，也不保证所有任务都必须先预热。

## 5｜OPD 与 GRPO：学生都生成，但反馈不同

### 5.1 OPD 用教师分布评价学生的选择

论文中的 OPD 按以下顺序执行：

1. 当前学生生成回答。
2. 冻结教师读取这些 **学生前缀** ，计算 next-token 分布。
3. 在相同前缀上，用 RKL 更新学生。
4. 用更新后的学生继续采样。

教师在自己回答上缓存的 logits 不能直接用于不同的学生前缀。条件输入变了，教师分布也会变。

因此，“谁生成回答”比“谁提供 logits”更能说明是否 on-policy。教师提供反馈，并不会使 OPD 变成 off-policy。

### 5.2 GRPO 用任务奖励比较多条回答

GRPO 对同一题生成 $G$ 条回答，再由 verifier 给出奖励 $R_i$。verifier 可以是答案检查器或代码测试。

常见的组内优势为：

$$
\widehat A_i=
\frac{R_i-\overline R}{\operatorname{std}(R_1,\ldots,R_G)+\epsilon}.
$$

$\overline R$ 是组内平均奖励，$\epsilon$ 用于防止零除。GRPO 用这些相对优势和裁剪目标更新策略。它不要求教师提供 next-token 分布。

如果一组二元奖励全为零或全为一，中心化后的奖励优势为零。这组样本无法提供这种相对奖励信号。可选的 KL 正则项仍可能产生梯度。[DeepSeekMath：GRPO 原始论文](https://arxiv.org/abs/2402.03300)

| 方法 | 回答由谁生成 | 主要反馈 | 学习目标 |
| --- | --- | --- | --- |
| 教师文本 SFT | 教师 | 目标 token | 提高给定文本的概率 |
| 教师轨迹 FKL | 教师 | 教师分布 | 匹配教师分布 |
| 本文的 OPD | 当前学生 | 教师分布 | 在学生前缀上降低 RKL |
| outcome-reward GRPO | 近期学生策略 | 整条回答的任务奖励 | 提高高奖励回答的概率 |

OPD 可以借用 RL 的采样和更新框架。但它使用的教师反馈，不等于任务奖励。教师概率高，也不等于答案一定正确。

## 6｜容量与目标：更像教师，不保证奖励最高

### 6.1 容量受限时，FKL 与 RKL 可能选出不同策略

学生只能表示某个策略集合 $\Pi_S$。蒸馏需要在这个集合内找到最接近教师的策略：

$$
\widehat\pi_F=\arg\min_{\pi\in\Pi_S}\operatorname{KL}(\pi_T\|\pi),
\qquad
\widehat\pi_R=\arg\min_{\pi\in\Pi_S}\operatorname{KL}(\pi\|\pi_T).
$$

这就是 **策略投影** ：学生无法完整表示教师分布时，需要选择一个可实现的近似。两种 KL 使用不同的误差权重，可能得到不同结果。实际结果还取决于训练前缀和优化过程。

### 6.2 KL 最优与奖励最优是不同目标

考虑只有两个答案的例子：

| 分布或奖励 | 正确答案 | 错误答案 |
| --- | --- | --- |
| 教师概率 | 0.6 | 0.4 |
| 学生方案 A | 0.6 | 0.4 |
| 学生方案 B | 0.9 | 0.1 |
| 任务奖励 | 1 | 0 |

方案 A 的 KL 为零，最像教师。方案 B 的期望奖励为 0.9，高于方案 A 的 0.6。 **因此，降低 KL 不能代替任务评测。**  这是说明性反例，不是论文实验。

存在一个有条件的等价关系：如果教师恰好等于某个  **KL 正则化奖励目标** 的最优分布，那么最小化序列 RKL，等价于最大化那个带正则的目标。它仍不等价于只最大化正确率。推导见附录。

## 7｜实验结果与方法选型

### 7.1 论文实际测到了什么

下表固定学生为 Qwen3-1.7B，教师为 8B。训练使用完整 DAPO 数据， **没有追加学生 GRPO** 。

| 学生训练路线 | MATH-500 | AIME 2024 |
| --- | --- | --- |
| 直接学生 GRPO | 75.9 ± 0.9 | 19.8 ± 1.4 |
| 原始教师 → FKL + OPD | 71.5 ± 0.9 | 15.0 ± 1.5 |
| RL 后教师 → 仅 OPD | 77.6 ± 0.8 | 23.0 ± 1.4 |
| RL 后教师 → 教师文本 SFT | 76.0 ± 0.9 | 22.4 ± 1.5 |
|  **RL 后教师 → FKL + OPD**  |  **79.3 ± 0.7**  |  **25.2 ± 1.6**  |

数据来自原论文表 1、表 2，单位为百分比。avg@16 指每题生成 16 次后计算平均正确率，不是 pass@16。± 是跨评测题目的标准误，不是多次独立训练的波动。

这组结果支持两个判断： **目标任务上的教师质量很重要；FKL 预热能改善后续 OPD。**  仅 OPD 达到 77.6%，也说明冷启动 OPD 在这个实验中并没有失效。

读这些结果时，还需保留三个限制：

- “无 OPD”行使用教师文本 SFT。它不是“保留同一 FKL 预热，只删除 OPD”的严格单因素对照。
- 另一个半数据实验中，桥接后的学生从 75.4% 提高到 78.5%。这项增益来自新题上的学生 GRPO，不能直接加到上表的 79.3% 上。
- 8B 教师优先路线约用了直接学生 GRPO 的 4 倍算力。论文主要比较标注数据的分配，不证明同等总算力下这条路线最好。

Llama 和代码实验也发现：原始教师迁移的结果低于直接 GRPO，RL 后教师迁移的结果高于直接 GRPO。这些结果仍限于论文测试的模型与任务。[原论文表 1—4、附录 F](https://arxiv.org/html/2605.12483v5#S4)

### 7.2 按当前缺少的条件选择方法

以下是工程建议，不是论文给出的统一排名。

| 当前条件 | 可先尝试 | 重点检查 |
| --- | --- | --- |
| 只有可靠答案文本 | SFT | 答案质量、格式和长度 |
| 有完整教师 logits，学生差距较大 | 教师轨迹 FKL | 教师是否擅长目标任务、token 是否对齐 |
| 教师前缀上表现好，学生自己生成时跑偏 | OPD | 教师在学生前缀上的反馈质量 |
| 学生已能探索，且有可靠 verifier | GRPO | 组内奖励差异、独立验证集表现 |
| 标注题稀缺，且有较强教师和训练预算 | 比较教师 RL → FKL → OPD | 总算力、教师查询量及最终收益 |

至少比较 SFT、FKL-only、OPD-only、FKL → OPD 和直接 GRPO。固定学生规模、题目池和解码设置，同时记录正确率、输出长度和总成本。 **用验证集决定方法，不用训练 loss 代替结果。** 

## 8｜TML OPD：学生生成，教师逐 token 评分

本节起补充 Thinking Machines Lab（TML）与 verl 的实践，沿用本文符号：**教师为 $p$，学生为 $q_\theta$**。Notion 配套笔记采用相反的字母约定，阅读时应按“教师 / 学生”角色对应。[Notion 学习笔记（需页面访问权限）](https://app.notion.com/p/40825b93c70580578333ed2056c4a377)

### 8.1 三个维度，不能合成一个标签

| 维度 | 要回答的问题 | TML 配方 | verl 常用 GKD |
| --- | --- | --- | --- |
| 状态来源 | 谁生成训练前缀？ | 当前学生 | 当前学生 |
| 散度方向 | 比较哪一方向的差异？ | reverse KL | teacher-top-k forward KL |
| 梯度实现 | 怎样更新学生？ | sampled-token 信号 + PG | 对分布损失直接反传 |

**on-policy 不等于使用策略梯度；Direct KL 也不等于 forward KL。** 完整分布可用时，forward / reverse KL 都可以直接反传；PG 则需分析 reward、采样分布和 stop-gradient。TML 没有在该文实验 top-k logit 蒸馏。[TML 原文](https://thinkingmachines.ai/blog/on-policy-distillation/)、[verl OPD 文档](https://verl.readthedocs.io/en/latest/algo/opd.html)

### 8.2 一次更新实际发生了什么

![OPD 训练流程：学生生成，同一前缀教师评分，分为 Direct GKD 与 PG 两条更新路径，最后同步学生权重](/assets/opd-training-flow.png)

1. 固定本轮 rollout 策略 $q_{\mathrm{old}}$，让学生生成回答；保存 token IDs、采样 logprob、response mask、结束原因和策略版本。
2. 把同一条“prompt + 学生回答”送入冻结教师，做 causal teacher-forced scoring。预测第 $t$ 个 token 时只能看到 $s_t=(x,a_{<t})$，不能看到答案 token 本身。
3. 教师可以一次并行前向评分整段。PG 只需要实际学生 token 的 logprob；top-k GKD 还需要教师 top-k IDs 和 logprobs。**教师通常不需要再生成一条自己的回答，也不参与反向传播。**
4. 学生训练前向重新计算当前概率，按所选损失更新；排除 prompt、padding、非训练角色和服务附加的 dummy token。
5. 同步 rollout 权重，继续采样。永久重用首次学生回答不能维持严格 on-policy。

教师评分仍有计算、显存和通信成本。当前 Tinker 使用 `compute_logprobs_async` 评分；可选折扣后累积未来 KL，默认折扣为 0。[Tinker 固定版本实现](https://github.com/thinking-machines-lab/tinker-cookbook/blob/88fb643c913341279f7c7a666e1e8fbb5c6e8f63/tinker_cookbook/distillation/train_on_policy.py)

### 8.3 TML 实验的数字与口径

以下是 2025 年原文的结果，区别于第 7 节主线论文：

| 场景 | 基线 | OPD 后 | 需要保留的条件 |
| --- | --- | --- | --- |
| 数学推理 | SFT-400K：AIME’24 60%；继续 RL：68% | 约 150 步到 70% | 约 77K prompts，每题 4 条；SFT-2M 的约 70% 是外推 |
| 领域知识与行为恢复 | 70% 内部文档混合中训练后：Internal QA 36%、IF-eval 79% | QA 41%、IF-eval 83% | 用中训练前模型作行为教师，在 Tulu3 prompts 上恢复行为 |

数学学生为 Qwen3-8B-Base；原文说明实际 OPD 使用 Qwen3-8B 教师，而成本比较按 32B 教师 FLOPs 计。其 9—30× 是相对特定 SFT 成本口径；另一组对照的 7—10× 更新步、50—100× 计算量不能与之混成通用加速比。[TML 实验与讨论](https://thinkingmachines.ai/blog/on-policy-distillation/)

当前 cookbook 已替换模型，现行复现数字不能倒写成原始实验。OPD 能复制已有教师行为，不代表它能免费发现教师尚未掌握的新策略。这里的“密集”是每个位置有监督，也不代表每个 token 都有独立的正确性标签。[当前复现配方](https://tinker-docs.thinkingmachines.ai/cookbook/recipes/distillation/)

## 9｜Direct KL 与 PG：从数值估计到梯度

本节推导是本文分析。先固定前缀 $s$，假设教师冻结、师生词表对齐、概率归一化且支持集上为正；省略条件 $s$。对完整分布，前文已给出：

$$
\nabla_\theta D_F=-\sum_v p_v\nabla_\theta\log q_\theta(v),
\qquad
\nabla_\theta D_R
=\sum_v q_v\left(\log\frac{q_v}{p_v}+1\right)\nabla_\theta\log q_\theta(v).
$$

因为 $\mathbb E_{q_\theta}\nabla\log q_\theta=\nabla\sum_vq_v=0$，所以 reverse KL 的局部梯度可写成：

$$
\nabla_\theta D_R
=\mathbb E_{a\sim q_\theta}\left[
\left(\log q_\theta(a)-\log p(a)\right)
\nabla_\theta\log q_\theta(a)\right].
$$

### 9.1 为什么 k1 的数值无偏，直接 backward 却不对

若 $a\sim q_\theta$，则 $d(a)=\log q_\theta(a)-\log p(a)$ 是 reverse KL 的无偏单样本数值估计。但固定采出的 token，对它直接求导得到：

$$
\nabla_\theta d(a)=\nabla_\theta\log q_\theta(a).
$$

教师项的导数为零，教师差异没有成为梯度权重；在正确 on-policy 固定状态期望下，这个梯度甚至为零。遗漏的正是采样分布随参数改变产生的 score-function 项。**无偏 loss 数值不保证固定样本 autograd 梯度无偏。**

PG 在 rollout 更新点构造固定优势：

$$
A_t=\operatorname{sg}\left[
\log p(a_t\mid s_t)-\log q_{\mathrm{old}}(a_t\mid s_t)
\right],
\qquad
L_{\mathrm{PG}}=-\mathbb E_{\mathrm{old}}[A_t\log q_\theta(a_t\mid s_t)].
$$

其中 $\operatorname{sg}$ 是 stop-gradient。在 $\theta=\theta_{\mathrm{old}}$、固定状态、无裁剪且采样分布匹配时，PG 的期望梯度等于 Direct reverse KL 的局部梯度；surrogate 的数值本身不等于 KL。冻结教师与 detach 优势是两件事。

举例：学生给某 token 0.5、教师给 0.1，优势约为 −1.61，更新倾向于压低该动作；学生给 0.1、教师给 0.3，优势约为 +1.10，倾向于提高它。单样本 log-ratio 可以为负，KL 非负说的是分布期望。仅使用 $\log p(a)$ 而不减学生 logprob，会去掉学生熵项，改变目标。

### 9.2 PPO 裁剪改变了严格的等价条件

$$
\rho_t(\theta)=\frac{q_\theta(a_t\mid s_t)}{q_{\mathrm{old}}(a_t\mid s_t)},
\qquad
L_{\mathrm{clip}}=-\mathbb E_{\mathrm{old}}
\left[\min\left(\rho_t A_t,
\operatorname{clip}(\rho_t,1-\epsilon_l,1+\epsilon_h)A_t\right)\right].
$$

裁剪是有偏的稳定化机制。多次更新同一批数据、旧策略 logprob 与真实行为策略不一致，也会影响解释。单 token ratio 只修正给定状态的动作期望，不自动修正前缀分布。

**版本差异：** TML 配方由 rollout logprob 构造固定优势；本次核对的 verl 从当前 `model_output["log_probs"]` 与教师 logprob 算差值，detach 后进入 PG，`old_log_probs` 用于 ratio。初始同步点一致，同批多步更新时不能称为完全相同的实现。[verl 固定版本 PG 分支](https://github.com/verl-project/verl/blob/a08ea02a784d7d4982b1d81df36d188a476192bb/verl/trainer/distillation/losses.py)

### 9.3 k1、k2、k3 不能只看“都在算 KL”

令 $d=\log q_\theta(a)-\log p(a)$，$a\sim q_\theta$，暂不考虑 clamp：

$$
k_1=d,\qquad k_2=\tfrac12d^2,\qquad k_3=e^{-d}+d-1.
$$

| 估计器 | 前向期望 | 固定样本直接求导的期望 |
| --- | --- | --- |
| k1 | reverse KL | 0，缺失教师权重 |
| k2 | 一般不是 KL | 固定状态 reverse-KL 梯度 |
| k3 | reverse KL | 固定状态 forward-KL 梯度 |

k2 的固定样本导数是 $d\nabla\log q$；k3 是 $(1-p/q)\nabla\log q$。后者取学生期望后等于 $-\sum_vp_v\nabla\log q_v$。这些是归一化与支持集假设下的代数结果，不是“k3 总比 k1 好”的经验排名。把 k3 detach 当 PG reward 也一般不等于 k1 PG。

verl 通用 KL 工具中的带 `+` 名称，不代表蒸馏注册表接受相同字符串；例如不能未经检查就给 OPD 写 `k3+`。实际 clamp 会进一步改变理想梯度。[KL 工具源码](https://github.com/verl-project/verl/blob/a08ea02a784d7d4982b1d81df36d188a476192bb/verl/trainer/ppo/core_algos.py)

### 9.4 局部匹配与完整序列目标

设固定时域为 $H$，$\ell_t=\log q_\theta(a_t\mid s_t)-\log p(a_t\mid s_t)$。完整序列 reverse KL 的梯度可以改写成因果形式：

$$
\nabla_\theta J_{\mathrm{seq}}
=\mathbb E_{Q_\theta}\left[
\sum_{u=1}^{H}\nabla_\theta\log q_\theta(a_u\mid s_u)
\sum_{t=u}^{H}\ell_t\right].
$$

因此完整梯度要求第 $u$ 个动作承担未来的 log-ratio 代价。**TML 的 $\gamma=0$ 只优化即时 token，是有实证依据的局部选择，不是完整序列梯度的无偏估计。** Direct GKD 固定 rollout 前缀后反传也忽略状态分布梯度。不断重新采样改善访问状态，并不会在一次 backward 内补齐这一项。

真实变长序列还需定义 EOS、截断尾部及长度权重。逐条按长度平均与全 batch 按有效 token 平均并非同一目标；对未结束片段累加未来回报时，还需处理截断或 bootstrap。

## 10｜verl GKD OPD 与 PG OPD 的配置

### 10.1 teacher-top-k 的 Direct GKD

令 $T_k$ 是教师 top-k 集合。使用完整 softmax 下的原始概率，**不在 top-k 内重新归一化**：

$$
\widetilde D_F^{(k)}(s)
=\sum_{v\in T_k}p_v\log\frac{p_v}{q_v}.
$$

缺失尾部后，这个和不一定非负。`forward_kl_topk` 在每个位置汇总 top-k 后执行 `clamp_min(0)`，负值位置的梯度会被丢弃。未裁剪时，若 $M_p=\sum_{v\in T_k}p_v$，其 logit 梯度为：

$$
\frac{\partial\widetilde D_F^{(k)}}{\partial z_j}
=M_pq_j-\mathbf1\{j\in T_k\}p_j.
$$

未采样的教师 top-k 候选也能得到直接监督；softmax 耦合还会影响其他 logits，但无法恢复尾部逐 token 标签。

`forward_kl_topk_tail` 把未选 token 合为一个 tail 类。令 $M_q=\sum_{v\in T_k}q_v$：

$$
D_{\mathrm{coarse}}^{(k)}
=\sum_{v\in T_k}p_v\log\frac{p_v}{q_v}
+(1-M_p)\log\frac{1-M_p}{1-M_q}.
$$

这是真正的粗粒化 forward KL，也是 full forward KL 的下界；不知道 tail 内部如何分配。当前实现要求 `log_prob_min_clamp: null`，fused 后端需提供可微 `student_mass`，否则会拒绝执行。[固定版本损失与 tail 分支](https://github.com/verl-project/verl/blob/a08ea02a784d7d4982b1d81df36d188a476192bb/verl/trainer/distillation/losses.py)

### 10.2 纯 OPD 的公共配置片段

以下是 **合并到完整训练配置的片段**，不是可以直接运行的启动命令；数据、学生模型、训练后端与资源仍需配置。数值是解释性基线，未做 GPU 训练验证。

```yaml
distillation:
  enabled: true
  nnodes: 1
  n_gpus_per_node: 2
  teacher_models:
    teacher_model:
      model_path: Qwen/Qwen3-32B
      inference:
        name: vllm
        tensor_model_parallel_size: 2
        gpu_memory_utilization: 0.8
  distillation_loss:
    use_task_rewards: false
    loss_max_clamp: null
    log_prob_min_clamp: null

actor_rollout_ref:
  actor:
    use_kl_loss: false
  rollout:
    temperature: 1.0
    top_p: 1.0
    top_k: -1

algorithm:
  use_kl_in_reward: false
```

师生需共享 tokenizer / vocab；教师显存、TP/DP/PP 与副本数必须匹配。上下文需覆盖 prompt + response 及服务要求的额外位置。`top_k: -1` 按该后端的“关闭截断”约定使用，换后端须核对；示例 GPU 数不构成容量承诺。

在公共配置上深度合并下面 **一种** 覆盖，不要把多个同名 YAML 顶层键简单拼接。

GKD：

```yaml
distillation:
  distillation_loss:
    loss_mode: forward_kl_topk
    topk: 128
    use_policy_gradient: false
```

tail 模式可改为 `loss_mode: forward_kl_topk_tail`，并保留 `log_prob_min_clamp: null`，设置 `tail_mass_eps: 1.0e-6`；先检查后端可微 mass 支持。

PG：

```yaml
distillation:
  distillation_loss:
    loss_mode: k1
    use_policy_gradient: true
    policy_loss_mode: vanilla
    clip_ratio: 0.2
    clip_ratio_low: 0.2
    clip_ratio_high: 0.2
```

本次固定版本默认是 `k3`、`use_policy_gradient: false`、`use_task_rewards: true`，所以默认配置不是 TML k1 PG。`k1` 直接反传会被校验拒绝；本路径当前只支持 `policy_loss_mode: vanilla`。[固定配置](https://github.com/verl-project/verl/blob/a08ea02a784d7d4982b1d81df36d188a476192bb/verl/trainer/config/distillation/distillation.yaml)、[官方配置解释](https://verl.readthedocs.io/en/latest/algo/opd.html)

不要把整个位点的 top-k KL 当成 sampled-token PG reward。这个标量不能告诉 PG 当前动作应奖励还是惩罚，也无法直接使用非采样候选的教师标签。若加入任务奖励，分别记录 task loss、distillation loss 与系数，防止重复叠加同方向 KL。

### 10.3 为什么不需要每轮扫描 temperature / top-k

学生生成温度与截断决定真实行为策略；蒸馏温度决定比较的软分布；教师返回 top-k 决定监督载荷。这三者不同。

若按行为分布 $b$ 采样，却用基础 softmax $q_\theta$ 的 logprob 套用无偏 reverse-KL 结论，通常不成立。应把目标也定义为 $b$，或做正确修正。硬 top-k 产生零概率，普通重要性采样不能恢复被完全截去的支持；单 token ratio 仍不能解决前缀失配。

建议先用温度 1、无生成截断的明确定义基线，再按验证集调整探索。这不是通用最优超参。教师只做评分时，“教师生成温度”没有单独意义，需核实评分接口对 logits 的缩放。

## 11｜工程落地、观测与最小测试

### 11.1 怎样选择第一条实验路线

| 约束 / 目标 | 优先比较 | 首要风险 |
| --- | --- | --- |
| 教师仅提供给定 token 的 logprob | k1 PG | 概率口径、方差、clip 与策略陈旧 |
| 教师提供 top-k，希望监督未采样候选 | Direct GKD，支持时比较 tail | top-k 质量覆盖、负值裁剪、后端能力 |
| 教师 full logits 可用，做理论对照 | full forward / reverse KL | 内存与通信 |
| 学生很少访问有效推理路径 | 覆盖性 SFT 后再比较 OPD | 初始化与可探索支持不足 |
| 希望超过教师或改善外部任务奖励 | verifier / GRPO 与 OPD 对照或联合 | 教师偏差、奖励冲突、成本归因 |

固定 SFT 初始化、prompt 划分、有效 token 预算和评测解码设置，比较 k1 PG、GKD 与 SFT。再按资源加入 tail、任务奖励、多随机种子；不要跨方法比较 loss 绝对值来排名。

### 11.2 训练数据与服务契约

每条 rollout 应能追溯：`run_id`、`sample_id`、输入 / 输出 token IDs、response mask、旧策略 logprob、行为采样配置、学生 / 教师 checkpoint、tokenizer / chat-template 版本、EOS / 截断原因。top-k 路径另存教师 token IDs 与原始 logprobs，并验证索引与词表一致。

教师超时只重试评分，按“样本 + 教师版本 + 评分配置”缓存，避免重试时悄悄生成另一条回答。缺失 token 分数、NaN、空有效 mask、上下文超限应明确失败或隔离，不能伪造为零分。checkpoint、优化器与 rollout 权重版本一起恢复，避免断点续训混用陈旧策略。

### 11.3 观测项与验收点

- **数据链路：** 首个 response token 的 causal shift；prompt / padding mask；空回答、EOS、超长截断、特殊 token；教师返回顺序与 IDs 对齐。
- **梯度：** $p=q$ 时 full KL 与梯度接近零；用大量采样验证 k1 PG 梯度接近 full reverse KL；直接 k1 backward 应暴露差异；k 等于词表大小时恢复 full forward KL。
- **top-k：** 记录 teacher / student mass、tail mass、负值位置比例；检查 tail 粗粒化 KL 非负和 fused mass 梯度；不能通过 clamp 掩盖索引错误。
- **PG：** 记录 log-ratio 分位数、ratio、clip fraction、策略版本差和优势尺度；区分任务与蒸馏两份损失。
- **成本：** rollout / 教师评分 / 更新耗时、有效 token、吞吐、截断率、GPU-hours 和费用。教师查询成本应进入总账。
- **结果：** 独立验证集正确率、格式与指令遵循、长度、域外退化及不确定性；训练 KL 下降不能代替业务收益。

这些是建议的训练验收用例，本文未实际运行模型训练。后续可优先做同预算 PG / GKD / tail 对照，再研究未来回报、混合 task reward 与多教师；先固定版本和基础数据链路。

### 11.4 来源版本与同步说明

本次核对日期：2026-10-29。TML 指 2025 年原始博客，现行 cookbook 与 verl 的代码核对分别固定到 `88fb643c913341279f7c7a666e1e8fbb5c6e8f63`、`a08ea02a784d7d4982b1d81df36d188a476192bb`，避免 `main` 后续变化导致配置歧义。第 9 节梯度推导、选型表与测试清单是本文整理分析。

本次在原 GRPO/OPD 文章中增加专题，保留原论文主线与实验；同步更新原 Notion 页面。两处章节编号和符号各自沿用原文，数学结论按角色对应。


## 附录｜序列梯度与奖励目标的边界

下面补充主线所需的数学条件。首次阅读可以先跳过。

### A｜逐 token 计算 KL，不等于已求出完整序列梯度

设输入为 $x$，回答为 $y=(y_1,\ldots,y_T)$，前缀为 $s_t=(x,y_{<t})$。对包含 EOS、归一化良好的自回归序列分布，KL 链式法则给出：

$$
\operatorname{KL}(\pi_\theta\|\pi_T)
=\mathbb E_{y\sim\pi_\theta}\sum_t
\operatorname{KL}\!\left(\pi_\theta(\cdot\mid s_t)\|\pi_T(\cdot\mid s_t)\right).
$$

FKL 的对应等式使用教师轨迹，而不是学生轨迹。两者都是逐序列求和。按长度归一化可能改变目标。

右侧的学生参数影响两件事：当前前缀的 token 分布，以及模型会访问哪些前缀。把已采样前缀当常量，只反传 token KL，会忽略后一项。这是一种局部更新近似。

对完整序列 RKL，精确的 score-function 梯度为：

$$
\nabla_\theta\operatorname{KL}(\pi_\theta\|\pi_T)
=\mathbb E_{y\sim\pi_\theta}
\left[\log\frac{\pi_\theta(y\mid x)}{\pi_T(y\mid x)}
\nabla_\theta\log\pi_\theta(y\mid x)\right].
$$

因此，直接对一个已采样 token 的 `log_q - log_p` 反传，不会自动得到上述梯度。sampled RKL 需要正确处理采样分布、停止梯度和策略梯度估计。

[Thinking Machines 的 OPD 实现](https://thinkingmachines.ai/blog/on-policy-distillation/#loss-function-reverse-kl)采用只优化当前 token 的简化，不计算未来 token 回报。应把它看作工程选择，而非完整序列梯度恒等式。

### B｜OPD 的隐式奖励是局部解释

固定当前学生 $\pi_k$。论文定义：

$$
\widetilde R_T^k(x,y)
=\beta\sum_t\log\frac{\pi_T(y_t\mid s_t)}{\pi_k(y_t\mid s_t)}.
$$

$\beta>0$ 是缩放系数。在 $\pi_k$ 处，用这个固定奖励计算的策略梯度，等于负序列 RKL 梯度乘以 $\beta$。这说明 OPD 可以用密集的教师信号进行局部策略更新。

这个等式不说明教师反馈等于真实任务奖励，也不保证任务正确率随 KL 单调改善。[原论文附录 A](https://arxiv.org/html/2605.12483v5#A1)

### C｜RKL 何时等价于带正则的奖励优化

设任务奖励为 $R(x,y)$，参考策略为 $\pi_{\rm ref}$，正则强度为 $\beta>0$。考虑目标：

$$
F(\pi)=\mathbb E_{y\sim\pi}[R(x,y)]
-\beta\operatorname{KL}(\pi\|\pi_{\rm ref}).
$$

不受学生容量约束时，最优分布为：

$$
\pi_R^*(y\mid x)=\frac{1}{Z_R(x)}
\pi_{\rm ref}(y\mid x)\exp\left(\frac{R(x,y)}{\beta}\right).
$$

$Z_R$ 是归一化常数。将这个分布代入 KL 定义，可得：

$$
F(\pi)=\beta\log Z_R(x)
-\beta\operatorname{KL}(\pi\|\pi_R^*).
$$

所以，当教师恰好为 $\pi_R^*$，且参考策略与 $\beta$ 一致时，在同一学生策略集合内，最小化序列 RKL 就等价于最大化 $F$。

实际教师只是近似。实际训练也可能使用局部梯度。因此，不能把这条有条件的等价关系直接当作训练结果保证。

## 来源与核验范围

-  **主线论文：** [Xu、Sang 等，arXiv:2605.12483v5](https://arxiv.org/abs/2605.12483v5)，2026-10-12 修订。实验数据核对表 1—4 与附录 F，理论核对第 3 节与附录 A。[作者链接的代码](https://github.com/HJSang/OPSD_OnPolicyDistillation)。
-  **on-policy 蒸馏：** [Agarwal 等，On-Policy Distillation of Language Models / GKD](https://arxiv.org/abs/2306.13649)，ICLR 2024。[Kevin Lu / Thinking Machines Lab，On-Policy Distillation](https://thinkingmachines.ai/blog/on-policy-distillation/)，2025-10-27。
-  **GRPO：** [Shao 等，DeepSeekMath](https://arxiv.org/abs/2402.03300)，2024。

本文是中文学习笔记。概念解释、代码片段和反例由本文整理，不是论文实验。已核对原文，未重跑训练。论文主要测试可验证数学与代码任务，部署学生为 1.7B—8B；结论不能直接推广到所有模型和任务。

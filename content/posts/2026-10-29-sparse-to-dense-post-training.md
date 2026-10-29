---
{
  "title": "从 GRPO 到 OPD：理清 SFT、KL 与蒸馏的关系",
  "slug": "sparse-to-dense-post-training",
  "date": "2026-10-29",
  "updated": "2026-10-29",
  "author": "余亚雄",
  "category": "技术",
  "tags": ["学习笔记", "大模型后训练", "知识蒸馏", "强化学习"],
  "description": "以 arXiv 2605.12483v5 为线索，依次说明 SFT 与 FKL、RKL、rollout 来源、OPD 和 GRPO。用 token 训练过程与梯度解释差异，再讨论学生能力和方法选型。",
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

## 延伸阅读｜TML 与 verl 的 OPD 实践

TML On-Policy Distillation 的训练流程、Direct KL 与策略梯度推导、verl GKD / PG 配置及工程检查已整理为独立文章：

[阅读《TML On-Policy Distillation 与 verl：原理、梯度与工程实践》](/articles/tml-verl-on-policy-distillation/)

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

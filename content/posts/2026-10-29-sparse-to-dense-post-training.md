---
{
  "title": "从 GRPO 到 On-Policy Distillation：稀疏奖励、密集蒸馏与策略投影",
  "slug": "sparse-to-dense-post-training",
  "date": "2026-10-29",
  "updated": "2026-10-29",
  "author": "余亚雄",
  "category": "技术",
  "tags": ["学习笔记", "大模型后训练", "知识蒸馏", "强化学习"],
  "description": "精读 arXiv 2605.12483v5：先用稀疏奖励改善教师，再用 FKL 与 OPD 迁移到学生。厘清 rollout、KL 方向、token 训练、梯度及容量约束，区分论文实证与工程推导。",
  "status": "published",
  "math": true,
  "styles": ["/assets/post-training-note.css"]
}
---

## 00｜太长不看版

 **当可验证的训练题目比算力更稀缺时，先让更有探索能力的教师从稀疏奖励中发现好策略，再把它转成学生能够学习的密集监督。**  这是本文主线论文的经验原则，而不是新发明一种 KL 或宣称蒸馏普遍替代 RL。

-  **方案：** 教师 GRPO → 教师轨迹上的 Forward KL 预热 → 学生轨迹上的 On-Policy Distillation（OPD）→ 可选的学生 GRPO。
-  **结果：** 同为 Qwen3-1.7B 学生，RL 后的 8B 教师加两阶段蒸馏，在 MATH-500 上达到 79.3%，直接学生 GRPO 为 75.9%；比较固定标注数据， **没有固定总算力** 。
-  **概念：** SFT 是训练方式，FKL/RKL 是分布损失，on/off-policy 描述训练数据与当前学生策略的关系。本文论文中的 OPD 特指学生 rollout 上的 RKL；广义 on-policy 蒸馏也可以使用其他损失。
-  **边界：** 密集反馈不等于逐 token 的正确性证明；KL 最优不等于任务奖励最优；学生暂时答不对也不代表 RKL 必然学不到。

本文适合希望把后训练概念连接到实现的读者。原论文为 Xu、Sang 等人的 [Beyond GRPO and On-Policy Distillation](https://arxiv.org/abs/2605.12483v5)，以下实验均核对  **v5（2026-10-12）** 。第 1—2 节整理论文；第 3—7 节补充概念、数学推导和工程解释，不把这些延伸冒充论文实验结论。

## 01｜论文问的不是“哪个算法最好”，而是“数据先给谁”

在数学和代码任务中，可以通过标准答案或测试用例给整条回答打分。这种 **序列级稀疏奖励** 能告诉模型答案是否正确，却不直接标出数千个 token 中哪一步应当改。

如果学生很少采样到高质量解答，直接 RL 会面临探索与信用分配困难。较强教师可能更容易利用同一组题目找到有效行为；随后，冻结教师，在每个前缀提供 next-token 分布，就能把昂贵的探索结果转成可重复查询的 **密集监督** 。这里的“密集”是反馈位置更密集，不保证每个位置都提供独立、正确的推理知识。

论文将这种分工落实为四个阶段。下面的顺序很重要：先改善监督来源，再解决学生的学习入口，最后处理学生自己的分布。

<figure class="pt-figure">
<strong>图 1｜从策略发现到部署压缩</strong>
<ol class="pt-flow">
<li><b>教师 RL：发现好策略</b><span>较强教师生成答案；verifier 给序列奖励；GRPO 更新教师。</span></li>
<li><b>FKL 预热：建立覆盖</b><span>冻结教师；教师生成轨迹；学生在相同前缀匹配教师分布。</span></li>
<li><b>OPD：纠正自身轨迹</b><span>当前学生生成轨迹；教师评价学生前缀；RKL 更新学生。</span></li>
<li><b>学生 RL：可选再探索</b><span>用此前留出的标注题目，在已经改善的学生上继续 GRPO。</span></li>
</ol>
<figcaption>根据原论文第 2 节重新绘制。箭头顺序为 01 → 02 → 03 → 04；第 4 阶段可省略。教师 logits 是对前缀的条件分布，不是另写一份“正确答案”。</figcaption>
</figure>

论文用两个条件解释桥接过程： **C1，教师在目标奖励上足够好；C2，教师与学生在应用 OPD 的区域有足够的有效概率覆盖重叠。**  教师 RL 服务 C1，FKL 预热改善 C2，OPD 则把监督移到学生实际访问的前缀。这里的“覆盖不足”通常指有效概率质量不足；普通 softmax 的 token 概率一般并非严格为零。

这是一个在可验证数学、代码任务中的分阶段经验原则。它不证明所有任务必须先训练更大教师，也不意味着不经 RL 的教师没有蒸馏价值。[原文第 2—3 节](https://arxiv.org/html/2605.12483v5#S2)

## 02｜实验支持什么，又没有支持什么

先看最直接的对照：部署学生固定为 Qwen3-1.7B，教师固定为 8B。下表取自原论文表 1、表 2 的完整 DAPO 数据设置， **均未追加 Stage 3 学生 RL** 。

| 学生训练路线 | MATH-500 | AIME 2024 | AIME 2025 |
| --- | --- | --- | --- |
| 直接学生 GRPO | 75.9 ± 0.9 | 19.8 ± 1.4 | 17.1 ± 0.9 |
| 原始 8B 教师 → FKL + OPD | 71.5 ± 0.9 | 15.0 ± 1.5 | 10.6 ± 1.2 |
| RL 后 8B 教师 → 仅 OPD | 77.6 ± 0.8 | 23.0 ± 1.4 | 18.9 ± 1.4 |
| RL 后 8B 教师 → teacher-sample SFT | 76.0 ± 0.9 | 22.4 ± 1.5 | 19.4 ± 1.4 |
|  **RL 后 8B 教师 → FKL + OPD**  |  **79.3 ± 0.7**  |  **25.2 ± 1.6**  |  **20.2 ± 1.3**  |

单位为百分比。 **avg@16**  是每题独立生成 16 次，先求该题平均正确率，再对题目平均；不是 pass@16，也不是多数投票。± 是跨评测题目的标准误， **不是多次独立训练的波动** 。

为直观看到量级，下图仅摘出 MATH-500 的四条路线；零起点避免夸大差异，精确数据与误差见上表。

<figure class="pt-figure">
<strong>图 2｜固定学生，改变监督来源与桥接方式</strong>
<div class="pt-bars" role="img" aria-label="MATH-500 平均正确率：原始教师桥接 71.5，直接学生 GRPO 75.9，RL 教师仅 OPD 77.6，RL 教师 FKL 加 OPD 79.3；横轴从 0 到 100%。">
<div class="pt-bar"><span>原始教师 → 桥接</span><div class="pt-track"><div class="pt-fill" style="width:71.5%"></div></div><b>71.5</b></div>
<div class="pt-bar"><span>直接学生 GRPO</span><div class="pt-track"><div class="pt-fill" style="width:75.9%"></div></div><b>75.9</b></div>
<div class="pt-bar"><span>RL 教师 → 仅 OPD</span><div class="pt-track"><div class="pt-fill" style="width:77.6%"></div></div><b>77.6</b></div>
<div class="pt-bar"><span>RL 教师 → 完整桥接</span><div class="pt-track"><div class="pt-fill best" style="width:79.3%"></div></div><b>79.3</b></div>
</div>
<figcaption>根据表 1、表 2 重绘，横轴为正确率 0—100%。本文没有根据标准误另行宣称统计显著性。</figcaption>
</figure>

合理读法有四点：

1.  **教师质量不能用参数量代替。** 同一个 8B 教师，RL 前后桥接端点相差 7.8 个百分点；本设置中，原始教师桥接甚至低于直接学生 GRPO。Llama 与代码实验也复现了“原始教师迁移 < 直接 GRPO < RL 教师迁移”的端点排序。
2.  **FKL 预热有效，但 OPD 冷启动并没有失效。** 77.6 → 79.3 是预热增加的 1.7 个百分点；77.6 本身已高于直接 GRPO。不能把“初始差距大更难学”写成“学生不会答对就不能做 RKL”。
3.  **不要过度解释消融。** 论文的“无 OPD”行标为 teacher-sample SFT，并非明确的“保留完全相同 FKL 预热、只删后续 OPD”对照。因此 79.3 − 76.0 = 3.3 更稳妥地表述为完整桥接相对该单阶段迁移基线的增益，不是独立、可相加的 OPD 因果贡献。
4.  **学生 RL 仍有价值，但实验分组不同。** 另一个半数据实验中，8B 教师路线只用前半数据完成桥接，MATH 为 75.4%；再用后半新题做学生 GRPO 达到 78.5%，而重用前半题的匹配更新对照为 75.7%。不能把 +3.1 直接加到完整数据的 79.3 上。

还有一个重要成本边界：附录 F 报告直接学生 GRPO 约 50.2 H200 GPU 小时，8B 教师优先路线约为其  **4 倍算力** ，另有教师 rollout 与 logits 查询开销。它支持的是 **稀缺标注数据的分配收益** ，不是“同等总算力下必胜”，更不是“最省钱”。[原论文表 1—4、附录 F](https://arxiv.org/html/2605.12483v5#S4)

## 03｜拆开三个维度：前缀从哪来、目标是什么、损失朝哪边

设输入为 $x$，回答为 $y=(y_1,\ldots,y_T)$，第 $t$ 步前缀为 $s_t=(x,y_{<t})$。固定同一前缀 $s$，记教师 next-token 分布为 $p(v)=\pi_T(v\mid s)$，学生为 $q(v)=\pi_\theta(v\mid s)$，$v$ 遍历共享词表 $V$。

“蒸馏”是把教师行为迁移给学生的任务；“on-policy”描述学生是否在自己当前策略产生的轨迹上学习；FKL/RKL 则描述条件分布之间的损失方向。三者不能互换。

| 前缀 / rollout 来源 | 训练目标 | 相对学生的分类 |
| --- | --- | --- |
| 固定人工答案或教师答案 | 硬标签交叉熵 | 常见离线 SFT；教师答案时也是序列蒸馏 |
| 教师 rollout | FKL：KL(教师 ∥ 学生) | off-policy FKL 蒸馏 |
| 教师 rollout | RKL：KL(学生 ∥ 教师) |  **off-policy RKL 蒸馏**  |
| 当前学生 rollout | FKL 或其他分布损失 | on-policy 蒸馏；不等于本文论文的特定 OPD 配方 |
| 当前学生 rollout | RKL | 本文论文称为 OPD |
| 近期学生 rollout | verifier 奖励、组内优势及裁剪目标 | GRPO；属于策略优化而非教师分布匹配 |

 **所以，把教师轨迹上的 FKL 换成 RKL，得到的是 off-policy RKL，不会自动变成 OPD。** 即使 RKL 内部按学生概率对词表加权，外部访问的前缀仍然来自教师。

同理，“来自学生”也需要时间限定：很久以前的学生轨迹，相对当前策略已经存在分布差异。近期策略采样、若干轮更新是常见近似；大量旧轨迹重放不能只凭模型名字仍叫 student 就视为严格 on-policy。若使用温度、top-p 等改变行为分布，也要记录实际采样策略。[GKD 原论文](https://arxiv.org/abs/2306.13649)、[Thinking Machines 的 OPD 实现说明](https://thinkingmachines.ai/blog/on-policy-distillation/)

### SFT 与 FKL：有关联，但不能无条件画等号

普通 SFT 对一个目标 token $a$ 的损失为 $-\log q(a)$，也就是把目标看成 one-hot 分布。软标签 FKL 则为：

$$
L_F=\sum_{v\in V}p(v)\log\frac{p(v)}{q(v)}
=H(p,q)-H(p).
$$

$H(p,q)=-\sum_v p(v)\log q(v)$ 是交叉熵，$H(p)$ 是固定教师的熵；优化学生时两者梯度相同。如果 $a$  **确实从同一个教师条件分布 $p$ 采样** ，那么硬标签损失的期望就是 $H(p,q)$。

因此，按教师真实分布采样的序列 SFT，可以视为相应教师轨迹 FKL 交叉熵项的 Monte Carlo 估计。但一条固定答案不是完整软分布；greedy 解码、筛选正确解、改温度或 top-p 后，目标数据分布也随之改变。人工 SFT 更不能直接等同于某个教师的 FKL。

## 04｜教师给出 10 个 token 和 logits，学生究竟怎么训练

假设 teacher/student 共享 tokenizer、词表索引和聊天模板。教师针对同一个 prompt 生成 $y_1,\ldots,y_{10}$，并保留每个生成位置在 **采样前** 的全词表 logits。这里每个位置有 $|V|$ 个数，不是只有被选中 token 的一个 logit。

1. 把 `prompt + 教师 response` 输入学生，用  **teacher forcing**  前向计算。学生不必先自行生成这 10 个 token；有因果 mask 的 Transformer 可以一次计算所有位置。
2. 对齐预测：预测 $y_1$ 的学生分布来自 prompt 最后一个位置；预测 $y_t$ 的分布来自前缀 $(x,y_{<t})$，不是已经看见 $y_t$ 的位置。
3. 教师和学生都在 **完全相同的前缀** 上产生分布。用温度 $\tau>0$ 得到 $p_t=\operatorname{softmax}(z_t^T/\tau)$、$q_t=\operatorname{softmax}(z_t^S/\tau)$，然后逐位置计算 KL。
4. 只在有效 response 预测位置聚合损失，屏蔽 prompt、padding 和截断后的无效位置；EOS 是否参与要固定协议。教师冻结，梯度只更新学生。

令 $m_{bt}\in\{0,1\}$ 表示 batch 中第 $b$ 条样本、第 $t$ 个预测位置是否计入，常见 token 平均损失为：

$$
L=\frac{\tau^2}{\sum_{b,t}m_{bt}}
\sum_{b,t}m_{bt}\operatorname{KL}(p_{bt}\|q_{bt}).
$$

$\tau^2$ 是常见温度补偿约定，不是 KL 定义的一部分。以下代码只展示对齐后的核心计算，假定外部已构造好 attention mask 和 response mask：

```python
# logits: [batch, input_length, vocabulary]
# response_mask: [batch, input_length]，标记 token 本身是否为有效回答
# 两个模型使用完全相同的 input_ids / attention_mask
with torch.no_grad():
    teacher_logits = teacher(**inputs).logits
student_logits = student(**inputs).logits

log_p = (teacher_logits[:, :-1].float() / tau).log_softmax(-1)
log_q = (student_logits[:, :-1].float() / tau).log_softmax(-1)
mask = response_mask[:, 1:].to(log_q.dtype)  # 右侧 token 是预测目标
if mask.sum().item() == 0:
    raise ValueError("batch 中没有有效的 response 预测位置")

p = log_p.exp()
token_fkl = (p * (log_p - log_q)).sum(-1)
loss = tau**2 * (token_fkl * mask).sum() / mask.sum()
loss.backward()  # 只更新 student；随后由训练器执行 optimizer.step()
```

这段是解释用的全词表计算，内存复杂度与 `batch × length × vocabulary` 有关。长序列工程实现通常需要分块或融合算子，不应直接缓存所有长序列的完整 logits。

如果把核心损失替换为下面两行，而保持同一批教师前缀：

```python
q = log_q.exp()
token_rkl = (q * (log_q - log_p)).sum(-1)
```

它仍是  **off-policy RKL** 。若要转为论文的 OPD，必须让学生生成 response，再让冻结教师对这些 **学生前缀** 重新前向打分。教师原先在自己回答上缓存的 logits 不能搬到不同前缀上使用。

 **只有 teacher 文本，没有 logits 怎么办？** 可以做硬标签 SFT。只有采样 token 的 teacher log-prob，也不足以精确重建全词表 FKL；但在合适的学生采样与策略梯度估计中，可用于 sampled RKL。top-k logits 也不是完整分布：截断后重归一化会改变目标，必须说明近似方式；不同 tokenizer 更不能直接按词表下标计算 KL。

## 05｜看梯度，才知道 FKL 与 RKL 的差异在哪里

先固定一个前缀，令 $q=\operatorname{softmax}(z)$，温度暂取 1，教师 $p$ 冻结。对学生第 $j$ 个 logit 的精确梯度为：

$$
\frac{\partial L_F}{\partial z_j}=q_j-p_j.
$$

若教师认为 token $j$ 很重要、学生却几乎不给概率，$p_j$ 仍会直接推动它上升。这解释了 FKL 的  **mode-covering 倾向** ：遗漏教师高概率行为会受到明显惩罚。

反向 KL 是：

$$
L_R=\sum_vq_v\log\frac{q_v}{p_v},\qquad
\frac{\partial L_R}{\partial z_j}
=q_j\left(\log\frac{q_j}{p_j}-L_R\right).
$$

学生把概率放到教师极不认可的位置时，RKL 会施加压力；学生本来几乎不选的 token，则有外层 $q_j$ 抑制其 logit 梯度。这有助于理解 RKL 的  **mode-seeking 倾向** ，但它不是“必然只选一个模式”的定理，更不保证选中的模式任务奖励最高。若模型能完整表达教师，且无其他约束，两种 KL 的全局最优都是 $q=p$。

### “学生初始弱”究竟意味着什么

需要分开三个障碍：

-  **容量：** 学生模型族根本无法表示教师所有行为，训练不能凭空增加模型容量。
-  **访问：** 学生很少到达好的推理前缀，on-policy 数据就很少包含这些区域；FKL 教师轨迹预热可以先把它带进去。
-  **优化与估计：** 概率差距大可能带来极端 log-ratio；只采样少量 token 估计梯度时尤其可能方差高。全词表计算减少了当前前缀上的 token 采样噪声，却不解决所有前缀覆盖问题。

因此， **答错的学生 rollout 依然可以学** ：教师能在这些前缀上给出相对更好的 next-token 分布。但密集教师 log-prob 不是显式的步骤正确性标签；若前缀已经不可恢复，或教师本身不可靠，监督也可能有限。论文只证明其设置中的预热有收益，没有给出“低于某正确率就不适合 RKL”的阈值。

### 序列 KL、token KL 与“实际反传”还差一层

对于包含 EOS、归一化良好的自回归序列分布，KL 链式法则给出：

$$
\operatorname{KL}(\pi_T\|\pi_\theta)
=\mathbb E_{y\sim\pi_T}\sum_t
\operatorname{KL}\!\left(p(\cdot\mid s_t)\|q(\cdot\mid s_t)\right),
$$

$$
\operatorname{KL}(\pi_\theta\|\pi_T)
=\mathbb E_{y\sim\pi_\theta}\sum_t
\operatorname{KL}\!\left(q(\cdot\mid s_t)\|p(\cdot\mid s_t)\right).
$$

这里求和是逐序列累计；随意按长度归一化可能改变目标。两条公式中， **外层前缀分布随 KL 方向一起改变** 。教师前缀上的 RKL 当然可以训练，却不是第二条序列 RKL 的无偏估计。

第二条等式还不能解释成“学生采样后，把 token KL 反传一下，就是完整序列 KL 的精确梯度”。因为学生参数也影响 **访问哪些前缀** ；把采样前缀当常量会忽略这部分导数，得到局部 surrogate / semi-gradient。token 损失的精确计算与序列目标的精确梯度，是两个不同问题。

对完整序列目标 $K(\theta)=\operatorname{KL}(\pi_\theta\|\pi_T)$，在适当可微条件下，精确 score-function 梯度是：

$$
\nabla_\theta K
=\mathbb E_{y\sim\pi_\theta}
\left[\left(\log\pi_\theta(y\mid x)-\log\pi_T(y\mid x)\right)
\nabla_\theta\log\pi_\theta(y\mid x)\right].
$$

求导产生的额外常数项因 $\mathbb E[\nabla\log\pi_\theta]=0$ 消失。序列 log-prob 是 token log-prob 之和；实现中可用 reward-to-go 与 baseline 降低方差，但保留或丢弃未来回报会改变所用梯度估计。

 **实现陷阱：** 直接对一个已采样 token 的 `log_q - log_p` 做普通反传，并不会自动处理离散采样分布的导数。sampled RKL 需要正确的策略梯度 surrogate、停止梯度和采样分布处理；不能把一个数值上像 KL 的 Monte Carlo 值当作正确训练梯度。[Thinking Machines 的实现](https://thinkingmachines.ai/blog/on-policy-distillation/#loss-function-reverse-kl)明确采用只优化当前 token 的简化，并说明未考虑未来 token；它是工程选择，不是完整序列梯度恒等式。

## 06｜为什么 OPD 像 RL，却不等于 GRPO 或奖励最优

论文的理论先定义了一个 **KL 正则化的奖励目标** 。对固定 prompt，令任务奖励为 $R(x,y)$，参考策略为 $\pi_{\rm ref}$，正则强度为 $\beta>0$：

$$
F(\pi)=\mathbb E_{y\sim\pi}[R(x,y)]
-\beta\operatorname{KL}(\pi\|\pi_{\rm ref}).
$$

不受学生容量约束时，其最优分布是：

$$
\pi_R^*(y\mid x)=\frac{1}{Z_R(x)}
\pi_{\rm ref}(y\mid x)\exp\left(\frac{R(x,y)}{\beta}\right).
$$

$Z_R$ 负责归一化。这个式子表示在参考分布上提高高奖励回答的权重；它不是说 GRPO 一定精确达到这个分布。论文将 RL 后教师视为它的近似代理。

### 密集的隐式奖励：局部等价的含义

取当前学生 $\pi_k$ 为固定锚点，定义教师诱导的序列奖励：

$$
\widetilde R_T^k(x,y)
=\beta\sum_t\log\frac{\pi_T(y_t\mid s_t)}{\pi_k(y_t\mid s_t)}.
$$

在 $\theta=\theta_k$ 处，负序列 RKL 梯度等于以此固定奖励作 policy gradient 的梯度。它解释了 OPD 为什么可借用 RL 的 rollout 与更新框架：每个 token 都有教师与学生的 log-ratio 信号。 **这是围绕当前策略的局部梯度解释，不表示教师 log-prob 就是真实 verifier 奖励，也不保证持续降低 KL 会持续提高真实正确率。** [原论文式 1—3、附录 A](https://arxiv.org/html/2605.12483v5#A1)

GRPO 的监督源不同：同一题从近期策略采样 $G$ 个回答，verifier 得到 $R_i$，典型 outcome-reward 组内优势为：

$$
\widehat A_i=\frac{R_i-\overline R}{\operatorname{std}(R_1,\ldots,R_G)+\epsilon}.
$$

然后用 token 概率比 $\rho_{it}=\pi_\theta(y_{it}\mid s_{it})/\pi_{\rm old}(y_{it}\mid s_{it})$ 优化裁剪目标；省略可选 KL 正则项后，常见形式是最大化：

$$
\frac{1}{G}\sum_i\frac{1}{T_i}\sum_t
\min\!\left(\rho_{it}\widehat A_i,
\operatorname{clip}(\rho_{it},1-\delta,1+\delta)\widehat A_i\right).
$$

$T_i$ 是回答长度，$\delta$ 是裁剪幅度，$\epsilon$ 防止零除；不同实现的归一化和 KL 项可以不同。 **若组内二元奖励全为零或全为一，中心化后的奖励优势为零** ，该组无法提供这种相对奖励信号；可选 KL 正则仍可能产生梯度。GRPO 不需要教师 next-token 分布，其关键是任务奖励而非模仿教师。[DeepSeekMath：GRPO 原始论文](https://arxiv.org/abs/2402.03300)

### 容量约束：蒸馏是在可实现的策略族中做投影

学生只能从模型族 $\Pi_S$ 中选策略。于是实际问题可能是：

$$
\widehat\pi_F=\arg\min_{\pi\in\Pi_S}\operatorname{KL}(\pi_T\|\pi),
\qquad
\widehat\pi_R=\arg\min_{\pi\in\Pi_S}\operatorname{KL}(\pi\|\pi_T).
$$

若教师不在 $\Pi_S$ 内，两种投影通常不同：FKL 更重视覆盖教师概率质量，RKL 更重视避免把学生概率放到教师低概率区域。选型因此取决于学生容量、数据访问与评价指标，不能仅用“覆盖型 / 寻模态型”两个标签决定胜负。

更关键的是， **KL 最优与原始奖励最优不等价** 。一个两答案的说明性反例：教师概率为 $(0.6,0.4)$，奖励为 $(1,0)$；可行学生族只有 $(0.6,0.4)$ 与 $(0.9,0.1)$。两种 KL 都选择前者，因为 KL 为零；单看期望奖励则选择后者，奖励由 0.6 升到 0.9。这是数学反例，不是论文实验。

但存在一个值得保留的精确联系：当教师 **恰好等于** 前面的 $\pi_R^*$，且参考策略与 $\beta$ 一致时，代入定义可得：

$$
F(\pi)=\beta\log Z_R(x)
-\beta\operatorname{KL}(\pi\|\pi_R^*).
$$

因此，在同一可行模型族中，最小化 **序列 RKL** 等价于最大化这个 **带 KL 正则的奖励目标** ；它仍不等价于只最大化 $\mathbb E[R]$。现实中教师只是近似目标、token 局部更新又可能近似序列梯度，所以这条理想等价关系不能直接当作实际奖励单调上升的保证。

## 07｜实践选型：先识别瓶颈，再选训练信号

下表是依据前文推导整理的工程建议，不是原论文提供的普适排名。

| 眼前的约束 | 合理起点 | 必须核验的风险 |
| --- | --- | --- |
| 只有可靠答案文本 | 硬标签 SFT / 序列蒸馏 | 答案筛选、长度和模板是否适合学生 |
| 有教师完整 logits，学生与教师差距大 | 教师轨迹 FKL 预热 | 教师目标能力、token 对齐、有效概率覆盖 |
| 教师前缀表现好，学生自生成容易跑偏 | 学生 rollout 上的蒸馏；RKL 是候选 | 当前策略采样、教师在错误前缀上的质量、熵与多样性 |
| 标注题稀缺，较强教师可利用奖励继续提升 | 实验比较教师 RL → FKL → OPD | 教师训练和查询成本，固定数据预算下的收益 |
| 学生已具备可用探索能力、verifier 可靠 | 直接或桥接后的 GRPO | 组内奖励是否有差异、reward hacking、独立泛化 |
| tokenizer 不同或只能获得 top-k 分布 | 先做可验证的文本迁移或显式对齐方案 | 不能把不兼容的分布强行当作精确 token KL |

一个可执行的最小对照是： **SFT、FKL-only、OPD-only、FKL → OPD、直接 GRPO** 。若教师需另行训练，再加原始教师与 RL 教师对照；若追加学生 RL，则保留同一桥接初始化下的新题与旧题重放对照。为判断“删 OPD”的独立贡献，应另保留完全相同的 FKL-only checkpoint，而不同时换成硬标签 SFT。

评测时固定学生规模、训练题池与解码协议，同时报告教师查询量、训练 token 数、总 GPU 时间、正确率、输出长度和多样性。KL 下降只能说明更像教师；部署选型仍要看独立验证集的任务质量、延迟和成本。训练日志至少区分 token FKL/RKL、有效 token 数、熵、log-ratio 分位数、组内奖励方差和无有效奖励优势的组占比，避免只盯一个 loss。

本文留下的核心判断是： **稀疏奖励负责发现什么行为值得做，密集蒸馏负责让学生学会已有行为；rollout 决定在哪些状态学习，KL 方向决定如何衡量分布差异，容量决定能保留多少。** 这几个层次拆开后，SFT、OPD 与 GRPO 才能在同一训练系统中各司其职。

## 08｜来源、核验边界与后续阅读

1.  **主线论文：** [Xu、Sang 等，arXiv:2605.12483v5](https://arxiv.org/abs/2605.12483v5)，2026-10-12 修订。[HTML 全文](https://arxiv.org/html/2605.12483v5)。重点核对第 2—4 节、表 1—4，以及附录 A、C、F；本文表格和两幅图均根据论文重新整理，不是原图复制。
2.  **on-policy 蒸馏的广义框架：** [Agarwal 等，On-Policy Distillation of Language Models: Learning from Self-Generated Mistakes / GKD](https://arxiv.org/abs/2306.13649)，ICLR 2024。用于说明学生轨迹与损失函数选择是可分开的维度。
3.  **sampled RKL 的工程解释：** [Kevin Lu / Thinking Machines Lab，On-Policy Distillation](https://thinkingmachines.ai/blog/on-policy-distillation/)，2025-10-27。尤其关注其当前 token 更新、discount 取零的实现简化；不把文中的直观措辞理解为任务正确性保证。
4.  **GRPO：** [Shao 等，DeepSeekMath](https://arxiv.org/abs/2402.03300)，2024。本文仅给出 outcome-reward GRPO 的典型结构，不声称复现所有工程变体。
5.  **论文链接的实现入口：** [HJSang/OPSD_OnPolicyDistillation](https://github.com/HJSang/OPSD_OnPolicyDistillation)。复现时仍应核对具体 commit、run 配置和公开产物；本文完成了原文核验，未重跑训练实验，也未逐行审计全部实现。

 **阅读边界：** 本文是中文学习笔记与独立推导，不是论文完整译文。前序讨论中的疑问被重新整理为第 3—6 节；未以不可核验的聊天结论替代原始资料。论文证据集中于可验证数学与代码、1.7B—8B 部署学生；尚不能外推为开放式写作、跨 tokenizer 蒸馏或更大规模模型的必然规律。后续最值得补的实验是等总算力对照、多训练随机种子，以及固定 FKL 预热后的独立 OPD 消融。

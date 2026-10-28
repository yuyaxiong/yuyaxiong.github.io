import {esc,articlePath} from './components.mjs';

// 编辑精选不受发布时间影响。首页短标题不修改文章的真实标题。
const PICKS=[
  {
    "slug": "anthropic-claude-code-review-system",
    "category": "AI 工程",
    "title": "当 AI 写下 90% 的代码，谁来负责质量？",
    "summary": "Anthropic 如何重构 Code Review：当代码生产不再是瓶颈，质量保障与工程责任应该如何演进。",
    "label": "AI ENGINEERING"
  },
  {
    "slug": "k2lab-moras-platform-moat",
    "category": "Agent · 商业模式",
    "title": "当 AI 替达人卖货，谁能留下利润？",
    "summary": "从 K2 Lab / Moras 的案例，审视 AI 中间层的独立价值、议价权与长期护城河。",
    "label": "AGENT / BUSINESS"
  },
  {
    "slug": "marketing-conversion-system",
    "category": "商业增长",
    "title": "从消费者决策到成交：搭建营销转化系统",
    "summary": "结合 FCB、JTBD 与消费者旅程，把营销理论连接到渠道、成交和利润。",
    "label": "GROWTH / STRATEGY"
  }
];

export function renderHomepage(posts){
 const bySlug=new Map(posts.map(p=>[p.slug,p]));
 const selected=PICKS.map(item=>({...item,post:bySlug.get(item.slug)})).filter(item=>item.post);
 const curated=new Set(selected.map(item=>item.slug));
 const more=posts.filter(p=>!curated.has(p.slug)).slice(0,6);
 const top=selected[0];
 const lead=top?`<a class="home3-lead" href="${articlePath(top.post)}" aria-label="阅读：${esc(top.post.title)}"><div class="home3-lead-main"><div class="home3-overline"><span class="home3-index">01</span><span>${esc(top.category)}</span><span class="home3-overline-muted">外文精读 · 本期重点</span></div><h3>${esc(top.title)}</h3><p>${esc(top.summary)}</p><div class="home3-read">阅读深度解读 <span aria-hidden="true">↗</span></div></div><div class="home3-lead-aside" aria-hidden="true"><span class="home3-aside-caption">THIS STORY EXPLORES</span><p>当代码产出不再昂贵，<br>我们应该如何重新分配<br><strong>审查、判断与责任？</strong></p><span class="home3-aside-foot">${top.post.date.replaceAll("-",".")} · ${top.post.minutes} 分钟阅读</span></div></a>`:`<p class="home3-empty">精选文章正在整理。<a href="/articles/">浏览全部文章</a></p>`;
 const secondary=selected.slice(1,3).map((item,i)=>`<a class="home3-secondary-card" href="${articlePath(item.post)}" aria-label="阅读：${esc(item.post.title)}"><div class="home3-secondary-head"><span>0${i+2} / ${esc(item.label)}</span><span class="home3-arrow" aria-hidden="true">↗</span></div><h3>${esc(item.title)}</h3><p>${esc(item.summary)}</p></a>`).join("");
 const rows=more.map(p=>`<a class="home3-article-row" href="${articlePath(p)}" aria-label="阅读：${esc(p.title)}"><span class="home3-article-meta"><span>${esc(p.category)}</span><time datetime="${esc(p.date)}">${p.date.replaceAll("-",".")}</time></span><span class="home3-article-title">${esc(p.title)}</span><span class="home3-arrow" aria-hidden="true">↗</span></a>`).join("");
 return `<div class="home3"><section class="home3-intro" aria-labelledby="home3-title"><p class="home3-eyebrow">AI / TECHNOLOGY / BUSINESS / ORGANIZATION</p><h1 id="home3-title">理解 AI 时代的技术、商业与组织变革</h1><p class="home3-subtitle">探索技术如何改变生产力，Agent 如何重塑产品与商业，以及组织如何适应新的竞争环境。</p></section><section class="home3-curated" aria-labelledby="home3-curated-title"><div class="home3-section-title"><h2 id="home3-curated-title">编辑精选</h2><span>SELECTED WRITING</span></div>${lead}${secondary?`<div class="home3-secondary">${secondary}</div>`:""}</section><section class="home3-more" aria-labelledby="home3-more-title"><div class="home3-section-title"><h2 id="home3-more-title">更多文章</h2><a href="/articles/">查看全部 <span aria-hidden="true">↗</span></a></div><div class="home3-article-list">${rows||'<p class="home3-empty">更多文章正在整理。</p>'}</div></section></div>`;
}

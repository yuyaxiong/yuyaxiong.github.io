import {esc,articlePath} from './components.mjs';

// 编辑精选不随发文日期变化；新增文章默认进入「最近更新」。
const PICKS=[
  {
    "slug": "anthropic-claude-code-review-system",
    "label": "AI 技术与工程",
    "teaser": "当 AI 写下大部分代码，研发团队该如何重新设计审查、验证与责任体系？"
  },
  {
    "slug": "k2lab-moras-platform-moat",
    "label": "Agent 与 AI 产品",
    "teaser": "Agent 成为交易中间层之后，平台、品牌与达人之间的价值该如何分配？"
  },
  {
    "slug": "marketing-conversion-system",
    "label": "商业模式与增长",
    "teaser": "从消费者决策机制到渠道组合，如何构建可以测量的营销转化体系？"
  }
];

export function renderHomepage(posts){
const bySlug=new Map(posts.map(p=>[p.slug,p]));
const chosen=PICKS.map(d=>({...d,post:bySlug.get(d.slug)})).filter(d=>d.post);
const chosenSet=new Set(chosen.map(d=>d.slug));
const latest=posts.filter(p=>!chosenSet.has(p.slug)).slice(0,5);
const main=chosen[0];
const hero=`<section class="home-v2-hero" aria-labelledby="home-v2-title"><p class="home-v2-kicker">AI · AGENT · BUSINESS · ORGANIZATION</p><h1 id="home-v2-title">理解 AI 时代的技术、商业与组织变革</h1><p class="home-v2-intro">关注 AI 技术、Agent 产品与工具、商业模式和组织管理。从原理到实践，从案例到决策，记录值得长期思考的问题。</p></section>`;
const lead=main?`<article class="home-v2-lead"><div class="home-v2-lead-content"><p class="home-v2-type">${esc(main.label)} <span>· 重点推荐</span></p><h3><a href="${articlePath(main.post)}">${esc(main.post.title)}</a></h3><p class="home-v2-desc">${esc(main.teaser)}</p><a class="home-v2-read" href="${articlePath(main.post)}">阅读文章 <span aria-hidden="true">↗</span></a></div><div class="home-v2-visual" aria-hidden="true"><span class="home-v2-visual-caption">ENGINEERING SYSTEMS</span><div class="home-v2-visual-chain"><span>AI 生成</span><i></i><span>自动验证</span><i></i><span>风险决策</span><i></i><span>可靠交付</span></div></div></article>`:"";
const secondary=chosen.slice(1,3).map((d,i)=>`<article class="home-v2-side"><p class="home-v2-type">${esc(d.label)} <span>· 0${i+2}</span></p><h3><a href="${articlePath(d.post)}">${esc(d.post.title)}</a></h3><p>${esc(d.teaser)}</p><a class="home-v2-side-link" href="${articlePath(d.post)}" aria-label="阅读：${esc(d.post.title)}"><span aria-hidden="true">↗</span></a></article>`).join("");
const picks=main?`<div class="home-v2-picks">${lead}${secondary?`<div class="home-v2-secondary">${secondary}</div>`:""}</div>`:`<p class="home-v2-empty">精选文章正在整理。<a href="/articles/">浏览全部文章 ↗</a></p>`;
const updates=latest.map(p=>`<article class="home-v2-update"><div class="home-v2-update-meta"><span>${esc(p.category)}</span><time datetime="${esc(p.date)}">${p.date.replaceAll("-",".")}</time></div><h3><a href="${articlePath(p)}">${esc(p.title)}</a></h3><a class="home-v2-update-link" href="${articlePath(p)}" aria-label="阅读：${esc(p.title)}">↗</a></article>`).join("");
return `${hero}<section class="home-v2-featured" aria-labelledby="home-v2-featured-heading"><div class="home-v2-heading"><h2 id="home-v2-featured-heading">精选文章</h2><span>从这里开始阅读</span></div>${picks}</section><section class="home-v2-recent" aria-labelledby="home-v2-recent-heading"><div class="home-v2-heading"><h2 id="home-v2-recent-heading">最近更新</h2><a href="/articles/">全部文章 <span aria-hidden="true">↗</span></a></div><div class="home-v2-updates">${updates||'<p class="home-v2-empty">暂无更多文章。</p>'}</div><a class="home-v2-archive" href="/articles/">浏览全部文章 <span aria-hidden="true">↗</span></a></section>`;
}

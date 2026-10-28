import {mkdir,readFile,writeFile,cp,rm,readdir,unlink} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPosts} from './content.mjs';
import {layout} from './layout.mjs';
import {analyticsPrivacy} from './analytics.mjs';
import {renderHomepage} from './home.mjs';
import {esc,card,toc,articlePath,tagPath,categoryPath} from './components.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'docs');
const site=JSON.parse(await readFile(path.join(root,'site.json'),'utf8'));
if(site.url!=='https://yuyaxiong.github.io')throw Error('请同时更新站点 URL 与发布配置');
const posts=await loadPosts(root);const routes=[];
// Only the generated docs directory is replaced. Content and private sibling folders are never traversed.
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
await cp(path.join(root,'static'),output,{recursive:true});
async function page(url,meta){const f=decodeURIComponent(url.endsWith('.html')?url.slice(1):url.slice(1)+'index.html');await mkdir(path.dirname(path.join(output,f)),{recursive:true});await writeFile(path.join(output,f),layout(site,{...meta,path:url}));if(url!=='/404.html')routes.push(url);}
const intro=(label,title,desc)=>`<div class="page-intro"><p class="eyebrow">${label}</p><h1>${title}</h1><p>${desc}</p></div>`;
await page('/',{title:site.name,description:site.description,active:'home',body:renderHomepage(posts)});
await page('/articles/',{title:'全部文章',description:'按时间浏览 AI、Agent、商业与组织管理文章。',active:'articles',body:intro('ARCHIVE','全部文章',`${posts.length} 篇笔记，持续记录。`)+`<form class="search" role="search" action="/articles/"><label for="q">搜索文章</label><div><input id="q" name="q" type="search" placeholder="标题、摘要或标签" maxlength="100"><button type="submit">搜索</button></div><p id="result-count" role="status" aria-live="polite">按发布时间倒序排列</p></form><div id="post-list">${posts.map(p=>`<div data-post data-search="${esc([p.title,p.description,p.category,...p.tags].join(' ').toLowerCase())}">${card(p)}</div>`).join('')}</div><div id="empty-result" hidden><h2>没有找到相关文章</h2><p>试试“福特”“财务分析”，或清空关键词。</p><a href="/articles/">查看全部文章</a></div><noscript><p>当前显示全部文章。搜索需要启用 JavaScript；也可以通过分类与标签浏览。</p></noscript>`});
const categories=[...new Set(posts.map(p=>p.category))],tags=[...new Set(posts.flatMap(p=>p.tags))];
await page('/topics/',{title:'分类与标签',description:'通过主题找到感兴趣的笔记。',active:'topics',body:intro('TOPICS','分类与标签','按研究主题与文章类型浏览内容。')+`<section class="topic-section"><h2>分类</h2><div class="topic-links">${categories.map(t=>`<a href="${categoryPath(t)}">${esc(t)}<span>${posts.filter(p=>p.category===t).length} 篇 →</span></a>`).join('')}</div></section><section class="topic-section"><h2>标签</h2><p class="topic-tag-note">「外文精读」指基于外文资料的解读与分析，并非完整译文。</p><div class="tags large">${tags.map(t=>`<a href="${tagPath(t)}"># ${esc(t)} <small>${posts.filter(p=>p.tags.includes(t)).length}</small></a>`).join('')}</div></section>`});
for(const t of categories)await page(categoryPath(t),{title:`分类：${t}`,description:`${t}分类下的文章。`,active:'topics',body:intro('CATEGORY',esc(t),'同一主题下的笔记。')+`<a class="back-link" href="/topics/">← 全部分类与标签</a>`+posts.filter(p=>p.category===t).map(p=>card(p)).join('')});
for(const t of tags)await page(tagPath(t),{title:`标签：${t}`,description:`有关${t}的文章。`,active:'topics',body:intro('TAG','# '+esc(t),'沿着主题继续阅读。')+`<a class="back-link" href="/topics/">← 全部分类与标签</a>`+posts.filter(p=>p.tags.includes(t)).map(p=>card(p)).join('')});
await page('/about/',{title:'关于本站',description:'关于本站：理解 AI 时代的技术、商业与组织变革，记录技术工程、Agent 产品、商业研究与组织管理的思考。',active:'about',body:intro('ABOUT','关于这里','理解 AI 时代的技术、商业与组织变革。')+`<div class="prose about-prose"><h2>为什么写这个博客</h2><p>技术正在改变我们能够做什么，商业决定这些能力如何创造和分配价值，组织则决定判断能否转化为实际结果。这里用来持续理解这些变化，并把阅读、研究和实践中的发现整理成可讨论、可验证的文字。</p>
<h2>长期关注的四个方向</h2><ul><li><strong>AI 技术与工程：</strong>大模型、训练与推理、数据、模型评测，以及 AI 应用的工程实践。</li><li><strong>Agent 与 AI 产品：</strong>Agent 的能力边界、工具链、产品形态、真实应用场景和产品落地。</li><li><strong>商业模式与增长：</strong>企业战略、竞争优势、用户决策、营销、单位经济和案例研究。</li><li><strong>组织与管理：</strong>判断与决策、组织设计、人才培养、目标执行，以及技术变化对工作方式的影响。</li></ul>
<p>这些方向并非互相孤立：一项技术是否有价值，既要看它解决什么问题，也要看谁愿意为它付费，以及怎样的组织能把它持续交付出来。</p>
<h2>文章类型与标签</h2><p><strong>原创研究与案例分析：</strong>围绕具体问题，结合资料、数据与独立判断组织文章；区分已核实的事实、分析推演和需要继续验证的假设。</p>
<p><strong><a href="/tags/%E5%A4%96%E6%96%87%E7%B2%BE%E8%AF%BB/">外文精读</a>：</strong>基于外文技术文章、论文或案例进行中文深度解读，保留核心概念和论证脉络，并补充解释或独立分析。这不是原文的完整翻译，也不代表得到原作者的官方授权；文中会注明原始来源与链接。</p>
<p><strong>翻译：</strong>只有在具备相应许可或授权、实际提供译文时才使用该标签，不把精读、摘要或改写误标为完整翻译。</p>
<p>文章可以同时拥有<strong>主题标签</strong>与<strong>内容形式标签</strong>。通过 <a href="/topics/">分类与标签</a> 可以按领域浏览，也可以直接查看 <a href="/tags/%E5%A4%96%E6%96%87%E7%B2%BE%E8%AF%BB/">外文精读文章</a>。</p>
<h2>阅读原则、版权与勘误</h2><p>尽可能提供可追溯的来源，标明数据口径、时间背景和适用边界；把原作者的观点与本文延伸判断区分开，不把一个案例误当作普遍规律。</p>
<p>本站原创表达的版权归作者所有；引用资料和图片的权利归原权利人所有。未经许可不提供受版权保护作品的完整转载或完整译本。转载本站原创内容请先联系作者并保留来源。</p>
<p>新文章可在 <a href="/articles/">全部文章</a> 或 <a href="/feed.xml">RSS</a> 查看。如有事实或数字错误，可在 <a href="https://github.com/yuyaxiong/yuyaxiong.github.io/issues">GitHub Issues</a> 提交勘误，并注明文章、段落和证据。</p>
<h2>隐私</h2><p>${analyticsPrivacy(site)}站点托管服务可能记录访问日志，详见 <a href="https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement">GitHub 隐私声明</a>。</p></div>`});
for(const p of posts)await page(articlePath(p),{title:p.title,description:p.description,active:'articles',article:p,body:`<div class="reading-progress" aria-hidden="true"></div><header class="article-header"><a class="back-link" href="/articles/">← 全部文章</a><div class="post-meta"><a href="${categoryPath(p.category)}">${esc(p.category)}</a><span>${p.date.replaceAll('-','.')}</span><span>${p.minutes} 分钟阅读</span></div><h1>${esc(p.title)}</h1><p class="article-deck">${esc(p.description)}</p><div class="byline">${esc(p.author)}<span>更新于 ${p.updated.replaceAll('-','.')}</span></div></header><div class="article-layout"><aside>${toc(p.headings)}</aside><article class="prose">${p.html}<div class="article-end"><p>感谢阅读。</p><div class="tags">${p.tags.map(t=>`<a href="${tagPath(t)}"># ${esc(t)}</a>`).join('')}</div><a href="/articles/">← 返回文章列表</a><button class="print-button" type="button">打印或保存 PDF</button></div></article></div><a class="back-top" href="#main" aria-label="返回页首">↑</a>`});
await page('/404.html',{title:'页面未找到',description:'页面可能已经移动。',body:intro('404','这页笔记没有找到。','可以返回首页，或在文章列表中继续查找。')+`<div class="error-actions"><a class="primary" href="/articles/">查找文章 →</a><a href="/">返回首页</a></div>`});
const xml=s=>esc(s);const lastmod=posts[0]?.updated||'2026-10-21';
await writeFile(path.join(output,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map(p=>`<url><loc>${xml(site.url+p)}</loc><lastmod>${lastmod}</lastmod></url>`).join('')}</urlset>`);
await writeFile(path.join(output,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n`);
await writeFile(path.join(output,'feed.xml'),`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${xml(site.name)}</title><link>${site.url}</link><description>${xml(site.description)}</description><language>zh-cn</language>${posts.map(p=>`<item><title>${xml(p.title)}</title><link>${site.url+articlePath(p)}</link><guid isPermaLink="true">${site.url+articlePath(p)}</guid><description>${xml(p.description)}</description><pubDate>${new Date(p.date+'T00:00:00+08:00').toUTCString()}</pubDate></item>`).join('')}</channel></rss>`);
await writeFile(path.join(output,'.nojekyll'),'');
// Mirror only files listed in our generated-file manifest into the Pages root.
// Never recursively remove repository source folders or follow arbitrary paths.
const manifestPath=path.join(root,'.pages-files.json');
const allowed=f=>/^(?:favicon\.svg|index\.html|404\.html|feed\.xml|sitemap\.xml|robots\.txt|\.nojekyll|(?:assets|articles|categories|tags|topics|about)\/[^\\]+)$/.test(f)&&!f.split('/').includes('..');
async function collect(dir,prefix=''){let result=[];for(const entry of await readdir(dir,{withFileTypes:true})){const rel=prefix+entry.name;if(entry.isDirectory())result.push(...await collect(path.join(dir,entry.name),rel+'/'));else result.push(rel);}return result;}
const generated=await collect(output);
const previous=JSON.parse(await readFile(manifestPath,'utf8').catch(()=>'[]'));
if(![...generated,...previous].every(allowed))throw Error('Invalid generated file path');
for(const f of previous.filter(f=>!generated.includes(f)))await unlink(path.join(root,f)).catch(e=>{if(e.code!=='ENOENT')throw e;});
for(const f of generated){await mkdir(path.dirname(path.join(root,f)),{recursive:true});await cp(path.join(output,f),path.join(root,f));}
await writeFile(manifestPath,JSON.stringify(generated.sort(),null,2)+'\n');
console.log(`Built ${routes.length} pages, ${posts.length} published posts`);

import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {marked} from '../vendor/marked.mjs';
import {esc} from './components.mjs';
import {enhanceMarketingArticle} from './marketing-visuals.mjs';
import {renderMathMarkdown} from './math.mjs';
export async function loadPosts(root) {
  const dir=path.join(root,'content/posts');
  const files=(await readdir(dir)).filter(f=>f.endsWith('.md')).sort();
  const posts=[];const slugs=new Set();
  for (const file of files) {
    const raw=await readFile(path.join(dir,file),'utf8');
    const m=raw.match(/^---\r?\n([\s\S]+?)\r?\n---\r?\n([\s\S]*)$/);
    if (!m) throw Error(`${file}: 文章开头需要 JSON front matter`);
    const meta=JSON.parse(m[1]);
    for (const k of ['title','slug','date','updated','author','category','description','status']) if (typeof meta[k]!=='string'||!meta[k].trim()) throw Error(`${file}: 缺少字段 ${k}`);
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(meta.slug)||slugs.has(meta.slug))throw Error(`${file}: slug 不合法或重复`);
    slugs.add(meta.slug);
    for(const k of ['date','updated'])if(!/^\d{4}-\d{2}-\d{2}$/.test(meta[k])||Number.isNaN(Date.parse(meta[k]))||new Date(meta[k]+'T00:00:00Z').toISOString().slice(0,10)!==meta[k])throw Error(`${file}: 日期不合法`);
    if(!Array.isArray(meta.tags)||!meta.tags.length||meta.tags.some(t=>typeof t!=='string'||!t.trim()||/[\/\\]/.test(t)))throw Error(`${file}: 标签不合法`);
    if(/[\/\\]/.test(meta.category)||!['draft','published'].includes(meta.status)||meta.updated<meta.date)throw Error(`${file}: 元数据不合法`);
    if(meta.status==='draft')continue;
    const headings=[];let seq=0;
    const renderer=new marked.Renderer();
    renderer.heading=function({tokens,depth}){const text=this.parser.parseInline(tokens);const id=`section-${++seq}`;headings.push({id,text:text.replace(/<[^>]*>/g,''),depth});return `<h${depth} id="${id}">${text}</h${depth}>\n`;};
    renderer.table=function(token){return `<div class="table-scroll" role="region" tabindex="0" aria-label="数据表格，可横向滚动">${marked.Renderer.prototype.table.call(this,token)}</div>`;};
    const html=meta.math===true?renderMathMarkdown(m[2],renderer):marked.parse(m[2],{renderer});
    if(/<script|javascript:|<iframe|onerror\s*=/i.test(html))throw Error(`${file}: 不允许可执行嵌入内容`);
    const enhanced=enhanceMarketingArticle(meta.slug,html);
    if(meta.styles!==undefined&&(!Array.isArray(meta.styles)||meta.styles.some(s=>typeof s!=='string'||!/^\/assets\/[a-z0-9-]+\.css$/.test(s))))throw Error(`${file}: 文章样式必须是本地 CSS 资源`);
    posts.push({...meta,body:m[2],...enhanced,styles:[...new Set([...(meta.styles||[]),...enhanced.styles])],headings,minutes:Math.max(1,Math.ceil(m[2].replace(/\s/g,'').length/420))});
  }
  return posts.sort((a,b)=>b.date.localeCompare(a.date)||a.slug.localeCompare(b.slug));
}


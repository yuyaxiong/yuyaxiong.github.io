import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPosts} from './content.mjs';
import {analyticsConfig} from './analytics.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');const out=path.join(root,'docs');
async function files(dir){const a=[];for(const f of await readdir(dir)){const p=path.join(dir,f);(await stat(p)).isDirectory()?a.push(...await files(p)):a.push(p);}return a;}
const analytics=analyticsConfig(JSON.parse(await readFile(path.join(root,'site.json'),'utf8')));
const all=await files(out);const posts=await loadPosts(root);let links=0;
for(const file of all){
  assert(!/\.(pdf|docx|zip)$/i.test(file),'禁止发布私人文档');
  const body=await readFile(file,'utf8');
  assert(!/A-private|私人研读译本|ALAN@MULALLY|TABLE_INCOME|확보|chatgpt-content-reference|codex-file-preview/.test(body),`${file}: 包含私人或临时内容`);
  if(!file.endsWith('.html'))continue;
  assert.equal((body.match(/src="\/assets\/analytics\.js"/g)||[]).length,analytics?1:0,`${file}: 统计开关与页面脚本不一致`);
  if(analytics)assert(body.includes(`data-analytics-endpoint="${analytics.endpoint}"`),`${file}: 统计端点错误`);
  assert(body.includes('lang="zh-CN"'));assert(body.includes('rel="canonical"'));assert(body.includes('name="description"'));
  const ids=[...body.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size,`${file}: 重复锚点`);
  for(const m of body.matchAll(/(?:href|src)="([^"]+)"/g)){
    const url=m[1];if(/^(https?:|mailto:|data:)/.test(url))continue;
    const [part,hash]=url.split('#');
    let target=part?path.resolve(out,'.'+decodeURIComponent(part.split('?')[0])):file;
    if(part&&part.endsWith('/'))target=path.join(target,'index.html');
    assert(target.startsWith(out+path.sep),`非法路径 ${url}`);
    const content=await readFile(target,'utf8').catch(()=>null);assert(content!==null,`${file}: 失效链接 ${url}`);
    if(hash)assert(content.includes(`id="${hash}"`),`${file}: 缺少锚点 ${hash}`);links++;
  }
}
assert((await readFile(path.join(out,'robots.txt'),'utf8')).startsWith('User-agent: *\nAllow: /\n'));
assert(posts.length>0);assert(posts.some(p=>p.slug==='ford-turnaround'));
const article=posts.find(p=>p.slug==='ford-turnaround');for(const term of ['202.13','124','87.63','97.84','621-101','Olivia S. Jung'])assert(article.body.includes(term),`缺失关键口径 ${term}`);
for(const file of all)assert.equal(await readFile(path.join(root,path.relative(out,file)),'utf8'),await readFile(file,'utf8'),'Pages root differs from generated staging');
console.log(`PASS: ${all.length} generated files, ${links} local links/anchors, metadata and private-content guards`);

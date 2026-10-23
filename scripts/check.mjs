import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPosts} from './content.mjs';
import {analyticsConfig} from './analytics.mjs';
import {marked} from '../vendor/marked.mjs';
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
const cadreArticle=posts.find(p=>p.slug==='mao-selected-works-cadre-management');
if(cadreArticle){
  assert(!cadreArticle.html.includes('**'),'干部方法文章：加粗标记未正确渲染');
  // Keep the published article faithful to the original eight-part answer.
  assert.deepEqual(cadreArticle.headings.filter(h=>h.depth===2).map(h=>h.text),[
    '一、先看《毛选》对干部管理最核心的论述',
    '二、选拔干部：任人唯贤，而不是任人唯亲',
    '三、培养干部：毛泽东提出的五种具体方法',
    '四、发现干部：不是任命出干部，而是从实际工作中产生干部',
    '五、培养干部最有效的课堂，是实际工作',
    '六、如果培养出来的干部仍然无法完成目标，应该怎么处理？',
    '七、现代企业管理者应该重点读《毛选》的哪几篇？',
    '八、我的总结：这套思想的核心管理价值是什么？'
  ],'干部方法文章：原有八部分结构缺失或变更');
  const tables=marked.lexer(cadreArticle.body).filter(t=>t.type==='table');
  const firstColumns=tables.map(t=>t.rows.map(r=>r[0].text));
  for(const expected of [
    ['品行与责任心','工作能力','历史表现','团队协作'],
    ['1. 指导干部','2. 提高干部','3. 检查干部','4. 纠正错误','5. 照顾困难'],
    ['缺少知识和经验','工作方法错误','岗位能力不匹配','反复失职且无改善','欺骗、舞弊等诚信问题'],
    ['第1阶段：独立负责','第2阶段：项目负责','第3阶段：团队负责','第4阶段：业务负责'],
    ['1. 能力不足，但积极改进','2. 能力较强，但策略判断失误','3. 执行反复失误，缺乏改善','4. 目标确实不可行']
  ])assert(firstColumns.some(actual=>JSON.stringify(actual)===JSON.stringify(expected)),`干部方法文章：缺失完整表格 ${expected[0]}`);
  const readingTable=tables.find(t=>t.header[0].text==='阅读顺序');
  assert(readingTable&&readingTable.rows.length===4,'干部方法文章：应保留四篇核心推荐');
  for(const title of ['中国共产党在民族战争中的地位','关于领导方法的若干问题','整顿党的作风','党委会的工作方法'])assert(readingTable.rows.some(r=>r[1].text.includes(`《${title}》`)),`干部方法文章：缺少推荐原著 ${title}`);
  for(const term of ['全部历史和全部工作','后端工程师 → 模块负责人 → 项目负责人 → 团队负责人 → 业务负责人','现代管理引申','动态调整干部梯队'])assert(cadreArticle.body.includes(term),`干部方法文章：缺失关键内容 ${term}`);
  assert(cadreArticle.html.includes('<strong>检查是为了更早识别问题，既改善工作，也提高干部能力。</strong>'),'干部方法文章：关键结论加粗失败');
}
const article=posts.find(p=>p.slug==='ford-turnaround');for(const term of ['202.13','124','87.63','97.84','621-101','Olivia S. Jung'])assert(article.body.includes(term),`缺失关键口径 ${term}`);
for(const file of all)assert.equal(await readFile(path.join(root,path.relative(out,file)),'utf8'),await readFile(file,'utf8'),'Pages root differs from generated staging');
console.log(`PASS: ${all.length} generated files, ${links} local links/anchors, metadata and private-content guards`);

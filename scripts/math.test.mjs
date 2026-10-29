import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {renderMathMarkdown} from './math.mjs';
import {loadPosts} from './content.mjs';

test('math is rendered at build time and code remains literal',()=>{
 const html=renderMathMarkdown('Inline $q_j-p_j$.\n\n$$\n\\sum_{v}p_v\\log\\frac{p_v}{q_v}\n$$\n\n`$literal$`\n\n```python\nx = "$literal$"\n```');
 assert.equal((html.match(/<math /g)||[]).length,2);
 assert(html.includes('display="block"'));
 assert(html.includes('<code>$literal$</code>'));
 assert(!html.includes('<script'));
});
test('invalid formulas fail the build rather than publishing broken notation',()=>{
 assert.throws(()=>renderMathMarkdown('$\\notARealMathCommand$'));
});
test('math-enabled articles render formulas without leaking styles to other posts',async()=>{
 const posts=await loadPosts(fileURLToPath(new URL('..',import.meta.url)));
 for(const note of posts.filter(p=>p.math===true)){
 assert(note.html.includes('<math '));
 assert(note.styles.includes('/assets/post-training-note.css'));
 assert(!note.html.includes('katex-error'));
 assert(!note.html.replace(/<pre>[\s\S]*?<\/pre>/g,'').includes('**'),'Markdown emphasis should not remain literal');
 }
 for(const p of posts.filter(p=>p.math!==true))assert(!p.styles.includes('/assets/post-training-note.css'));
});
test('fixed-prefix FKL and RKL logit gradients match finite differences',()=>{
 const p=[.7,.2,.1],z=[-.8,.2,.4];
 const q=z.map(Math.exp).map(v=>v/z.map(Math.exp).reduce((a,b)=>a+b));
 const losses=zz=>{const e=zz.map(Math.exp),qq=e.map(v=>v/e.reduce((a,b)=>a+b));return [p.reduce((s,v,i)=>s+v*Math.log(v/qq[i]),0),qq.reduce((s,v,i)=>s+v*Math.log(v/p[i]),0)];};
 const r=losses(z)[1],h=1e-5;
 for(let j=0;j<z.length;j++){
  const a=[...z],b=[...z];a[j]+=h;b[j]-=h;
  const la=losses(a),lb=losses(b);
  assert(Math.abs((la[0]-lb[0])/(2*h)-(q[j]-p[j]))<1e-7);
  assert(Math.abs((la[1]-lb[1])/(2*h)-q[j]*(Math.log(q[j]/p[j])-r))<1e-7);
 }
});

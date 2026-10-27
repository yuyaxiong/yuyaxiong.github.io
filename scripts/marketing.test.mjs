import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPosts} from './content.mjs';
import {calculateMarketing} from '../static/assets/marketing-economics.mjs';
import {enhanceMarketingArticle} from './marketing-visuals.mjs';

test('marketing contribution distinguishes lead cost, order cost and contribution after spend',()=>{
 const base=calculateMarketing({spend:30000,leads:600,rate:10,margin:800});
 assert.deepEqual({orders:base.orders,cpl:base.cpl,cac:base.cac,profit:base.profit},{orders:60,cpl:50,cac:500,profit:18000});
 const slower=calculateMarketing({spend:30000,leads:600,rate:5,margin:800});
 assert.equal(slower.orders,30);assert.equal(slower.cac,1000);assert.equal(slower.profit,-6000);
});
test('zero leads or zero conversion never produce Infinity, NaN or a fictional CAC',()=>{
 for(const values of [{spend:30000,leads:0,rate:10,margin:800},{spend:30000,leads:600,rate:0,margin:800}]){
  const result=calculateMarketing(values);assert.equal(result.orders,0);assert.equal(result.cac,null);assert.equal(result.profit,-30000);
 }
 assert.equal(calculateMarketing({spend:0,leads:0,rate:0,margin:0}).cpl,null);
 const free=calculateMarketing({spend:0,leads:600,rate:10,margin:800});assert.equal(free.cac,0);assert.equal(free.profit,48000);
});
test('invalid and non-finite inputs are rejected while fractional expected orders remain valid',()=>{
 const input={spend:30000,leads:600,rate:10,margin:800};
 for(const bad of [{spend:-1},{leads:1.5},{rate:101},{rate:NaN},{margin:Infinity},{leads:'600'},{spend:1e9+1}])assert.throws(()=>calculateMarketing({...input,...bad}),RangeError);
 assert.equal(calculateMarketing({...input,leads:3,rate:50}).orders,1.5);
});
test('article visuals are scoped to the marketing article and only known markers render',async()=>{
 const root=new URL('../',import.meta.url).pathname;
 const posts=await loadPosts(root);
 const article=posts.find(p=>p.slug==='marketing-conversion-system');
 assert.equal((article.html.match(/<figure class="marketing-figure"/g)||[]).length,7);
 assert(!article.html.includes('<!-- marketing-visual:'));
 assert.equal((article.html.match(/<table>/g)||[]).length,26);
 for(const other of posts.filter(p=>p!==article)){assert.equal(other.styles.length,0);assert.equal(other.scripts.length,0);assert(!other.html.includes('marketing-figure'));}
 assert.throws(()=>enhanceMarketingArticle(article.slug,'<!-- marketing-visual:unknown -->'),/未知营销图示/);
});

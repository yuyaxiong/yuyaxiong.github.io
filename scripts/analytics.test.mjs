import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {analyticsConfig,analyticsScript,analyticsPrivacy} from './analytics.mjs';

const site={url:'https://yuyaxiong.github.io',analytics:{provider:'goatcounter',enabled:true,code:'test-blog'}};
const runtime=await readFile(new URL('../static/assets/analytics.js',import.meta.url),'utf8');
function visit(url,{referrer='',endpoint='https://test-blog.goatcounter.com/count'}={}) {
  const scripts=[];
  const document={
    currentScript:{dataset:{analyticsHost:'yuyaxiong.github.io',analyticsEndpoint:endpoint}},
    referrer,querySelector:()=>scripts.length?scripts[0]:null,
    createElement:()=>({setAttribute(name,value){this[name]=value;}}),
    head:{appendChild:script=>scripts.push(script)}
  };
  const context=vm.createContext({document,location:new URL(url),window:{},URL});
  vm.runInContext(runtime,context);
  return {scripts,context};
}

test('disabled or unconfigured analytics makes no script request',()=>{
  assert.equal(analyticsScript({url:site.url}),'');
  assert.equal(analyticsScript({...site,analytics:{...site.analytics,enabled:false,code:null}}),'');
  assert.throws(()=>analyticsScript({...site,analytics:{...site.analytics,code:null}}));
});
test('invalid endpoint cannot be inserted into HTML or loaded',()=>{
  for(const code of ['https://other.example','evil\" data-test=\"x','../x','-name','name-'])assert.throws(()=>analyticsConfig({...site,analytics:{...site.analytics,code}}));
  assert.equal(visit(site.url,{endpoint:'https://other.example/count'}).scripts.length,0);
});
test('local previews and other domains never load the third-party script',()=>{
  for(const url of ['http://localhost:4174/','http://127.0.0.1:4174/','https://preview.example/','http://yuyaxiong.github.io/'])assert.equal(visit(url).scripts.length,0);
});
test('production visits count once and strip search terms and full referral URLs',()=>{
  const {scripts,context}=visit(site.url+'/articles/?q=private-search#section',{referrer:'https://referrer.example/page?token=secret#part'});
  assert.equal(scripts.length,1);
  assert.equal(scripts[0].async,true);
  assert.equal(scripts[0].referrerPolicy,'origin');
  assert.equal(context.window.goatcounter.path(),'/articles/');
  assert.equal(context.window.goatcounter.referrer(),'https://referrer.example');
  assert.equal(context.window.goatcounter.no_events,true);
  vm.runInContext(runtime,context);
  assert.equal(scripts.length,1);
  assert.equal(visit(site.url,{referrer:site.url+'/articles/?q=secret'}).context.window.goatcounter.referrer(),'');
});
test('privacy text matches whether analytics is enabled',()=>{
  assert(analyticsPrivacy(site).includes('GoatCounter'));
  assert(!analyticsPrivacy({...site,analytics:{...site.analytics,enabled:false}}).includes('本站使用 <a'));
});

import {Marked} from '../vendor/marked.mjs';
import katex from '../vendor/katex.mjs';

// Render during the build: no browser dependency or external font/script requests.
export function renderMathMarkdown(source,renderer){
  const render=(tex,displayMode)=>katex.renderToString(tex,{displayMode,output:'mathml',throwOnError:true,strict:'error',trust:false});
  const parser=new Marked({renderer,extensions:[
    {name:'displayMath',level:'block',start:s=>s.indexOf('$$'),tokenizer(s){const m=/^\$\$\s*\n([\s\S]+?)\n\$\$(?:\n|$)/.exec(s);if(m)return {type:'displayMath',raw:m[0],text:m[1]};},renderer(t){return `<div class="math-block" tabindex="0" role="region" aria-label="数学公式，可横向滚动">${render(t.text,true)}</div>\n`;}},
    {name:'inlineMath',level:'inline',start:s=>s.indexOf('$'),tokenizer(s){const m=/^\$([^$\n]+?)\$(?!\$)/.exec(s);if(m)return {type:'inlineMath',raw:m[0],text:m[1]};},renderer(t){return render(t.text,false);}}
  ]});
  return parser.parse(source);
}
